import { Router, Request, Response, NextFunction } from 'express'
import { protect, getUserId } from '../middleware/auth'
import { prisma } from '../index'

const router = Router()

/**
 * GET /api/roadmap
 *
 * Returns all topics + patterns with the current user's progress/mastery
 * left-joined in. Topics the user hasn't touched yet appear with `progress: null`
 * (and patterns with `mastery: null`) — the UI shows them as "not started".
 *
 * Static for Phase 1: every user gets the full topic graph in alphabetical
 * order. Phase 2 will reorder this list using the weakness engine.
 */
router.get('/', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const [topics, patterns, topicProgress, patternMastery] = await Promise.all([
      prisma.topic.findMany({ orderBy: { name: 'asc' } }),
      prisma.pattern.findMany({ orderBy: { name: 'asc' } }),
      prisma.topicProgress.findMany({ where: { userId: user.id } }),
      prisma.patternMastery.findMany({ where: { userId: user.id } }),
    ])

    const progressByTopic = new Map(topicProgress.map((p) => [p.topicId, p]))
    const masteryByPattern = new Map(patternMastery.map((m) => [m.patternId, m]))

    res.json({
      topics: topics.map((t) => ({
        ...t,
        progress: progressByTopic.get(t.id) ?? null,
      })),
      patterns: patterns.map((p) => ({
        ...p,
        mastery: masteryByPattern.get(p.id) ?? null,
      })),
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/roadmap/generate — Phase 2 placeholder. Returns 501 until the
 * adaptive generator (Step beyond MVP) is wired up.
 */
router.post('/generate', protect, async (_req, res) => {
  res.status(501).json({ error: 'Adaptive roadmap generation lands in Phase 2' })
})

export default router
