import { prisma } from '../../../index'

/**
 * Pattern mastery + trend helper.
 *
 * Returns every pattern with the user's mastery row and a `recentScores`
 * array — the last 10 attempt scores on problems canonically tagged with
 * that pattern, chronological oldest→newest. The UI renders this as a
 * sparkline so users can see trajectory (flat = consistent, climbing =
 * learning, dropping = backsliding).
 *
 * Scoring rule (matches mastery.ts EMA sample):
 *   - failed attempts  → 0
 *   - other attempts   → aiScore (or 0 if the submission was never evaluated)
 *
 * Why canonical pattern, not `submission.patternIdentified`?
 * The canonical pattern is stable and indexable. The AI-identified pattern
 * is free text that may not match any Pattern row. Mastery score in the DB
 * already captures the AI-identified nuance; the trend line is the user's
 * journey through "problems tagged X" and is more explainable in the UI.
 *
 * Performance: single findMany across the user's attempts, grouped in-memory.
 * For MVP volumes (tens of attempts), this is cheaper than N per-pattern queries.
 */
export async function getPatternsWithTrends(userId: string) {
  const [patterns, masteryRows, attempts] = await Promise.all([
    prisma.pattern.findMany({ orderBy: { name: 'asc' } }),
    prisma.patternMastery.findMany({ where: { userId } }),
    prisma.attempt.findMany({
      where: { userId },
      select: {
        status: true,
        createdAt: true,
        submission: { select: { aiScore: true } },
        problem: { select: { patternId: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const masteryByPattern = new Map(masteryRows.map((m) => [m.patternId, m]))

  // Group scores by canonical patternId
  const scoresByPattern = new Map<string, number[]>()
  for (const a of attempts) {
    const sample = a.status === 'failed' ? 0 : a.submission?.aiScore ?? 0
    const arr = scoresByPattern.get(a.problem.patternId) ?? []
    arr.push(sample)
    scoresByPattern.set(a.problem.patternId, arr)
  }
  // Keep only last 10 per pattern (chronological order preserved)
  for (const [k, v] of scoresByPattern) {
    if (v.length > 10) scoresByPattern.set(k, v.slice(-10))
  }

  return patterns.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    mastery: masteryByPattern.get(p.id) ?? null,
    recentScores: scoresByPattern.get(p.id) ?? [],
  }))
}
