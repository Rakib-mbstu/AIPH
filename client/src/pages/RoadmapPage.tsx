import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  api,
  type RoadmapResponse,
  type RoadmapTopic,
  type RoadmapPattern,
  type RoadmapEdge,
  type NodeStatus,
} from '../lib/api'
import { Sparkline } from '../components/Sparkline'
import { Skeleton } from '../components/Skeleton'
import { track } from '../lib/analytics'

/**
 * Adaptive roadmap view (Cycle B).
 *
 * Renders the topic graph with React Flow. Each node's color reflects its
 * computed status (mastered / in-progress / available / locked) and shows
 * a weakness badge when flagged. Patterns render below the graph as cards.
 *
 * Layout is a simple layered top-down layout computed from the graph's
 * topological levels — no dagre dependency needed for 10 nodes.
 */
export default function RoadmapPage() {
  const { getToken } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [data, setData] = useState<RoadmapResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Roadmap | AIPH'
    track('roadmap_viewed')
    const h = searchParams.get('highlight')
    if (h) {
      setHighlightId(h)
      const cleaned = new URLSearchParams(searchParams)
      cleaned.delete('highlight')
      setSearchParams(cleaned, { replace: true })
    }
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

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] as Edge[] }
    return buildFlow(data.topics, data.edges)
  }, [data])

  // Apply highlight overlay to matching node
  const finalNodes = useMemo(() => {
    if (!highlightId) return nodes
    return nodes.map((n) => {
      const topic = (n.data as { topic: RoadmapTopic }).topic
      if (topic.id === highlightId) {
        return { ...n, data: { ...n.data, highlighted: true } }
      }
      return n
    })
  }, [nodes, highlightId])

  if (loading) return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-20" />)}
      </div>
      <Skeleton className="h-[400px] w-full rounded-lg" />
      <div>
        <Skeleton className="h-6 w-24 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
      </div>
    </div>
  )
  if (error) return (
    <div className="max-w-md mx-auto p-8 text-center space-y-3">
      <p className="text-red-600 text-sm">{error}</p>
      <button
        onClick={() => window.location.reload()}
        className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        Retry
      </button>
    </div>
  )
  if (!data) return <div className="p-8 text-gray-500">No roadmap data.</div>

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Your Roadmap</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Topics unlock as you master their prerequisites. Weak areas are highlighted.
        </p>
      </header>

      <section>
        <div className="flex items-center gap-4 text-xs mb-3">
          <Legend color="bg-emerald-500" label="Mastered" />
          <Legend color="bg-indigo-500" label="In progress" />
          <Legend color="bg-sky-400" label="Available" />
          <Legend color="bg-gray-300" label="Locked" />
          <Legend color="bg-rose-500" label="Weak area" ring />
        </div>
        <div className="border border-gray-200 rounded-lg bg-white" style={{ height: 'min(560px, 70vh)' }}>
          <ReactFlow
            nodes={finalNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            minZoom={0.5}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={16} color="#e5e7eb" />
            <Controls showInteractive={false} />
          </ReactFlow>
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

// ============================================================================
// Graph layout
// ============================================================================

/**
 * Build React Flow nodes + edges from the roadmap payload. Nodes are placed
 * in layered rows: row index = length of the longest prereq chain into that
 * node (topological depth). Nodes in the same row are spread evenly on X.
 */
function buildFlow(
  topics: RoadmapTopic[],
  edges: RoadmapEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const byId = new Map(topics.map((t) => [t.id, t]))
  const incoming = new Map<string, string[]>()
  for (const t of topics) incoming.set(t.id, [])
  for (const e of edges) {
    if (!incoming.has(e.to)) incoming.set(e.to, [])
    incoming.get(e.to)!.push(e.from)
  }

  // Memoized topological depth
  const depthCache = new Map<string, number>()
  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (depthCache.has(id)) return depthCache.get(id)!
    if (seen.has(id)) return 0 // cycle guard
    seen.add(id)
    const parents = incoming.get(id) ?? []
    const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map((p) => depthOf(p, seen)))
    depthCache.set(id, d)
    return d
  }

  // Group topics by depth
  const rows = new Map<number, RoadmapTopic[]>()
  for (const t of topics) {
    const d = depthOf(t.id)
    if (!rows.has(d)) rows.set(d, [])
    rows.get(d)!.push(t)
  }

  // Stable order within each row (alphabetical)
  for (const arr of rows.values()) arr.sort((a, b) => a.name.localeCompare(b.name))

  const COL_W = 220
  const ROW_H = 130
  const CENTER_X = 0 // React Flow handles origin; fitView centers it

  const flowNodes: Node[] = []
  for (const [depth, rowTopics] of rows.entries()) {
    const count = rowTopics.length
    const rowWidth = (count - 1) * COL_W
    const startX = CENTER_X - rowWidth / 2
    rowTopics.forEach((t, i) => {
      flowNodes.push({
        id: t.id,
        type: 'topic',
        position: { x: startX + i * COL_W, y: depth * ROW_H },
        data: { topic: t },
      })
    })
  }

  const flowEdges: Edge[] = edges.map((e) => {
    const targetStatus = byId.get(e.to)?.status
    const dim = targetStatus === 'locked'
    return {
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      type: 'smoothstep',
      animated: !dim && targetStatus === 'available',
      style: { stroke: dim ? '#d1d5db' : '#9ca3af', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: dim ? '#d1d5db' : '#9ca3af' },
    }
  })

  return { nodes: flowNodes, edges: flowEdges }
}

