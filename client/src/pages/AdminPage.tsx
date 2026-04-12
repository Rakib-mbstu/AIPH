import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import type { AiCallRecord, AiStats } from '../lib/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  success:          'bg-green-100 text-green-800',
  fallback_success: 'bg-yellow-100 text-yellow-800',
  error:            'bg-red-100 text-red-800',
  fallback_error:   'bg-red-200 text-red-900',
}

const USE_CASE_COLORS: Record<string, string> = {
  chat:           'bg-indigo-100 text-indigo-800',
  evaluation:     'bg-purple-100 text-purple-800',
  recommendation: 'bg-blue-100 text-blue-800',
  roadmap:        'bg-teal-100 text-teal-800',
}

const USE_CASE_BAR_COLORS: Record<string, string> = {
  chat:           'bg-indigo-400',
  evaluation:     'bg-purple-400',
  recommendation: 'bg-blue-400',
  roadmap:        'bg-teal-400',
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  )
}

function fmtTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, accent = false,
}: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`text-2xl font-bold ${accent ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

// ─── Mini latency bar chart (last 40 calls) ───────────────────────────────────

function LatencyChart({ logs }: { logs: AiCallRecord[] }) {
  const recent = [...logs].reverse().slice(0, 40)
  if (recent.length === 0) return null
  const max = Math.max(...recent.map((r) => r.latencyMs), 1)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Latency — last {recent.length} calls (ms)
      </div>
      <div className="flex items-end gap-0.5 h-16">
        {recent.map((r) => {
          const pct = (r.latencyMs / max) * 100
          const color =
            r.status.includes('error')
              ? 'bg-red-400'
              : USE_CASE_BAR_COLORS[r.useCase] ?? 'bg-gray-300'
          return (
            <div
              key={r.id}
              title={`${r.useCase} · ${r.latencyMs} ms · ${r.status}`}
              className={`flex-1 rounded-sm ${color} opacity-80 hover:opacity-100 transition-opacity cursor-default`}
              style={{ height: `${Math.max(pct, 4)}%` }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>oldest</span>
        <span>newest</span>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3">
        {Object.entries(USE_CASE_BAR_COLORS).map(([uc, color]) => (
          <div key={uc} className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className={`w-2.5 h-2.5 rounded-sm ${color}`} />
            {uc}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-400" />
          error
        </div>
      </div>
    </div>
  )
}

// ─── Per-use-case latency table ───────────────────────────────────────────────

function UseCaseBreakdown({ logs }: { logs: AiCallRecord[] }) {
  if (logs.length === 0) return null
  const useCases = [...new Set(logs.map((r) => r.useCase))]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Per use-case breakdown
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-gray-400 border-b border-gray-100">
            <th className="text-left pb-2 font-medium">Use-case</th>
            <th className="text-right pb-2 font-medium">Calls</th>
            <th className="text-right pb-2 font-medium">Avg ms</th>
            <th className="text-right pb-2 font-medium">Errors</th>
            <th className="text-right pb-2 font-medium">Fallbacks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {useCases.map((uc) => {
            const rows = logs.filter((r) => r.useCase === uc)
            const avg = Math.round(rows.reduce((s, r) => s + r.latencyMs, 0) / rows.length)
            const errs = rows.filter((r) => r.status.includes('error')).length
            const fbs = rows.filter((r) => r.wasFallback).length
            return (
              <tr key={uc}>
                <td className="py-1.5">
                  <Badge label={uc} colorClass={USE_CASE_COLORS[uc] ?? 'bg-gray-100 text-gray-700'} />
                </td>
                <td className="py-1.5 text-right tabular-nums text-gray-700">{rows.length}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-700">{avg.toLocaleString()}</td>
                <td className={`py-1.5 text-right tabular-nums ${errs > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                  {errs}
                </td>
                <td className={`py-1.5 text-right tabular-nums ${fbs > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
                  {fbs}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Expandable log row ───────────────────────────────────────────────────────

function LogRow({ r }: { r: AiCallRecord }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <td className="px-3 py-2 text-xs whitespace-nowrap">
          <span className="font-medium text-gray-700">{fmtTime(r.ts)}</span>
          <span className="block text-gray-400">{fmtDate(r.ts)}</span>
        </td>
        <td className="px-3 py-2">
          <Badge
            label={r.useCase}
            colorClass={USE_CASE_COLORS[r.useCase] ?? 'bg-gray-100 text-gray-700'}
          />
        </td>
        <td className="px-3 py-2 text-xs text-gray-600 max-w-[160px] truncate" title={r.model}>
          {r.model.replace('openai/', '').replace('anthropic/', '')}
          {r.wasFallback && <span className="ml-1 text-yellow-600 font-semibold">↩fb</span>}
        </td>
        <td className="px-3 py-2">
          <Badge
            label={r.status.replace('_', ' ')}
            colorClass={STATUS_STYLES[r.status] ?? 'bg-gray-100 text-gray-700'}
          />
        </td>
        <td className="px-3 py-2 text-xs tabular-nums text-gray-700 text-right">
          {r.latencyMs.toLocaleString()} ms
        </td>
        <td className="px-3 py-2 text-xs text-gray-500 max-w-[220px] truncate">
          {r.promptPreview}
        </td>
        <td className="px-3 py-2 text-xs text-gray-400 text-right tabular-nums whitespace-nowrap">
          {(r.approxPromptChars / 1000).toFixed(1)}k&nbsp;/&nbsp;{(r.approxResponseChars / 1000).toFixed(1)}k
        </td>
        <td className="px-3 py-2 text-gray-400 text-center text-xs">{open ? '▲' : '▼'}</td>
      </tr>
      {open && (
        <tr className="bg-gray-50 border-b border-gray-100">
          <td colSpan={8} className="px-4 py-3">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-semibold text-gray-600 mb-1">Prompt preview</div>
                <pre className="whitespace-pre-wrap text-gray-700 bg-white border border-gray-200 rounded p-2 max-h-40 overflow-auto font-mono text-xs">
                  {r.promptPreview || '—'}
                </pre>
              </div>
              <div>
                <div className="font-semibold text-gray-600 mb-1">Response preview</div>
                <pre className="whitespace-pre-wrap text-gray-700 bg-white border border-gray-200 rounded p-2 max-h-40 overflow-auto font-mono text-xs">
                  {r.responsePreview || '—'}
                </pre>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-4">
              <span>Model: <span className="font-mono text-gray-600">{r.model}</span></span>
              <span>Record #<span className="text-gray-600">{r.id}</span></span>
              <span>Prompt: <span className="text-gray-600">{r.approxPromptChars.toLocaleString()} chars</span></span>
              <span>Response: <span className="text-gray-600">{r.approxResponseChars.toLocaleString()} chars</span></span>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [logs, setLogs]       = useState<AiCallRecord[]>([])
  const [stats, setStats]     = useState<AiStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('adminKey') ?? '')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [limit, setLimit]     = useState(100)
  const [ucFilter, setUcFilter] = useState('all')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const key = adminKey || undefined
    const [logsRes, statsRes] = await Promise.all([
      api.getAiLogs(limit, key),
      api.getAiStats(key),
    ])
    setLoading(false)
    if (logsRes.error) { setError(logsRes.error); return }
    setLogs(logsRes.data?.logs ?? [])
    setStats(statsRes.data ?? null)
  }, [adminKey, limit])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (autoRefresh) intervalRef.current = setInterval(load, 10_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, load])

  const handleClear = async () => {
    if (!confirm('Clear all in-memory AI logs?')) return
    await api.clearAiLogs(adminKey || undefined)
    load()
  }

  const handleKeyChange = (v: string) => {
    setAdminKey(v)
    localStorage.setItem('adminKey', v)
  }

  document.title = 'AI Monitor | AIPH'

  const filteredLogs = ucFilter === 'all' ? logs : logs.filter((r) => r.useCase === ucFilter)
  const useCases = ['all', ...Array.from(new Set(logs.map((r) => r.useCase)))]
  const errorRate = stats && stats.total > 0
    ? Math.round(((stats.errors ?? 0) / stats.total) * 100)
    : 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Call Monitor</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            In-memory log of the last 200 OpenRouter calls · resets on server restart
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setAutoRefresh((a) => !a)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              autoRefresh
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {autoRefresh ? '⏸ Auto (10s)' : '▶ Auto-refresh'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
          <button
            onClick={handleClear}
            className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
          >
            Clear logs
          </button>
        </div>
      </div>

      {/* ── Admin key ──────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-xs text-gray-500 whitespace-nowrap">Admin key:</label>
        <input
          type="password"
          value={adminKey}
          onChange={(e) => handleKeyChange(e.target.value)}
          placeholder="Leave blank if ADMIN_KEY env var is not set"
          className="text-xs border border-gray-200 rounded px-2 py-1.5 w-72 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error === 'forbidden'
            ? 'Access denied — set the correct Admin key above.'
            : `Error: ${error}`}
        </div>
      )}

      {/* ── Stats ──────────────────────────────────────────── */}
      {stats && stats.total === 0 && !error && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white px-6 py-10 text-center text-gray-400 text-sm">
          No AI calls recorded yet. Send a chat message or submit an attempt to see data here.
        </div>
      )}

      {stats && stats.total > 0 && (
        <div className="mb-8 space-y-4">
          {/* Top stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total calls" value={stats.total} />
            <StatCard
              label="Fallbacks"
              value={stats.fallbacks ?? 0}
              sub={`${stats.total ? Math.round(((stats.fallbacks ?? 0) / stats.total) * 100) : 0}% rate`}
            />
            <StatCard
              label="Errors"
              value={stats.errors ?? 0}
              sub={`${errorRate}% rate`}
              accent={(stats.errors ?? 0) > 0}
            />
            <StatCard
              label="Avg latency"
              value={stats.avgLatencyMs ? `${stats.avgLatencyMs.toLocaleString()} ms` : '—'}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LatencyChart logs={logs} />
            <UseCaseBreakdown logs={logs} />
          </div>

          {/* Model breakdown */}
          {stats.byModel && Object.keys(stats.byModel).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                By model
              </div>
              <div className="space-y-2">
                {Object.entries(stats.byModel)
                  .sort(([, a], [, b]) => b - a)
                  .map(([model, count]) => {
                    const pct = Math.round((count / stats.total) * 100)
                    return (
                      <div key={model} className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-600 w-56 truncate shrink-0" title={model}>
                          {model}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-indigo-400 h-2 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-gray-700 w-10 text-right shrink-0">
                          {count}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Log table ──────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Call log</span>
            <span className="text-xs text-gray-400">
              {filteredLogs.length} record{filteredLogs.length !== 1 ? 's' : ''} · click row to expand
            </span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={ucFilter}
              onChange={(e) => setUcFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {useCases.map((uc) => (
                <option key={uc} value={uc}>{uc === 'all' ? 'All use-cases' : uc}</option>
              ))}
            </select>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>Last {n}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            {loading ? 'Loading…' : 'No records match the current filter.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2 text-left font-medium">Time</th>
                  <th className="px-3 py-2 text-left font-medium">Use-case</th>
                  <th className="px-3 py-2 text-left font-medium">Model</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Latency</th>
                  <th className="px-3 py-2 text-left font-medium">Prompt preview</th>
                  <th className="px-3 py-2 text-right font-medium">Chars p/r</th>
                  <th className="px-3 py-2 w-6" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLogs.map((r) => <LogRow key={r.id} r={r} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
