import { Router, Request, Response, NextFunction } from 'express'
import { clerkClient } from '@clerk/express'
import { protect, getUserId } from '../middleware/auth'
import { getOrCreateUser } from '../lib/db/queries/users'
import { buildChatContext } from '../lib/db/queries/chatContext'
import { streamChat, generateSessionTitle } from '../lib/ai/client'
import {
  createSession,
  listSessions,
  getSessionWithMessages,
  assertSessionOwner,
  setSessionTitleIfDefault,
  countUserMessages,
  touchSession,
} from '../lib/db/queries/chatSessions'
import { prisma } from '../index'

const router = Router()

// =============================================================================
// Session management
// =============================================================================

/**
 * POST /api/chat/sessions
 *
 * Creates a new chat session with the placeholder title "New chat".
 * Called when the user clicks "+ New chat".
 */
router.post('/sessions', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const clerkUser = await clerkClient.users.getUser(clerkId)
    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return res.status(400).json({ error: 'No email on Clerk user' })
    const user = await getOrCreateUser(clerkId, email)

    const session = await createSession(user.id)
    res.json({ session })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/chat/sessions
 *
 * Lists all chat sessions for the current user, newest-first.
 * Each entry includes a preview (last assistant message) and message count.
 */
router.get('/sessions', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)
    const sessions = await listSessions(user.id, limit)
    res.json({ sessions })
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/chat/sessions/:sessionId
 *
 * Returns a single session with its full message history (asc order).
 * Returns 404 if the session doesn't exist or doesn't belong to the user.
 */
router.get('/sessions/:sessionId', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const result = await getSessionWithMessages(req.params.sessionId, user.id)
    if (!result) return res.status(404).json({ error: 'Session not found' })

    res.json(result)
  } catch (err) {
    next(err)
  }
})

// =============================================================================
// Streaming chat
// =============================================================================

/**
 * POST /api/chat
 *
 * Streams an assistant response over SSE. Requires `sessionId` in the body.
 *
 * On the first user message in a session:
 *   - Generates an AI title concurrently with streaming
 *   - Sends `{ sessionTitle: "..." }` SSE frame before `{ done: true }`
 *   - Persists the title to DB
 *
 * The assembled assistant response is persisted after stream completion.
 * Session updatedAt is bumped after each exchange so it sorts to top of history.
 */
router.post('/', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const { message, sessionId, history } = req.body ?? {}

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message (string) required' })
    }
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId (string) required' })
    }

    const clerkUser = await clerkClient.users.getUser(clerkId)
    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return res.status(400).json({ error: 'No email on Clerk user' })
    const user = await getOrCreateUser(clerkId, email)

    // Ownership check
    const owned = await assertSessionOwner(sessionId, user.id)
    if (!owned) return res.status(403).json({ error: 'Session not found' })

    // Is this the first user message? Determines whether to generate a title.
    const priorUserCount = await countUserMessages(sessionId)
    const isFirstMessage = priorUserCount === 0

    const context = await buildChatContext(user.id)

    // Persist user message
    await prisma.chatMessage.create({
      data: { userId: user.id, sessionId, role: 'user', content: message },
    })

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    // Start title generation concurrently with streaming (first message only)
    const titlePromise: Promise<string | null> = isFirstMessage
      ? generateSessionTitle(message)
      : Promise.resolve(null)

    // Build conversation window
    const priorMessages: Array<{ role: 'user' | 'assistant'; content: string }> =
      Array.isArray(history)
        ? history
            .filter(
              (m: any) =>
                (m?.role === 'user' || m?.role === 'assistant') &&
                typeof m?.content === 'string'
            )
            .slice(-20)
        : []

    const messages = [...priorMessages, { role: 'user' as const, content: message }]

    let assembled = ''
    try {
      for await (const chunk of streamChat(messages, context)) {
        assembled += chunk
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`)
      }
    } catch (streamErr) {
      console.error('[chat] stream error:', streamErr)
      res.write(
        `data: ${JSON.stringify({
          error: 'stream_failed',
          message: streamErr instanceof Error ? streamErr.message : 'unknown',
        })}\n\n`
      )
    }

    // Persist assistant message
    if (assembled.length > 0) {
      await prisma.chatMessage.create({
        data: { userId: user.id, sessionId, role: 'assistant', content: assembled },
      })
    }

    // Await title, send SSE frame, persist to DB
    const title = await titlePromise
    if (title && title !== 'New chat') {
      res.write(`data: ${JSON.stringify({ sessionTitle: title })}\n\n`)
      setSessionTitleIfDefault(sessionId, title).catch((err) =>
        console.error('[chat] setSessionTitle failed:', err)
      )
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)

    // Bump session to top of history
    touchSession(sessionId).catch((err) =>
      console.error('[chat] touchSession failed:', err)
    )

    res.end()
  } catch (err) {
    next(err)
  }
})

// =============================================================================
// History (backward-compat shim)
// =============================================================================

/**
 * GET /api/chat/history
 *
 * Returns messages from the most recent session.
 * Kept for backward compatibility — new code uses GET /sessions/:id instead.
 */
router.get('/history', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)

    // Find most recent session
    const latestSession = await prisma.chatSession.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    if (!latestSession) {
      return res.json({ messages: [] })
    }

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: latestSession.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    res.json({ messages: messages.reverse() })
  } catch (err) {
    next(err)
  }
})

export default router