// ============================================================================
// Custom node
// ============================================================================

function TopicNode({ data }: NodeProps) {
  const navigate = useNavigate()
  const topic = (data as { topic: RoadmapTopic; highlighted?: boolean }).topic
  const highlighted = (data as { highlighted?: boolean }).highlighted === true
  const pct = Math.max(0, Math.min(100, topic.progress?.masteryScore ?? 0))
  const { bg, border, text } = statusStyles(topic.status)
  const isWeak = topic.weakness !== null
  const isClickable = topic.status !== 'locked'

  const handleNav = () => {
    if (isClickable) {
      track('cross_nav', { from: 'roadmap', to: 'problems', topic: topic.name })
      navigate(`/problems?topic=${encodeURIComponent(topic.name)}`)
    }
  }

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={handleNav}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleNav()
        }
      }}
      className={[
        `rounded-lg border-2 ${border} ${bg} ${text} px-3 py-2 w-[180px] shadow-sm`,
        isWeak ? 'ring-2 ring-rose-400 ring-offset-2' : '',
        highlighted ? 'ring-4 ring-amber-400 ring-offset-2 animate-pulse' : '',
        isClickable ? 'cursor-pointer hover:ring-2 hover:ring-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm leading-tight">{topic.name}</div>
        {isWeak && (
          <span className="text-[10px] font-bold uppercase bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
            {topic.weakness!.reason}
          </span>
        )}
      </div>
      <div className="mt-2">
        <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/80 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-[10px] mt-1 opacity-80">
          {topic.status === 'locked'
            ? 'Locked'
            : `${pct}% · ${topic.progress?.attemptCount ?? 0} attempts`}
        </div>
      </div>
    </div>
  )
}

const nodeTypes = { topic: TopicNode }

function statusStyles(status: NodeStatus): { bg: string; border: string; text: string } {
  switch (status) {
    case 'mastered':
      return { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-white' }
    case 'in-progress':
      return { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-white' }
    case 'available':
      return { bg: 'bg-sky-400', border: 'border-sky-500', text: 'text-white' }
    case 'locked':
    default:
      return { bg: 'bg-gray-200', border: 'border-gray-300', text: 'text-gray-600' }
  }
}

// ============================================================================
// Patterns + legend
// ============================================================================

function Legend({ color, label, ring }: { color: string; label: string; ring?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block w-3 h-3 rounded ${color} ${
          ring ? 'ring-2 ring-rose-400 ring-offset-1' : ''
        }`}
      />
      <span className="text-gray-600">{label}</span>
    </div>
  )
}

function PatternCard({ pattern }: { pattern: RoadmapPattern }) {
  const navigate = useNavigate()
  const score = pattern.mastery?.masteryScore ?? 0
  const confidence = pattern.mastery?.confidenceScore ?? 0
  const solved = pattern.mastery?.solvedCount ?? 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        track('cross_nav', { from: 'roadmap', to: 'problems', pattern: pattern.name })
        navigate(`/problems?pattern=${encodeURIComponent(pattern.name)}`)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          track('cross_nav', { from: 'roadmap', to: 'problems', pattern: pattern.name })
          navigate(`/problems?pattern=${encodeURIComponent(pattern.name)}`)
        }
      }}
      className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{pattern.name}</h3>
        <span className="text-xs text-gray-500">{solved} solved</span>
      </div>
      <div className="space-y-2">
        <MasteryBar value={score} label="Mastery" />
        <MasteryBar value={confidence} label="Confidence" tone="emerald" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          Last {pattern.recentScores.length || 0} attempts
        </span>
        <Sparkline values={pattern.recentScores} width={100} height={28} />
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
