/**
 * In-memory AI call log — circular buffer of the last 200 calls.
 *
 * Captures every request made to OpenRouter: use-case, model, latency,
 * status, prompt/response previews, and fallback information.
 * Cache hits are recorded as first-class entries (model: 'cache', status: 'cache_hit').
 * Exposed via GET /api/admin/ai-logs for inspection.
 */

export interface AiCallRecord {
  id: number
  ts: string               // ISO timestamp
  useCase: string          // 'chat' | 'evaluation' | 'recommendation' | 'roadmap'
  model: string            // exact model string used, or 'cache' for cache hits
  wasFallback: boolean
  cacheHit?: true          // present only on cache hit records
  status: 'success' | 'error' | 'fallback_success' | 'fallback_error' | 'cache_hit'
  latencyMs: number
  promptPreview: string    // first 300 chars of the user prompt
  responsePreview: string  // first 300 chars of the response (or error message)
  approxPromptChars: number
  approxResponseChars: number
}

const MAX = 200
const log: AiCallRecord[] = []
let seq = 0

export function recordAiCall(entry: Omit<AiCallRecord, 'id' | 'ts'>): void {
  seq += 1
  log.push({ id: seq, ts: new Date().toISOString(), ...entry })
  if (log.length > MAX) log.shift()
}

export function recordCacheHit(entry: {
  useCase: string
  promptPreview: string
  approxPromptChars: number
}): void {
  seq += 1
  log.push({
    id: seq,
    ts: new Date().toISOString(),
    useCase: entry.useCase,
    model: 'cache',
    wasFallback: false,
    cacheHit: true,
    status: 'cache_hit',
    latencyMs: 0,
    promptPreview: entry.promptPreview,
    responsePreview: '(served from cache)',
    approxPromptChars: entry.approxPromptChars,
    approxResponseChars: 0,
  })
  if (log.length > MAX) log.shift()
}

export function getAiLogs(limit = 50): AiCallRecord[] {
  return log.slice(-Math.min(limit, MAX)).reverse()
}

export function clearAiLogs(): void {
  log.length = 0
}

export function getAiStats() {
  if (log.length === 0) return { total: 0 }
  const cacheHits = log.filter((r) => r.cacheHit).length
  const liveCalls = log.filter((r) => !r.cacheHit)
  const fallbacks = liveCalls.filter((r) => r.wasFallback).length
  const errors = liveCalls.filter((r) => r.status.includes('error')).length
  const byUseCase: Record<string, number> = {}
  const byModel: Record<string, number> = {}
  let totalLatency = 0
  for (const r of liveCalls) {
    byUseCase[r.useCase] = (byUseCase[r.useCase] ?? 0) + 1
    byModel[r.model] = (byModel[r.model] ?? 0) + 1
    totalLatency += r.latencyMs
  }
  return {
    total: log.length,
    cacheHits,
    fallbacks,
    errors,
    avgLatencyMs: liveCalls.length > 0 ? Math.round(totalLatency / liveCalls.length) : 0,
    byUseCase,
    byModel,
  }
}
