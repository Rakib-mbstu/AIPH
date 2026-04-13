import { prisma } from '../../index'
import {
  recommendProblems,
  type RecommendationCandidate,
} from '../ai/client'
import { buildTodaysPlan, type PlanItem } from './todaysPlan'

/**
 * LLM-driven recommendation engine.
 *
 * Phase 1 used a deterministic 2-problem rotation (`buildTodaysPlan`). This
 * module replaces that with a model call that ranks a candidate pool against
 * the user's mastery + weak areas. The deterministic builder is kept as the
 * fallback when the AI errors, the pool is empty, or the user has no signal
 * yet (cold start).
 *
 * Design notes
 * ------------
 * - The candidate pool is assembled here, NOT in the prompt. We keep it small
 *   (≤ 25) and skip anything attempted in the user's last 20 sessions. Smaller
 *   pools = better attention + cheaper calls.
 * - The pool is biased toward weak topics first, then in-progress topics, then
 *   any untouched problems. This means the model is choosing from a list that
 *   already reflects priorities — we're not asking it to do everything.
 * - We map AI recommendations back to full Problem rows server-side. The model
 *   only ever sees a stripped-down candidate shape, so it can't hallucinate
 *   problems that don't exist.
 */

export interface RankedRecommendation {
  problemId: string
  title: string
  difficulty: string
  topic: string
  pattern: string
  reason: string
  priority: number
  estimatedMinutes: number
  source: string | null
}

const POOL_CAP = 25

export async function recommendForUser(
  userId: string,
  limit = 5,
  filters?: { topic?: string; pattern?: string }
): Promise<RankedRecommendation[]> {
  // ---- 1. Skip set: anything attempted in the last 20 sessions ----
  const recentlyAttempted = await prisma.attempt.findMany({
    where: { userId },
    select: { problemId: true, problem: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const skipIds = new Set(recentlyAttempted.map((a) => a.problemId))
  const recentTitles = recentlyAttempted.slice(0, 5).map((a) => a.problem.title)

  // ---- 2. Weak areas + pattern mastery for context ----
  const [weakAreas, patternMasteries, topicProgress] = await Promise.all([
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
    prisma.topicProgress.findMany({
      where: { userId, masteryScore: { gt: 0, lt: 80 } },
      orderBy: { masteryScore: 'asc' },
      take: 5,
    }),
  ])

  const patternMastery: Record<string, number> = {}
  for (const pm of patternMasteries) {
    patternMastery[pm.pattern.name] = pm.masteryScore
  }

  const weakAreaNames = weakAreas
    .map((w) => w.topic?.name ?? w.pattern?.name)
    .filter((n): n is string => Boolean(n))

  // ---- 3. Build candidate pool (weak topics → in-progress → backfill) ----
  const weakTopicIds = weakAreas
    .map((w) => w.topicId)
    .filter((id): id is string => Boolean(id))
  const progressTopicIds = topicProgress.map((p) => p.topicId)
  const priorityTopicIds = [
    ...new Set([...weakTopicIds, ...progressTopicIds]),
  ]

  const pool: RecommendationCandidate[] = []
  // Track source URLs separately — source is not sent to the LLM
  const sourceMap = new Map<string, string | null>()

  // Filter bias: prepend problems from requested topic/pattern first
  if (filters?.topic || filters?.pattern) {
    const biasProblems = await prisma.problem.findMany({
      where: {
        id: { notIn: [...skipIds] },
        ...(filters.topic ? { topic: { name: { contains: filters.topic, mode: 'insensitive' } } } : {}),
        ...(filters.pattern ? { pattern: { name: { contains: filters.pattern, mode: 'insensitive' } } } : {}),
      },
      include: { topic: true, pattern: true },
      take: POOL_CAP,
    })
    for (const p of biasProblems) sourceMap.set(p.id, p.source)
    pool.push(...biasProblems.map(toCandidate))
  }

  if (pool.length < POOL_CAP && priorityTopicIds.length > 0) {
    const priorityProblems = await prisma.problem.findMany({
      where: {
        topicId: { in: priorityTopicIds },
        id: { notIn: [...skipIds, ...pool.map((p) => p.problemId)] },
      },
      include: { topic: true, pattern: true },
      take: POOL_CAP - pool.length,
    })
    for (const p of priorityProblems) sourceMap.set(p.id, p.source)
    pool.push(...priorityProblems.map(toCandidate))
  }

  if (pool.length < POOL_CAP) {
    const backfill = await prisma.problem.findMany({
      where: {
        id: { notIn: [...skipIds, ...pool.map((p) => p.problemId)] },
      },
      include: { topic: true, pattern: true },
      take: POOL_CAP - pool.length,
      orderBy: { createdAt: 'asc' },
    })
    for (const p of backfill) sourceMap.set(p.id, p.source)
    pool.push(...backfill.map(toCandidate))
  }

  // ---- 4. Cold start: not enough signal → bail to deterministic ----
  if (pool.length === 0) return []

  // ---- 5. Call the LLM ----
  let recommendations: RankedRecommendation[] = []
  try {
    const result = await recommendProblems({
      currentTopic: topicProgress[0]
        ? (await prisma.topic.findUnique({ where: { id: topicProgress[0].topicId } }))
            ?.name
        : undefined,
      weakAreas: weakAreaNames,
      patternMastery,
      recentProblems: recentTitles,
      problemPool: pool,
    }, userId)

    // Map AI output back to full Problem rows. Drop anything the model
    // hallucinated that isn't in our pool.
    const poolById = new Map(pool.map((p) => [p.problemId, p]))
    recommendations = result.recommendations
      .filter((r) => poolById.has(r.problemId))
      .slice(0, limit)
      .map((r) => {
        const c = poolById.get(r.problemId)!
        return {
          problemId: c.problemId,
          title: c.title,
          difficulty: c.difficulty,
          topic: c.topic,
          pattern: c.pattern,
          reason: r.reason,
          priority: r.priority,
          estimatedMinutes: r.estimatedMinutes,
          source: sourceMap.get(c.problemId) ?? null,
        }
      })
  } catch (err) {
    console.warn(
      '[recommendation/engine] LLM call failed, falling back to deterministic:',
      err instanceof Error ? err.message : err
    )
  }

  return recommendations
}

/**
 * Convenience wrapper for the tracker's "Today's Plan" surface. Returns 2-3
 * items in the legacy `PlanItem` shape so the existing UI keeps working.
 * Falls back to `buildTodaysPlan` when the LLM produces nothing.
 */
export async function buildTodaysPlanWithAI(userId: string): Promise<PlanItem[]> {
  const ranked = await recommendForUser(userId, 3)
  if (ranked.length > 0) {
    return ranked.map((r) => ({
      problemId: r.problemId,
      title: r.title,
      reason: r.reason,
    }))
  }
  // Cold start or LLM failure → deterministic fallback
  return buildTodaysPlan(userId)
}

function toCandidate(p: {
  id: string
  title: string
  difficulty: string
  topic: { name: string }
  pattern: { name: string }
}): RecommendationCandidate {
  return {
    problemId: p.id,
    title: p.title,
    difficulty: p.difficulty,
    topic: p.topic.name,
    pattern: p.pattern.name,
  }
}
