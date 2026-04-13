import { prisma } from '../../../index'
import type { ChatContext } from '../../ai/client'

/**
 * Build the structured ChatContext payload sent to the LLM with every chat
 * request. Pulls the user's currently weak areas, top pattern masteries,
 * and recent successful patterns. Kept small on purpose — context bloat hurts
 * model attention more than it helps.
 */
export async function buildChatContext(userId: string): Promise<ChatContext> {
  const [weakAreas, patternMasteries, recentAttempts, sdWeakAreas, recentSdAttempts] =
    await Promise.all([
      prisma.weakArea.findMany({
        where: { userId, resolvedAt: null },
        include: { topic: true, pattern: true },
        orderBy: { severity: 'desc' },
        take: 5,
      }),
      prisma.patternMastery.findMany({
        where: { userId },
        include: { pattern: true },
        orderBy: { masteryScore: 'desc' },
        take: 10,
      }),
      prisma.attempt.findMany({
        where: { userId, status: 'solved' },
        include: { submission: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // System design: unresolved weak areas scoped to a SD topic
      prisma.weakArea.findMany({
        where: {
          userId,
          resolvedAt: null,
          systemDesignTopicId: { not: null },
        },
        orderBy: { severity: 'desc' },
        take: 3,
      }),
      // System design: last 3 attempts with question prompt for context
      prisma.systemDesignAttempt.findMany({
        where: { userId },
        include: { question: { select: { prompt: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ])

  // Resolve SD topic names for weak areas
  const sdTopicIds = sdWeakAreas
    .map((w) => w.systemDesignTopicId)
    .filter((id): id is string => id !== null)

  const sdTopics =
    sdTopicIds.length > 0
      ? await prisma.systemDesignTopic.findMany({
          where: { id: { in: sdTopicIds } },
          select: { id: true, name: true },
        })
      : []
  const sdTopicNameById = new Map(sdTopics.map((t) => [t.id, t.name]))

  const masteryScores: Record<string, number> = {}
  for (const pm of patternMasteries) {
    masteryScores[pm.pattern.name] = pm.masteryScore
  }

  const weakNames = weakAreas
    .map((w) => w.topic?.name ?? w.pattern?.name)
    .filter((n): n is string => Boolean(n))

  const recentPatterns = recentAttempts
    .map((a) => a.submission?.patternIdentified)
    .filter((p): p is string => Boolean(p))

  const systemDesignWeakAreas = sdWeakAreas
    .map((w) => (w.systemDesignTopicId ? sdTopicNameById.get(w.systemDesignTopicId) : undefined))
    .filter((n): n is string => Boolean(n))

  const recentSystemDesignAttempts = recentSdAttempts.map((a) =>
    a.question.prompt.slice(0, 60)
  )

  return {
    weakAreas: weakNames,
    masteryScores,
    recentPatterns,
    systemDesignWeakAreas,
    recentSystemDesignAttempts,
  }
}
