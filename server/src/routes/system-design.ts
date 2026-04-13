import { Router, Request, Response, NextFunction } from 'express'
import { clerkClient } from '@clerk/express'
import { protect, getUserId } from '../middleware/auth'
import { getOrCreateUser } from '../lib/db/queries/users'
import { upsertSystemDesignProgressInTx } from '../lib/db/queries/systemDesignMastery'
import { evaluateSystemDesign } from '../lib/ai/client'
import { invalidateUserCache } from '../lib/ai/cache'
import { detectSystemDesignWeakness } from '../lib/weakness/detectSystemDesign'
import { prisma } from '../index'

const router = Router()

/**
 * GET /api/system-design/questions
 *
 * All system design questions with their linked topics and per-user attempt count.
 */
router.get('/questions', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const [questions, attemptCounts] = await Promise.all([
      prisma.systemDesignQuestion.findMany({
        orderBy: { difficulty: 'asc' },
        include: { topics: { include: { topic: true } } },
      }),
      prisma.systemDesignAttempt.groupBy({
        by: ['questionId'],
        where: { userId: user.id },
        _count: { id: true },
      }),
    ])
    const countByQuestion = new Map(
      attemptCounts.map((r) => [r.questionId, r._count.id])
    )

    const result = questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      difficulty: q.difficulty,
      expectedConcepts: q.expectedConcepts,
      resources: q.resources,
      topics: q.topics.map((qt) => qt.topic),
      attemptCount: countByQuestion.get(q.id) ?? 0,
    }))

    res.json({ questions: result })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/system-design/topics
 *
 * All system design topics with per-user progress (mastery score, attempt count).
 */
router.get('/topics', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const [topics, progress] = await Promise.all([
      prisma.systemDesignTopic.findMany({ orderBy: { category: 'asc' } }),
      prisma.systemDesignProgress.findMany({ where: { userId: user.id } }),
    ])

    const progressByTopic = new Map(progress.map((p) => [p.topicId, p]))

    const result = topics.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
      difficulty: t.difficulty,
      prerequisiteIds: t.prerequisiteIds,
      progress: progressByTopic.get(t.id) ?? null,
    }))

    res.json({ topics: result })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/system-design/attempts
 *
 * 1. Validate body (questionId, responseText min 50 chars)
 * 2. Fetch question with linked topics
 * 3. AI evaluation
 * 4. Atomic transaction: create attempt + result + upsert progress
 * 5. Fire-and-forget: weakness detection + cache invalidation
 * 6. Return { attempt, result }
 */
router.post('/attempts', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const { questionId, responseText } = req.body ?? {}

    if (!questionId || typeof questionId !== 'string') {
      return res.status(400).json({ error: 'questionId (string) required' })
    }
    if (typeof responseText !== 'string' || responseText.trim().length < 50) {
      return res.status(400).json({ error: 'responseText (string, min 50 chars) required' })
    }

    const clerkUser = await clerkClient.users.getUser(clerkId)
    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return res.status(400).json({ error: 'No email on Clerk user' })

    const [user, question] = await Promise.all([
      getOrCreateUser(clerkId, email),
      prisma.systemDesignQuestion.findUnique({
        where: { id: questionId },
        include: { topics: { include: { topic: true } } },
      }),
    ])
    if (!question) return res.status(404).json({ error: 'Question not found' })

    const topicIds = question.topics.map((qt) => qt.topicId)

    // AI evaluation
    const evaluation = await evaluateSystemDesign({
      prompt: question.prompt,
      expectedConcepts: question.expectedConcepts,
      responseText: responseText.trim(),
    })

    const clampedScore = clamp(evaluation.score ?? 0, 0, 100)
    const clampedReq = clamp(evaluation.requirementsClarification ?? 0, 0, 25)
    const clampedComp = clamp(evaluation.componentCoverage ?? 0, 0, 25)
    const clampedScale = clamp(evaluation.scalabilityReasoning ?? 0, 0, 25)
    const clampedTradeoff = clamp(evaluation.tradeoffAwareness ?? 0, 0, 25)

    // Atomic write
    const txResult = await prisma.$transaction(async (tx) => {
      const attempt = await tx.systemDesignAttempt.create({
        data: {
          userId: user.id,
          questionId: question.id,
          responseText: responseText.trim(),
        },
      })

      const result = await tx.systemDesignAttemptResult.create({
        data: {
          attemptId: attempt.id,
          score: clampedScore,
          requirementsClarification: clampedReq,
          componentCoverage: clampedComp,
          scalabilityReasoning: clampedScale,
          tradeoffAwareness: clampedTradeoff,
          feedback: evaluation.feedback ?? '',
          missingConcepts: evaluation.missingConcepts ?? [],
          suggestedDeepDive: evaluation.suggestedDeepDive ?? null,
        },
      })

      await upsertSystemDesignProgressInTx(tx, {
        userId: user.id,
        topicIds,
        score: clampedScore,
      })

      return { attempt, result }
    })

    // Fire-and-forget side effects
    detectSystemDesignWeakness(user.id, topicIds).catch((err) => {
      console.error('[system-design] detectSystemDesignWeakness failed:', err)
    })
    invalidateUserCache(user.id).catch((err) => {
      console.error('[system-design] invalidateUserCache failed:', err)
    })

    res.json(txResult)
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/system-design/attempts/:questionId
 *
 * Attempt history (with results) for a specific question.
 */
router.get('/attempts/:questionId', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const attempts = await prisma.systemDesignAttempt.findMany({
      where: { userId: user.id, questionId: req.params.questionId },
      include: { result: true },
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
