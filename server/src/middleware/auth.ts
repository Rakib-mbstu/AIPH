import { requireAuth } from '@clerk/express'
import { Request, Response, NextFunction } from 'express'

const clerkConfigured =
  !!process.env.CLERK_SECRET_KEY && !!process.env.CLERK_PUBLISHABLE_KEY

/**
 * Route guard. When Clerk is configured, defers to Clerk's `requireAuth()`.
 * When it isn't (smoke tests, CI without secrets), returns a clean 401 so
 * the route doesn't crash with a confusing "publishable key missing" error.
 */
export const protect =
  clerkConfigured
    ? requireAuth()
    : (_req: Request, res: Response, _next: NextFunction) => {
        res
          .status(401)
          .json({ error: 'Auth disabled — set CLERK_SECRET_KEY + CLERK_PUBLISHABLE_KEY' })
      }

// Extend Express Request with user info
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string
        sessionId?: string
        getToken?: () => Promise<string>
      }
    }
  }
}

export const getUserId = (req: Request): string => {
  const userId = req.auth?.userId
  if (!userId) {
    throw new Error('User not authenticated')
  }
  return userId
}
