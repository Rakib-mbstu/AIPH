import { prisma } from '../../index'

/**
 * Phase 1 "Today's Plan" — deterministic, weakness-first selection.
 *
 * Picks 2 problems for the user:
 *   - 1 problem from the highest-severity weak topic (if any)
 *   - 1 problem from a topic the user has touched but not mastered (< 80)
 *
 * Falls back to any unattempted problems when there isn't enough signal.
 * Phase 3 replaces this with the LLM-driven recommendation engine.
 */
export interface PlanItem {
  problemId: string
  title: string
  reason: string
}

export async function buildTodaysPlan(userId: string): Promise<PlanItem[]> {
  const plan: PlanItem[] = []

  // 1. Highest-severity unresolved weak area → grab one matching problem
  const weakest = await prisma.weakArea.findFirst({
    where: { userId, resolvedAt: null, topicId: { not: null } },
    orderBy: [{ severity: 'desc' }, { detectedAt: 'desc' }],
  })

  const recentlyAttempted = await prisma.attempt.findMany({
    where: { userId },
    select: { problemId: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const skip = new Set(recentlyAttempted.map((a) => a.problemId))

  if (weakest?.topicId) {
    const problem = await prisma.problem.findFirst({
      where: { topicId: weakest.topicId, id: { notIn: [...skip] } },
      orderBy: { difficulty: 'asc' },
    })
    if (problem) {
      plan.push({
        problemId: problem.id,
        title: problem.title,
        reason: `Targets your weak area (${weakest.reason}) — rebuild confidence with an easier ${problem.difficulty}.`,
      })
      skip.add(problem.id)
    }
  }

  // 2. A topic in progress but not yet mastered (mastery < 80)
  const inProgress = await prisma.topicProgress.findFirst({
    where: { userId, masteryScore: { lt: 80, gt: 0 } },
    orderBy: { masteryScore: 'asc' },
    include: { topic: true },
  })

  if (inProgress) {
    const problem = await prisma.problem.findFirst({
      where: { topicId: inProgress.topicId, id: { notIn: [...skip] } },
      orderBy: { difficulty: 'asc' },
    })
    if (problem) {
      plan.push({
        problemId: problem.id,
        title: problem.title,
        reason: `Push ${inProgress.topic.name} mastery (${inProgress.masteryScore}/100) toward 80.`,
      })
      skip.add(problem.id)
    }
  }

  // 3. Backfill with any untouched problem if we're below 2
  while (plan.length < 2) {
    const fallback = await prisma.problem.findFirst({
      where: { id: { notIn: [...skip] } },
      orderBy: { createdAt: 'asc' },
    })
    if (!fallback) break
    plan.push({
      problemId: fallback.id,
      title: fallback.title,
      reason: 'Fresh problem to keep your reps up.',
    })
    skip.add(fallback.id)
  }

  return plan
}
