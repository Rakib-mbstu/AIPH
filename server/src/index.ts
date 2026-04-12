import express from 'express'
import cors from 'cors'
import { clerkMiddleware } from '@clerk/express'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 4000
export const prisma = new PrismaClient()

// Middleware
app.use(cors())
app.use(express.json())

// Health check — mounted BEFORE Clerk middleware so it works even when
// Clerk env vars aren't configured (e.g. CI, local smoke tests).
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Auth — only mount Clerk if keys are configured. This lets the server boot
// in environments where you're testing infra (DB, routes, seeds) without
// pulling in real auth.
if (process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY) {
  app.use(clerkMiddleware())
} else {
  console.warn(
    '⚠  Clerk keys not set — /api routes that require auth will return 401. ' +
      'Set CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY to enable auth.'
  )
}

// Routes
import usersRoutes from './routes/users'
import chatRoutes from './routes/chat'
import attemptsRoutes from './routes/attempts'
import progressRoutes from './routes/progress'
import roadmapRoutes from './routes/roadmap'
import weaknessRoutes from './routes/weakness'
import problemsRoutes from './routes/problems'
import readinessRoutes from './routes/readiness'
import adminRoutes from './routes/admin'

app.use('/api/users', usersRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/attempts', attemptsRoutes)
app.use('/api/progress', progressRoutes)
app.use('/api/roadmap', roadmapRoutes)
app.use('/api/weakness', weaknessRoutes)
app.use('/api/problems', problemsRoutes)
app.use('/api/readiness', readinessRoutes)
app.use('/api/admin', adminRoutes)

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err)
  res.status(500).json({
    error: err.message || 'Internal server error',
  })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...')
  await prisma.$disconnect()
  process.exit(0)
})
