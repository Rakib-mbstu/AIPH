import { Router, Request, Response, NextFunction } from 'express'
import { protect, getUserId } from '../middleware/auth'
import { prisma } from '../index'

const router = Router()

/**
 * GET /api/weakness — current unresolved weak areas, severity-sorted.
 * Includes topic/pattern names so the UI doesn't need a second round trip.
 */
router.get('/', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const weakAreas = await prisma.weakArea.findMany({
      where: { userId: user.id, resolvedAt: null },
      include: { topic: true, pattern: true },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
    })

    res.json({ weakAreas })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/weakness/history — including resolved entries, for the tracker page.
 */
router.get('/history', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const weakAreas = await prisma.weakArea.findMany({
      where: { userId: user.id },
      include: { topic: true, pattern: true },
      orderBy: { detectedAt: 'desc' },
      take: 100,
    })

    res.json({ weakAreas })
  } catch (err) {
    next(err)
  }
})

export default router
