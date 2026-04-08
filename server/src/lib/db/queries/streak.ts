import { prisma } from '../../../index'

/**
 * Count consecutive days (ending today or yesterday) with at least one Attempt.
 * "Yesterday" still counts so the streak doesn't reset before the user has a
 * chance to log today's session.
 */
export async function calculateStreakDays(userId: string): Promise<number> {
  const attempts = await prisma.attempt.findMany({
    where: { userId },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 365, // hard cap; nobody is doing a 1-year streak in MVP
  })

  if (attempts.length === 0) return 0

  // Build a Set of unique YYYY-MM-DD strings (UTC)
  const days = new Set<string>()
  for (const a of attempts) {
    days.add(a.createdAt.toISOString().slice(0, 10))
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  // If neither today nor yesterday has activity, streak is 0
  const todayKey = today.toISOString().slice(0, 10)
  const yesterday = new Date(today)
  yesterday.setUTCDate(today.getUTCDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)

  let cursor: Date
  if (days.has(todayKey)) cursor = today
  else if (days.has(yesterdayKey)) cursor = yesterday
  else return 0

  let streak = 0
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}
