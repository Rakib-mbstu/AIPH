import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  api,
  type ProgressResponse,
  type AttemptRecord,
  type WeakAreaRecord,
  type PlanItem,
  type RoadmapPattern,
  type ReadinessResult,
  type ReadinessComponent,
} from '../lib/api'
import { Sparkline } from '../components/Sparkline'
import { track } from '../lib/analytics'

/**
 * Progress Tracker — the home base.
 *
 * Sections:
 *   1. Today's Plan       — prescriptive next steps
 *   2. Streak             — consecutive days with at least one attempt
 *   3. Recent Activity    — last 5 attempts with AI score badges
 *   4. Weak Areas         — open flags from the detection engine
 *   5. Pattern Progress   — top patterns by attempts with trend sparklines
 *   6. Readiness Score    — composite score + per-component breakdown
 */
export default function TrackerPage() {
  const { getToken } = useAuth()
  const [data, setData] = useState<ProgressResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    track('tracker_viewed')
  }, [])

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

      <PatternProgressSection patterns={data.patterns} />

      <ReadinessSection readiness={data.readiness} />
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

function PatternProgressSection({ patterns }: { patterns: RoadmapPattern[] }) {
  return (
    <section className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Pattern Progress</h2>
      <p className="text-xs text-gray-500 mb-4">
        Your score trajectory on the patterns you've attempted most. Flat = consistent, climbing = learning.
      </p>
      {patterns.length === 0 ? (
        <p className="text-sm text-gray-500">
          Submit a few attempts to see pattern trends appear here.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {patterns.map((p) => (
            <PatternTrendCard key={p.id} pattern={p} />
          ))}
        </div>
      )}
    </section>
  )
}

function PatternTrendCard({ pattern }: { pattern: RoadmapPattern }) {
  const mastery = pattern.mastery?.masteryScore ?? 0
  const attempts = pattern.mastery?.attemptCount ?? 0
  const solved = pattern.mastery?.solvedCount ?? 0
  const tone =
    mastery >= 80
      ? { stroke: '#059669', fill: 'rgba(5, 150, 105, 0.12)' } // emerald
      : mastery >= 50
        ? { stroke: '#6366f1', fill: 'rgba(99, 102, 241, 0.12)' } // indigo
        : { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.12)' } // amber

  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold text-sm text-gray-900 truncate">{pattern.name}</h3>
        <span className="text-xs font-semibold text-gray-700">{mastery}</span>
      </div>
      <div className="text-[10px] text-gray-500 mb-2">
        {solved}/{attempts} solved
      </div>
      <Sparkline
        values={pattern.recentScores}
        width={200}
        height={36}
        stroke={tone.stroke}
        fill={tone.fill}
      />
    </div>
  )
}

function ReadinessSection({ readiness }: { readiness: ReadinessResult }) {
  const { overall, components } = readiness
  const tone =
    overall >= 70
      ? 'text-emerald-600'
      : overall >= 40
        ? 'text-indigo-600'
        : 'text-amber-600'

  // Display order matches the formula in CLAUDE.md
  const rows: Array<{ key: string; label: string; comp: ReadinessComponent }> = [
    { key: 'dsa', label: 'DSA Coverage', comp: components.dsaCoverage },
    {
      key: 'difficulty',
      label: 'Difficulty Handled',
      comp: components.difficultyHandled,
    },
    { key: 'consistency', label: 'Consistency', comp: components.consistency },
    {
      key: 'mock',
      label: 'Mock Performance',
      comp: components.mockPerformance,
    },
    { key: 'design', label: 'System Design', comp: components.systemDesign },
  ]

  return (
    <section className="border border-gray-200 rounded-lg p-5 bg-white shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Readiness Score</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Weighted composite. Mock & system design weights are unscored until Phase 4.
          </p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold ${tone}`}>{overall}</div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wide">/ 100</div>
        </div>
      </div>
      <ul className="space-y-3">
        {rows.map((row) => (
          <ReadinessRow key={row.key} label={row.label} component={row.comp} />
        ))}
      </ul>
    </section>
  )
}

function ReadinessRow({
  label,
  component,
}: {
  label: string
  component: ReadinessComponent
}) {
  const pct = Math.max(0, Math.min(100, component.score))
  const weightLabel = `${Math.round(component.weight * 100)}%`
  const dim = component.unscored
  const barColor = dim
    ? 'bg-gray-300'
    : pct >= 70
      ? 'bg-emerald-500'
      : pct >= 40
        ? 'bg-indigo-500'
        : 'bg-amber-500'

  return (
    <li>
      <div className="flex items-baseline justify-between text-sm mb-1">
        <div className={`font-medium ${dim ? 'text-gray-400' : 'text-gray-800'}`}>
          {label}
          <span className="ml-2 text-[10px] text-gray-400 uppercase tracking-wide">
            weight {weightLabel}
          </span>
        </div>
        <div className={`font-semibold ${dim ? 'text-gray-400' : 'text-gray-700'}`}>
          {dim ? '—' : `${pct}/100`}
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all`}
          style={{ width: `${dim ? 0 : pct}%` }}
        />
      </div>
      {component.detail && (
        <div className="text-[11px] text-gray-500 mt-1">{component.detail}</div>
      )}
    </li>
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
