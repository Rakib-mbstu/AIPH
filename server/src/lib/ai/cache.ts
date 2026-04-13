/**
 * AI response cache — Redis-ready.
 *
 * Currently backed by an in-memory Map. To swap to Redis:
 *   1. npm install ioredis
 *   2. Implement RedisCache below (get/set/del map 1-to-1 to GET/SETEX/DEL)
 *   3. Replace `export const aiCache = new InMemoryCache()` with your RedisCache
 *   4. Move _userIndex to Redis sets (SADD/SMEMBERS → DEL each key)
 *
 * The rest of the codebase imports only the named exports below — no changes
 * needed anywhere else when swapping backends.
 */

// =============================================================================
// Backend interface
// =============================================================================

export interface AiCacheBackend {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlMs: number): Promise<void>
  del(key: string): Promise<void>
}

// =============================================================================
// In-memory implementation
// =============================================================================

class InMemoryCache implements AiCacheBackend {
  private readonly store = new Map<string, { value: string; expiresAt: number }>()

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }
}

// =============================================================================
// Singleton — swap this line to connect Redis
// =============================================================================

export const aiCache: AiCacheBackend = new InMemoryCache()

// =============================================================================
// User-scoped invalidation
// =============================================================================
//
// Secondary index: userId → Set<cacheKey>
// When a user's data changes (e.g. new attempt submitted) call
// invalidateUserCache to bust their stale recommendation/roadmap responses.
//
// Redis equivalent:
//   tagUserKey    → SADD cache:user:{userId}:keys {cacheKey}
//   invalidate    → SMEMBERS → DEL each key, then DEL the set itself

const _userIndex = new Map<string, Set<string>>()

export function tagUserKey(userId: string, cacheKey: string): void {
  if (!_userIndex.has(userId)) _userIndex.set(userId, new Set())
  _userIndex.get(userId)!.add(cacheKey)
}

export async function invalidateUserCache(userId: string): Promise<void> {
  const keys = _userIndex.get(userId)
  if (!keys || keys.size === 0) return
  await Promise.all([...keys].map((k) => aiCache.del(k)))
  _userIndex.delete(userId)
}
