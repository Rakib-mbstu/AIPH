import { Router, Request, Response, NextFunction } from 'express'
import { clerkClient } from '@clerk/express'
import { protect, getUserId } from '../middleware/auth'
import { getOrCreateUser } from '../lib/db/queries/users'
import { upsertMasteryInTx } from '../lib/db/queries/mastery'
import { evaluateApproach } from '../lib/ai/client'
import { detectWeakness } from '../lib/weakness/detect'
import { prisma } from '../index'

const router = Router()

const VALID_STATUSES = new Set(['solved', 'attempted', 'failed'])

/**
 * POST /api/attempts
 *
 * 1. Validate body (problemId, status, solveTime, approachText required)
 * 2. Fetch Problem with topic + pattern
 * 3. Call AI evaluator on the user's written approach
 * 4. Atomic transaction: Attempt + AttemptSubmission + TopicProgress upsert
 *    + PatternMastery upsert (using AI-identified pattern, falling back to
 *    the problem's canonical pattern when the AI can't identify one).
 * 5. Fire-and-forget weakness detection
 * 6. Return { attempt, submission }
 */
router.post('/', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const { problemId, status, solveTime, hintsUsed, approachText } = req.body ?? {}

    if (!problemId || typeof problemId !== 'string') {
      return res.status(400).json({ error: 'problemId (string) required' })
    }
    if (!status || !VALID_STATUSES.has(status)) {
      return res.status(400).json({ error: 'status must be solved|attempted|failed' })
    }
    if (typeof solveTime !== 'number' || solveTime < 0) {
      return res.status(400).json({ error: 'solveTime (number, minutes) required' })
    }
    if (!approachText || typeof approachText !== 'string' || approachText.trim().length < 10) {
      return res
        .status(400)
        .json({ error: 'approachText (min 10 chars) required — describe your approach' })
    }

    // Resolve user
    const clerkUser = await clerkClient.users.getUser(clerkId)
    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return res.status(400).json({ error: 'No email on Clerk user' })
    const user = await getOrCreateUser(clerkId, email)

    // Fetch problem with topic + pattern
    const problem = await prisma.problem.findUnique({
      where: { id: problemId },
      include: { topic: true, pattern: true },
    })
    if (!problem) return res.status(404).json({ error: 'Problem not found' })

    // AI evaluation
    const evaluation = await evaluateApproach({
      problemTitle: problem.title,
      difficulty: problem.difficulty,
      expectedPattern: problem.pattern.name,
      topic: problem.topic.name,
      approachText,
    })

    // Resolve the AI-identified pattern to a Pattern row. If it doesn't match
    // a known pattern, fall back to the problem's canonical pattern. We track
    // the *raw* identified string in AttemptSubmission either way.
    let patternForMastery = problem.pattern
    if (evaluation.patternUsed) {
      const found = await prisma.pattern.findUnique({
        where: { name: evaluation.patternUsed },
      })
      if (found) patternForMastery = found
    }

    const aiScore = clamp(evaluation.score ?? 0, 0, 100)

    // Atomic write
    const result = await prisma.$transaction(async (tx) => {
      const attempt = await tx.attempt.create({
        data: {
          userId: user.id,
          problemId: problem.id,
          status,
          solveTime: Math.round(solveTime),
          hintsUsed: typeof hintsUsed === 'number' ? hintsUsed : 0,
        },
      })

      const submission = await tx.attemptSubmission.create({
        data: {
          attemptId: attempt.id,
          approachText,
          aiScore,
          timeComplexity: evaluation.timeComplexity,
          spaceComplexity: evaluation.spaceComplexity,
          feedback: evaluation.feedback,
          patternIdentified: evaluation.patternUsed,
          suggestedOptimization: evaluation.suggestedOptimization,
        },
      })

      await upsertMasteryInTx(tx, {
        userId: user.id,
        topicId: problem.topicId,
        patternId: patternForMastery.id,
        status,
        solveTime: Math.round(solveTime),
        aiScore,
      })

      return { attempt, submission }
    })

    // Fire-and-forget weakness detection — never block the response
    detectWeakness(user.id, problem.topicId, patternForMastery.id).catch((err) => {
      console.error('[attempts] detectWeakness failed:', err)
    })

    res.json(result)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/attempts/:problemId — attempt history (with submissions) for a problem.
 */
router.get('/:problemId', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const attempts = await prisma.attempt.findMany({
      where: { userId: user.id, problemId: req.params.problemId },
      include: { submission: true },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ attempts })
  } catch (err) {
    next(err)
  }
})

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

export default router
