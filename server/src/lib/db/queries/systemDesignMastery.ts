import type { Prisma } from '@prisma/client'
import { blendScore } from './mastery'

interface UpsertSystemDesignProgressArgs {
  userId: string
  topicIds: string[]  // all topics linked to the attempted question
  score: number       // 0-100 from the AI evaluator
}

/**
 * Upsert SystemDesignProgress for every topic linked to the attempted question.
 * Uses the same EMA blend as DSA mastery: newScore = round(old * 0.7 + sample * 0.3)
 *
 * All updates run inside the caller's transaction so they stay atomic with the
 * attempt + result writes.
 */
export async function upsertSystemDesignProgressInTx(
  tx: Prisma.TransactionClient,
  args: UpsertSystemDesignProgressArgs
): Promise<void> {
  const { userId, topicIds, score } = args

  await Promise.all(
    topicIds.map(async (topicId) => {
      const existing = await tx.systemDesignProgress.findUnique({
        where: { userId_topicId: { userId, topicId } },
      })

      if (existing) {
        await tx.systemDesignProgress.update({
          where: { id: existing.id },
          data: {
            masteryScore: blendScore(existing.masteryScore, score),
            attemptCount: { increment: 1 },
            lastReviewed: new Date(),
          },
        })
      } else {
        await tx.systemDesignProgress.create({
          data: {
            userId,
            topicId,
            masteryScore: score,
            attemptCount: 1,
          },
        })
      }
    })
  )
}
