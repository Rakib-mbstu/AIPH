import { Router, Request, Response, NextFunction } from 'express'
import { protect, getUserId } from '../middleware/auth'
import { calculateStreakDays } from '../lib/db/queries/streak'
import { buildTodaysPlan } from '../lib/recommendation/todaysPlan'
import { prisma } from '../index'

const router = Router()

/**
 * GET /api/progress
 *
 * The Tracker home base. Bundles everything the dashboard needs in one
 * round-trip:
 *   - todaysPlan       — prescriptive next steps (Phase 1: deterministic)
 *   - recentAttempts   — last 5 with submission + problem
 *   - weakAreas        — currently unresolved, severity-sorted
 *   - streakDays       — consecutive days with at least one attempt
 */
router.get('/', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const [todaysPlan, recentAttempts, weakAreas, streakDays] = await Promise.all([
      buildTodaysPlan(user.id),
      prisma.attempt.findMany({
        where: { userId: user.id },
        include: {
          submission: true,
          problem: { include: { topic: true, pattern: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.weakArea.findMany({
        where: { userId: user.id, resolvedAt: null },
        include: { topic: true, pattern: true },
        orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
      }),
      calculateStreakDays(user.id),
    ])

    res.json({ todaysPlan, recentAttempts, weakAreas, streakDays })
  } catch (err) {
    next(err)
  }
})

export default router
