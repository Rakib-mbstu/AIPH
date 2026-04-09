import { Router, Request, Response, NextFunction } from 'express'
import { protect, getUserId } from '../middleware/auth'
import { computeReadiness } from '../lib/readiness/score'
import { prisma } from '../index'

const router = Router()

/**
 * GET /api/readiness — composite interview readiness score + sub-scores.
 * Separate from /api/progress so the tracker can poll it independently
 * after an attempt submission without re-fetching the full progress bundle.
 * (The progress route also inlines it for the initial tracker load.)
 */
router.get('/', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const readiness = await computeReadiness(user.id)
    res.json(readiness)
  } catch (err) {
    next(err)
  }
})

export default router
