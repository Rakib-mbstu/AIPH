import { prisma } from '../../index'

/**
 * Interview Readiness Score (Cycle E).
 *
 * Formula (from CLAUDE.md):
 *
 *   Readiness =
 *     (DSA Coverage      * 0.30) +
 *     (Difficulty Solved * 0.20) +
 *     (Consistency       * 0.15) +
 *     (Mock Performance  * 0.20) +
 *     (System Design     * 0.15)
 *
 * Mock Performance and System Design are Phase 4 features — we don't have
 * data for them yet, so their sub-scores return 0 with `unscored: true`.
 * This means the displayed max is currently 65, not 100. We intentionally
 * do NOT redistribute weights: the gap is honest information to the user
 * ("you're strong on DSA but haven't touched mocks"). The UI shows each
 * sub-score explicitly so the source of the gap is visible.
 *
 * All sub-scores are 0–100 integers. The overall is rounded to an int.
 */

export interface ReadinessComponent {
  score: number
  weight: number
  unscored?: boolean
  detail?: string
}

export interface ReadinessResult {
  overall: number
  components: {
    dsaCoverage: ReadinessComponent
    difficultyHandled: ReadinessComponent
    consistency: ReadinessComponent
    mockPerformance: ReadinessComponent
    systemDesign: ReadinessComponent
  }
}

const WEIGHTS = {
  dsaCoverage: 0.3,
  difficultyHandled: 0.2,
  consistency: 0.15,
  mockPerformance: 0.2,
  systemDesign: 0.15,
} as const

export async function computeReadiness(userId: string): Promise<ReadinessResult> {
  const [topics, topicProgress, attempts] = await Promise.all([
    prisma.topic.findMany({ select: { id: true } }),
    prisma.topicProgress.findMany({ where: { userId } }),
    prisma.attempt.findMany({
      where: { userId },
      select: {
        status: true,
        createdAt: true,
        problem: { select: { difficulty: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
  ])

  const dsaCoverage = computeDsaCoverage(topics.length, topicProgress)
  const difficultyHandled = computeDifficultyHandled(attempts)
  const consistency = computeConsistency(attempts)

  const mockPerformance: ReadinessComponent = {
    score: 0,
    weight: WEIGHTS.mockPerformance,
    unscored: true,
    detail: 'Mock interview mode lands in Phase 4',
  }
  const systemDesign: ReadinessComponent = {
    score: 0,
    weight: WEIGHTS.systemDesign,
    unscored: true,
    detail: 'System design tracking lands in Phase 4',
  }

  const overall = Math.round(
    dsaCoverage.score * dsaCoverage.weight +
      difficultyHandled.score * difficultyHandled.weight +
      consistency.score * consistency.weight +
      mockPerformance.score * mockPerformance.weight +
      systemDesign.score * systemDesign.weight
  )

  return {
    overall,
    components: {
      dsaCoverage,
      difficultyHandled,
      consistency,
      mockPerformance,
      systemDesign,
    },
  }
}

// ============================================================================
// Sub-scores
// ============================================================================

/**
 * DSA Coverage = mean of topic mastery scores across ALL topics (untouched
 * topics count as 0). Rewards both breadth (touching more topics) and depth
 * (pushing mastery higher), which matches the "coverage" intuition.
 */
function computeDsaCoverage(
  totalTopics: number,
  progress: Array<{ masteryScore: number }>
): ReadinessComponent {
  if (totalTopics === 0) {
    return {
      score: 0,
      weight: WEIGHTS.dsaCoverage,
      detail: 'No topics seeded',
    }
  }
  const sum = progress.reduce((acc, p) => acc + p.masteryScore, 0)
  const score = Math.round(sum / totalTopics)
  const touched = progress.filter((p) => p.masteryScore > 0).length
  return {
    score,
    weight: WEIGHTS.dsaCoverage,
    detail: `${touched}/${totalTopics} topics started`,
  }
}

/**
 * Difficulty Handled measures how hard the problems are that the user
 * actually solves. Maxes out at 10 easy + 10 medium + 5 hard:
 *
 *   easy:   up to 30 points  (min(solved, 10) * 3)
 *   medium: up to 40 points  (min(solved, 10) * 4)
 *   hard:   up to 30 points  (min(solved, 5)  * 6)
 *
 * Beyond the caps, grinding more easies doesn't move the score — you have
 * to reach for the next tier. This mirrors how interviewers think about
 * readiness: "can they handle a hard?"
 */
function computeDifficultyHandled(
  attempts: Array<{ status: string; problem: { difficulty: string } }>
): ReadinessComponent {
  const solved = attempts.filter((a) => a.status === 'solved')
  let easy = 0
  let medium = 0
  let hard = 0
  for (const a of solved) {
    const d = a.problem.difficulty.toLowerCase()
    if (d === 'easy') easy++
    else if (d === 'medium') medium++
    else if (d === 'hard') hard++
  }
  const easyPts = Math.min(easy, 10) * 3
  const mediumPts = Math.min(medium, 10) * 4
  const hardPts = Math.min(hard, 5) * 6
  const score = Math.min(100, easyPts + mediumPts + hardPts)
  return {
    score,
    weight: WEIGHTS.difficultyHandled,
    detail: `${easy} easy · ${medium} medium · ${hard} hard solved`,
  }
}

/**
 * Consistency = fraction of the last 14 days with at least one attempt,
 * rescaled to 0–100. Matches the same UTC-day bucketing as the streak
 * calculator so the two numbers can't contradict each other.
 *
 * 14 days is the window the user most intuitively feels: "how's my past
 * two weeks been?" Anything shorter is noisy; anything longer forgives
 * inactivity too readily.
 */
function computeConsistency(
  attempts: Array<{ createdAt: Date }>
): ReadinessComponent {
  const WINDOW_DAYS = 14
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const cutoff = new Date(today)
  cutoff.setUTCDate(today.getUTCDate() - (WINDOW_DAYS - 1))

  const activeDays = new Set<string>()
  for (const a of attempts) {
    if (a.createdAt < cutoff) continue
    activeDays.add(a.createdAt.toISOString().slice(0, 10))
  }

  const score = Math.round((activeDays.size / WINDOW_DAYS) * 100)
  return {
    score,
    weight: WEIGHTS.consistency,
    detail: `${activeDays.size}/${WINDOW_DAYS} days active`,
  }
}
