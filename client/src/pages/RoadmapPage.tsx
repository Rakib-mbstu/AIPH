import { useMemo } from 'react'
import type { Node } from '@xyflow/react'
import type { RoadmapTopic } from '../lib/api'
import { track } from '../lib/analytics'
import { Skeleton } from '../components/Skeleton'
import { buildFlow } from '../components/roadmap/buildFlow'
import { TopicGraph } from '../components/roadmap/TopicGraph'
import { PatternCard } from '../components/roadmap/PatternCard'
import { useRoadmapData } from '../hooks/useRoadmapData'
import { useEffect } from 'react'

export default function RoadmapPage() {
  const { data, loading, error, highlightId } = useRoadmapData()

  useEffect(() => {
    document.title = 'Roadmap | AIPH'
    track('roadmap_viewed')
  }, [])

  // Build React Flow graph from raw data
  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [] as Node[], edges: [] }
    return buildFlow(data.topics, data.edges)
  }, [data])

  // Apply highlight overlay to the matching node
  const finalNodes = useMemo(() => {
    if (!highlightId) return nodes
    return nodes.map((n) => {
      const topic = (n.data as { topic: RoadmapTopic }).topic
      return topic.id === highlightId
        ? { ...n, data: { ...n.data, highlighted: true } }
        : n
    })
  }, [nodes, highlightId])

  if (loading) return <RoadmapSkeleton />
  if (error)   return <RoadmapError message={error} />
  if (!data)   return <div className="p-8 text-gray-500">No roadmap data.</div>

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-10">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Your Roadmap</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Topics unlock as you master their prerequisites. Weak areas are highlighted.
        </p>
      </header>

      <TopicGraph nodes={finalNodes} edges={edges} />

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

// ─── Page-level loading / error states ───────────────────────────────────────

function RoadmapSkeleton() {
  return (
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
}

function RoadmapError({ message }: { message: string }) {
  return (
    <div className="max-w-md mx-auto p-8 text-center space-y-3">
      <p className="text-red-600 text-sm">{message}</p>
      <button
        onClick={() => window.location.reload()}
        className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        Retry
      </button>
    </div>
  )
}
