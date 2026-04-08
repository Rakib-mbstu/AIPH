import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Mastery uses an exponential moving average so a single bad day doesn't
 * crater a topic and a single great day doesn't make us cocky.
 *   newScore = round(old * 0.7 + sample * 0.3)
 *
 * Sample is `aiScore` for solved attempts; for failed attempts the sample
 * is 0 (we want failures to drag the score down, not be ignored).
 */
export function blendScore(oldScore: number, sample: number): number {
  return Math.round(oldScore * 0.7 + sample * 0.3)
}

interface UpsertArgs {
  userId: string
  topicId: string
  patternId: string
  status: string // 'solved' | 'attempted' | 'failed'
  solveTime: number // minutes
  aiScore: number // 0-100 from evaluator
}

/**
 * Upsert TopicProgress + PatternMastery in lockstep with an attempt write.
 * Caller passes a Prisma transaction client (`tx`) so the whole batch is atomic.
 */
export async function upsertMasteryInTx(
  tx: Prisma.TransactionClient,
  args: UpsertArgs
) {
  const { userId, topicId, patternId, status, solveTime, aiScore } = args
  const sample = status === 'failed' ? 0 : aiScore
  const solved = status === 'solved' ? 1 : 0

  // --- TopicProgress ---
  const topicExisting = await tx.topicProgress.findUnique({
    where: { userId_topicId: { userId, topicId } },
  })

  if (topicExisting) {
    const newAvg =
      topicExisting.averageSolveTime != null
        ? Math.round(
            (topicExisting.averageSolveTime * topicExisting.attemptCount + solveTime) /
              (topicExisting.attemptCount + 1)
          )
        : solveTime
    await tx.topicProgress.update({
      where: { id: topicExisting.id },
      data: {
        masteryScore: blendScore(topicExisting.masteryScore, sample),
        attemptCount: { increment: 1 },
        successCount: { increment: solved },
        averageSolveTime: newAvg,
        lastReviewed: new Date(),
      },
    })
  } else {
    await tx.topicProgress.create({
      data: {
        userId,
        topicId,
        masteryScore: sample,
        attemptCount: 1,
        successCount: solved,
        averageSolveTime: solveTime,
      },
    })
  }

  // --- PatternMastery ---
  const patternExisting = await tx.patternMastery.findUnique({
    where: { userId_patternId: { userId, patternId } },
  })

  if (patternExisting) {
    const newAvg =
      patternExisting.averageSolveTime != null
        ? Math.round(
            (patternExisting.averageSolveTime * patternExisting.attemptCount + solveTime) /
              (patternExisting.attemptCount + 1)
          )
        : solveTime
    await tx.patternMastery.update({
      where: { id: patternExisting.id },
      data: {
        masteryScore: blendScore(patternExisting.masteryScore, sample),
        confidenceScore: blendScore(patternExisting.confidenceScore, solved * 100),
        attemptCount: { increment: 1 },
        solvedCount: { increment: solved },
        averageSolveTime: newAvg,
        lastReviewed: new Date(),
      },
    })
  } else {
    await tx.patternMastery.create({
      data: {
        userId,
        patternId,
        masteryScore: sample,
        confidenceScore: solved * 100,
        attemptCount: 1,
        solvedCount: solved,
        averageSolveTime: solveTime,
      },
    })
  }
}

// Re-export for convenience
export type { PrismaClient }
