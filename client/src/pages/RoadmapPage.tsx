import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { api, type RoadmapResponse, type RoadmapTopic, type RoadmapPattern } from '../lib/api'

/**
 * Static roadmap view for Phase 1.
 *
 * Shows every Topic and Pattern with the current user's mastery left-joined.
 * Untouched items render as "not started" with a 0% bar. Phase 2 will reorder
 * topics by the weakness engine and add the topic-graph edges.
 */
export default function RoadmapPage() {
  const { getToken } = useAuth()
  const [data, setData] = useState<RoadmapResponse | null>(null)
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
      const res = await api.getRoadmap(token)
      if (cancelled) return
      if (res.error) setError(res.error)
      else setData(res.data ?? null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [getToken])

  if (loading) return <div className="p-8 text-gray-500">Loading roadmap…</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>
  if (!data) return <div className="p-8 text-gray-500">No roadmap data.</div>

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      <header>
        <h1 className="text-3xl font-bold text-gray-900">Your Roadmap</h1>
        <p className="text-gray-600 mt-1">
          Topics and patterns grouped by mastery. Click a topic to see related problems.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Topics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.topics.map((t) => (
            <TopicCard key={t.id} topic={t} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Patterns</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.patterns.map((p) => (
            <PatternCard key={p.id} pattern={p} />
          ))}
        </div>
      </section>
    </div>
  )
}

function TopicCard({ topic }: { topic: RoadmapTopic }) {
  const score = topic.progress?.masteryScore ?? 0
  const attempts = topic.progress?.attemptCount ?? 0

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{topic.name}</h3>
        <span className="text-xs text-gray-500">{attempts} attempts</span>
      </div>
      {topic.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{topic.description}</p>
      )}
      <MasteryBar value={score} />
    </div>
  )
}

function PatternCard({ pattern }: { pattern: RoadmapPattern }) {
  const score = pattern.mastery?.masteryScore ?? 0
  const confidence = pattern.mastery?.confidenceScore ?? 0
  const solved = pattern.mastery?.solvedCount ?? 0

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{pattern.name}</h3>
        <span className="text-xs text-gray-500">{solved} solved</span>
      </div>
      <div className="space-y-2">
        <MasteryBar value={score} label="Mastery" />
        <MasteryBar value={confidence} label="Confidence" tone="emerald" />
      </div>
    </div>
  )
}

function MasteryBar({
  value,
  label = 'Mastery',
  tone = 'indigo',
}: {
  value: number
  label?: string
  tone?: 'indigo' | 'emerald'
}) {
  const pct = Math.max(0, Math.min(100, value))
  const fill = tone === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500'
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${fill} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
