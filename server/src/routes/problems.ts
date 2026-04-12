import { Router, Request, Response, NextFunction } from 'express'
import { protect, getUserId } from '../middleware/auth'
import { recommendForUser } from '../lib/recommendation/engine'
import { prisma } from '../index'

const router = Router()

/**
 * GET /api/problems
 *
 * Returns a ranked list of recommended problems for the current user. Powered
 * by the LLM recommendation engine; falls back to an empty array on cold start
 * (the client should then show "no signal yet, attempt a problem first").
 *
 * Query params:
 *   limit   — max recommendations (default 5, max 10)
 *   topic   — optional topic name to bias recommendations toward
 *   pattern — optional pattern name to bias recommendations toward
 */
router.get('/', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const limit = Math.min(
      Math.max(parseInt(String(req.query.limit ?? '5'), 10) || 5, 1),
      10
    )

    const topic = req.query.topic ? String(req.query.topic) : undefined
    const pattern = req.query.pattern ? String(req.query.pattern) : undefined

    const recommendations = await recommendForUser(user.id, limit, { topic, pattern })
    res.json({ recommendations })
  } catch (err) {
    next(err)
  }
})

export default router
