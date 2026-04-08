import { prisma } from '../../index'

/**
 * Passive weakness detection. Called fire-and-forget after every attempt save.
 * Mirrors the thresholds in CLAUDE.md:
 *   - failing  : >40% failure rate over the last 10 (sample size > 3)
 *   - slow     : latest attempt > 1.5x topic rolling average
 *   - confused : any of the last 10 attempts used > 2 hints
 *
 * Recovery: if the user solves their last 3 in a row on a topic/pattern, any
 * unresolved WeakArea on that topic/pattern is closed by setting `resolvedAt`.
 * History is preserved (we never delete WeakArea rows).
 *
 * Errors are logged and swallowed — never let detection take down a write path.
 */
export async function detectWeakness(
  userId: string,
  topicId: string,
  patternId: string
): Promise<void> {
  try {
    const [topicRecent, patternRecent] = await Promise.all([
      prisma.attempt.findMany({
        where: { userId, problem: { topicId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { status: true, solveTime: true, hintsUsed: true },
      }),
      prisma.attempt.findMany({
        where: { userId, problem: { patternId } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { status: true, solveTime: true, hintsUsed: true },
      }),
    ])

    await evaluate({ userId, topicId, patternId: null, recent: topicRecent })
    await evaluate({ userId, topicId: null, patternId, recent: patternRecent })
  } catch (err) {
    console.error('[weakness/detect] failed:', err)
  }
}

interface AttemptSample {
  status: string
  solveTime: number
  hintsUsed: number
}

async function evaluate(args: {
  userId: string
  topicId: string | null
  patternId: string | null
  recent: AttemptSample[]
}) {
  const { userId, topicId, patternId, recent } = args
  if (recent.length === 0) return

  const failureRate =
    recent.filter((a) => a.status === 'failed').length / recent.length
  const avgSolve =
    recent.reduce((s, a) => s + a.solveTime, 0) / recent.length
  const latest = recent[0] // findMany ordered desc → index 0 is newest
  const hintHeavy = recent.some((a) => a.hintsUsed > 2)

  // Recovery: last 3 attempts all solved → close any open flag
  if (
    recent.length >= 3 &&
    recent.slice(0, 3).every((a) => a.status === 'solved')
  ) {
    await prisma.weakArea.updateMany({
      where: {
        userId,
        topicId: topicId ?? undefined,
        patternId: patternId ?? undefined,
        resolvedAt: null,
      },
      data: { resolvedAt: new Date() },
    })
    return
  }

  // failing: >40% failure rate, sample size > 3
  if (failureRate > 0.4 && recent.length > 3) {
    await flag({ userId, topicId, patternId, reason: 'failing', severity: 3 })
    return
  }

  // slow: latest attempt 1.5x rolling average
  if (avgSolve > 0 && latest.solveTime > avgSolve * 1.5) {
    await flag({ userId, topicId, patternId, reason: 'slow', severity: 2 })
    return
  }

  // confused: hint-heavy session
  if (hintHeavy) {
    await flag({ userId, topicId, patternId, reason: 'confused', severity: 1 })
  }
}

/**
 * Insert a WeakArea unless an unresolved one with the same scope already exists.
 * If an open flag exists with a *lower* severity, bump it instead of creating
 * a duplicate row — keeps the table from churning during a bad streak.
 */
async function flag(args: {
  userId: string
  topicId: string | null
  patternId: string | null
  reason: 'failing' | 'slow' | 'confused'
  severity: number
}) {
  const { userId, topicId, patternId, reason, severity } = args

  const existing = await prisma.weakArea.findFirst({
    where: {
      userId,
      topicId: topicId ?? undefined,
      patternId: patternId ?? undefined,
      resolvedAt: null,
    },
  })

  if (existing) {
    if (existing.severity < severity || existing.reason !== reason) {
      await prisma.weakArea.update({
        where: { id: existing.id },
        data: { severity: Math.max(existing.severity, severity), reason },
      })
    }
    return
  }

  await prisma.weakArea.create({
    data: {
      userId,
      topicId: topicId ?? undefined,
      patternId: patternId ?? undefined,
      reason,
      severity,
    },
  })
}
