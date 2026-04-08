import { prisma } from '../../../index'
import type { ChatContext } from '../../ai/client'

/**
 * Build the structured ChatContext payload sent to the LLM with every chat
 * request. Pulls the user's currently weak areas, top pattern masteries,
 * and recent successful patterns. Kept small on purpose — context bloat hurts
 * model attention more than it helps.
 */
export async function buildChatContext(userId: string): Promise<ChatContext> {
  const [weakAreas, patternMasteries, recentAttempts] = await Promise.all([
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
  ])

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

  return {
    weakAreas: weakNames,
    masteryScores,
    recentPatterns,
  }
}
