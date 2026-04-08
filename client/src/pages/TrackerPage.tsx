import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  api,
  type ProgressResponse,
  type AttemptRecord,
  type WeakAreaRecord,
  type PlanItem,
} from '../lib/api'

/**
 * Progress Tracker — the home base.
 *
 * Sections:
 *   1. Today's Plan       — prescriptive next steps
 *   2. Streak             — consecutive days with at least one attempt
 *   3. Recent Activity    — last 5 attempts with AI score badges
 *   4. Weak Areas         — open flags from the detection engine
 *   5. Readiness Score    — Phase 3 placeholder
 */
export default function TrackerPage() {
  const { getToken } = useAuth()
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await getToken()
      if (!token) {
        setError('Not signed in')
        setLoading(false)
        return
      }
      const res = await api.getProgress(token)
      if (cancelled) return
      if (res.error) setError(res.error)
      else setData(res.data ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [getToken])

  if (loading) return <div className="p-8 text-gray-500">Loading tracker…</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>
  if (!data) return <div className="p-8 text-gray-500">No data yet — submit your first attempt.</div>

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Progress Tracker</h1>
          <p className="text-gray-600 mt-1">Your home base for daily prep.</p>
        </div>
        <StreakBadge days={data.streakDays} />
      </header>

      <TodaysPlanSection items={data.todaysPlan} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivitySection attempts={data.recentAttempts} />
        <WeakAreasSection weakAreas={data.weakAreas} />
      </div>

      <ReadinessPlaceholder />
    </div>
  )
}

// ---------- Sections ----------

function TodaysPlanSection({ items }: { items: PlanItem[] }) {
  return (
    <section className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Today's Plan</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nothing prescribed yet — solve a few problems to seed the engine.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((p, i) => (
            <li key={p.problemId} className="flex gap-3">
              <span className="flex-none w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{p.title}</div>
                <div className="text-sm text-gray-600">{p.reason}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RecentActivitySection({ attempts }: { attempts: AttemptRecord[] }) {
  return (
    <section className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h2>
      {attempts.length === 0 ? (
        <p className="text-sm text-gray-500">No attempts yet.</p>
      ) : (
        <ul className="space-y-3">
          {attempts.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate">
                  {a.problem.title}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {a.problem.topic.name} · {a.problem.difficulty} · {a.solveTime}m
                  {a.submission?.patternIdentified &&
                    ` · ${a.submission.patternIdentified}`}
                </div>
              </div>
              <ScoreBadge status={a.status} score={a.submission?.aiScore ?? null} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function WeakAreasSection({ weakAreas }: { weakAreas: WeakAreaRecord[] }) {
  return (
    <section className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Weak Areas</h2>
      {weakAreas.length === 0 ? (
        <p className="text-sm text-gray-500">
          No flagged areas. Keep it up.
        </p>
      ) : (
        <ul className="space-y-2">
          {weakAreas.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate">
                  {w.topic?.name ?? w.pattern?.name ?? 'Unknown'}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 capitalize">{w.reason}</div>
              </div>
              <SeverityBadge severity={w.severity} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ReadinessPlaceholder() {
  return (
    <section className="border border-dashed border-gray-300 rounded-lg p-5 bg-gray-50">
      <h2 className="text-lg font-semibold text-gray-700 mb-1">Readiness Score</h2>
      <p className="text-sm text-gray-500">
        Coming in Phase 3 — composite of DSA coverage, difficulty handled, consistency, mock performance, and system design.
      </p>
    </section>
  )
}

// ---------- Badges ----------

function StreakBadge({ days }: { days: number }) {
  return (
    <div className="text-right">
      <div className="text-3xl font-bold text-indigo-600">{days}</div>
      <div className="text-xs text-gray-500 uppercase tracking-wide">
        day{days === 1 ? '' : 's'} streak
      </div>
    </div>
  )
}

function ScoreBadge({ status, score }: { status: string; score: number | null }) {
  if (status === 'failed') {
    return (
      <span className="flex-none px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-700">
        Failed
      </span>
    )
  }
  if (score == null) {
    return (
      <span className="flex-none px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-600">
        {status}
      </span>
    )
  }
  const tone =
    score >= 80
      ? 'bg-emerald-100 text-emerald-700'
      : score >= 50
        ? 'bg-amber-100 text-amber-700'
        : 'bg-red-100 text-red-700'
  return (
    <span className={`flex-none px-2 py-1 rounded text-xs font-semibold ${tone}`}>
      {score}/100
    </span>
  )
}

function SeverityBadge({ severity }: { severity: number }) {
  const labels = ['', 'Minor', 'Moderate', 'Blocking']
  const tones = [
    '',
    'bg-yellow-100 text-yellow-800',
    'bg-orange-100 text-orange-800',
    'bg-red-100 text-red-700',
  ]
  return (
    <span
      className={`flex-none px-2 py-1 rounded text-xs font-semibold ${tones[severity] || tones[1]}`}
    >
      {labels[severity] || 'Minor'}
    </span>
  )
}
