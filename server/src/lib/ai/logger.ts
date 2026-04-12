/**
 * In-memory AI call log — circular buffer of the last 200 calls.
 *
 * Captures every request made to OpenRouter: use-case, model, latency,
 * status, prompt/response previews, and fallback information.
 * Exposed via GET /api/admin/ai-logs for inspection.
 */

export interface AiCallRecord {
  id: number
  ts: string               // ISO timestamp
  useCase: string          // 'chat' | 'evaluation' | 'recommendation' | 'roadmap'
  model: string            // exact model string used
  wasFallback: boolean
  status: 'success' | 'error' | 'fallback_success' | 'fallback_error'
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

export function getAiLogs(limit = 50): AiCallRecord[] {
  return log.slice(-Math.min(limit, MAX)).reverse()
}

export function clearAiLogs(): void {
  log.length = 0
}

export function getAiStats() {
  if (log.length === 0) return { total: 0 }
  const fallbacks = log.filter((r) => r.wasFallback).length
  const errors = log.filter((r) => r.status.includes('error')).length
  const byUseCase: Record<string, number> = {}
  const byModel: Record<string, number> = {}
  let totalLatency = 0
  for (const r of log) {
    byUseCase[r.useCase] = (byUseCase[r.useCase] ?? 0) + 1
    byModel[r.model] = (byModel[r.model] ?? 0) + 1
    totalLatency += r.latencyMs
  }
  return {
    total: log.length,
    fallbacks,
    errors,
    avgLatencyMs: Math.round(totalLatency / log.length),
    byUseCase,
    byModel,
  }
}
