import { Router, Request, Response, NextFunction } from 'express'
import { clerkClient } from '@clerk/express'
import { protect, getUserId } from '../middleware/auth'
import { getOrCreateUser } from '../lib/db/queries/users'
import { buildChatContext } from '../lib/db/queries/chatContext'
import { streamChat } from '../lib/ai/client'
import { prisma } from '../index'

const router = Router()

/**
 * POST /api/chat
 *
 * Streams an assistant response over SSE. The user message is persisted
 * before streaming starts so that history reflects the request even if the
 * stream is interrupted. The assembled assistant response is persisted on
 * stream completion.
 */
router.post('/', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const { message, history } = req.body ?? {}

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message (string) required' })
    }

    // Resolve Clerk → local user (idempotent — first call onboards)
    const clerkUser = await clerkClient.users.getUser(clerkId)
    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return res.status(400).json({ error: 'No email on Clerk user' })
    const user = await getOrCreateUser(clerkId, email)

    // Build context (weak areas, mastery scores, recent patterns)
    const context = await buildChatContext(user.id)

    // Persist user message BEFORE streaming so it survives interruption
    await prisma.chatMessage.create({
      data: { userId: user.id, role: 'user', content: message },
    })

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    // Build conversation: optional caller-supplied history + new user turn.
    // We trust the client to send a trimmed window; cap defensively.
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
        // SSE data frame — escape newlines so multi-line tokens stay on one frame
        res.write(`data: ${JSON.stringify({ delta: chunk })}\n\n`)
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    } catch (streamErr) {
      console.error('[chat] stream error:', streamErr)
      res.write(
        `data: ${JSON.stringify({
          error: 'stream_failed',
          message: streamErr instanceof Error ? streamErr.message : 'unknown',
        })}\n\n`
      )
    }

    // Persist assistant message — only if we got something
    if (assembled.length > 0) {
      await prisma.chatMessage.create({
        data: { userId: user.id, role: 'assistant', content: assembled },
      })
    }

    res.end()
  } catch (err) {
    next(err)
  }
})

/**
 * GET /api/chat/history — last N messages for the current user.
 */
router.get('/history', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)

    const messages = await prisma.chatMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    res.json({ messages: messages.reverse() })
  } catch (err) {
    next(err)
  }
})

export default router
