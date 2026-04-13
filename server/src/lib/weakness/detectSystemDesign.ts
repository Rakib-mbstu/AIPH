import { prisma } from '../../index'

/**
 * Passive weakness detection for system design attempts.
 * Mirrors the thresholds from detect.ts but scoped to SystemDesignAttempt:
 *
 *   - failing: >40% of last 10 attempts scored < 40, sample size > 3
 *   - low:     latest attempt scored < 40 with prior attempts on record
 *
 * Recovery: if the last 3 attempts on a topic all scored ≥ 60, close any
 * open WeakArea on that systemDesignTopicId.
 *
 * Errors are swallowed — never let detection take down the attempt write path.
 */
export async function detectSystemDesignWeakness(
  userId: string,
  topicIds: string[]
): Promise<void> {
  try {
    await Promise.all(topicIds.map((topicId) => evaluateTopic(userId, topicId)))
  } catch (err) {
    console.error('[weakness/detectSystemDesign] failed:', err)
  }
}

async function evaluateTopic(userId: string, topicId: string): Promise<void> {
  // Fetch last 10 attempts for this user on questions that include this topic
  const recent = await prisma.systemDesignAttempt.findMany({
    where: {
      userId,
      question: {
        topics: { some: { topicId } },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { result: { select: { score: true } } },
  })

  if (recent.length === 0) return

  const scores = recent.map((a) => a.result?.score ?? 0)

  // Recovery: last 3 attempts all scored ≥ 60 → resolve open flag
  if (
    recent.length >= 3 &&
    scores.slice(0, 3).every((s) => s >= 60)
  ) {
    await prisma.weakArea.updateMany({
      where: { userId, systemDesignTopicId: topicId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    })
    return
  }

  const failureRate = scores.filter((s) => s < 40).length / scores.length
  const latestScore = scores[0]

  // failing: >40% scored below 40, sample size > 3
  if (failureRate > 0.4 && recent.length > 3) {
    await flagSystemDesign({ userId, topicId, reason: 'failing', severity: 3 })
    return
  }

  // low score on latest attempt with prior history
  if (latestScore < 40 && recent.length > 1) {
    await flagSystemDesign({ userId, topicId, reason: 'slow', severity: 2 })
  }
}

async function flagSystemDesign(args: {
  userId: string
  topicId: string
  reason: 'failing' | 'slow' | 'confused'
  severity: number
}): Promise<void> {
  const { userId, topicId, reason, severity } = args

  const existing = await prisma.weakArea.findFirst({
    where: { userId, systemDesignTopicId: topicId, resolvedAt: null },
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
    data: { userId, systemDesignTopicId: topicId, reason, severity },
  })
}
