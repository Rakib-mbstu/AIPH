import { prisma } from '../../../index'

export interface SessionSummary {
  id: string
  title: string
  createdAt: Date
  updatedAt: Date
  messageCount: number
  preview: string | null
}

/** Create a new session with a placeholder title. */
export async function createSession(userId: string) {
  return prisma.chatSession.create({
    data: { userId, title: 'New chat' },
  })
}

/**
 * List all sessions for a user, newest-first by updatedAt.
 * Single query — no N+1. Uses _count + last assistant message for preview.
 */
export async function listSessions(
  userId: string,
  limit = 50
): Promise<SessionSummary[]> {
  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: Math.min(limit, 200),
    include: {
      _count: { select: { messages: true } },
      messages: {
        where: { role: 'assistant' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true },
      },
    },
  })

  return sessions.map((s): SessionSummary => ({
    id: s.id,
    title: s.title,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    messageCount: s._count.messages,
    preview: s.messages[0]?.content?.slice(0, 80) ?? null,
  }))
}

/**
 * Fetch a single session with all its messages (asc order).
 * Returns null if the session doesn't exist or doesn't belong to the user.
 */
export async function getSessionWithMessages(sessionId: string, userId: string) {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!session) return null
  const { messages, ...sessionData } = session
  return { session: sessionData, messages }
}

/** Lightweight ownership check before streaming. */
export async function assertSessionOwner(
  sessionId: string,
  userId: string
): Promise<boolean> {
  const session = await prisma.chatSession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true },
  })
  return session !== null
}

/**
 * Set the title only when it's still the default "New chat".
 * Idempotent — safe to call multiple times.
 */
export async function setSessionTitleIfDefault(
  sessionId: string,
  title: string
): Promise<void> {
  await prisma.chatSession.updateMany({
    where: { id: sessionId, title: 'New chat' },
    data: { title },
  })
}

/** Count user messages in a session (used to detect first exchange). */
export async function countUserMessages(sessionId: string): Promise<number> {
  return prisma.chatMessage.count({
    where: { sessionId, role: 'user' },
  })
}

/** Bump updatedAt so the session sorts to top of history list. */
export async function touchSession(sessionId: string): Promise<void> {
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { updatedAt: new Date() },
  })
}
