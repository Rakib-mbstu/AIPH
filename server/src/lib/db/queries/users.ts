import { prisma } from '../../../index'

/**
 * Resolve a Clerk user to a local DB User, creating one (and an empty profile)
 * on first sight. Every protected route should call this to translate the
 * Clerk JWT's `userId` into our internal `User.id` before touching relations.
 */
export async function getOrCreateUser(clerkId: string, email: string) {
  const existing = await prisma.user.findUnique({
    where: { clerkId },
    include: { profile: true },
  })

  if (existing) return existing

  return prisma.user.create({
    data: {
      clerkId,
      email,
      profile: { create: {} },
    },
    include: { profile: true },
  })
}
