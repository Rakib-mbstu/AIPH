import { Router, Request, Response, NextFunction } from 'express'
import { clerkClient } from '@clerk/express'
import { protect, getUserId } from '../middleware/auth'
import { getOrCreateUser } from '../lib/db/queries/users'
import { prisma } from '../index'

const router = Router()

/**
 * POST /api/users/onboard
 * Called once on first sign-in. Creates the local User + UserProfile from
 * Clerk claims, optionally seeding profile fields supplied in the body.
 */
router.post('/onboard', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const clerkUser = await clerkClient.users.getUser(clerkId)
    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return res.status(400).json({ error: 'No email on Clerk user' })

    const user = await getOrCreateUser(clerkId, email)

    const { experienceLevel, targetRole, timelineDays } = req.body ?? {}
    if (experienceLevel || targetRole || timelineDays) {
      await prisma.userProfile.update({
        where: { userId: user.id },
        data: {
          ...(experienceLevel && { experienceLevel }),
          ...(targetRole && { targetRole }),
          ...(timelineDays && { timelineDays: Number(timelineDays) }),
        },
      })
    }

    const fresh = await prisma.user.findUnique({
      where: { id: user.id },
      include: { profile: true },
    })

    res.json({ user: fresh })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/users/me — current user with profile.
 */
router.get('/me', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: { profile: true },
    })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })
    res.json({ user })
  } catch (err) {
    next(err)
  }
})

export default router
