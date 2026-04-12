import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { RoadmapTopic, RoadmapEdge } from '../../lib/api'

const COL_W = 220
const ROW_H = 130

/**
 * Build React Flow nodes + edges from the roadmap payload.
 *
 * Nodes are placed in layered rows: row index = length of the longest prereq
 * chain into that node (topological depth). Nodes in the same row are spread
 * evenly on X. No dagre dependency needed for ~10 nodes.
 */
export function buildFlow(
  topics: RoadmapTopic[],
  edges: RoadmapEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const byId = new Map(topics.map((t) => [t.id, t]))

  // Build incoming-edge map
  const incoming = new Map<string, string[]>()
  for (const t of topics) incoming.set(t.id, [])
  for (const e of edges) {
    if (!incoming.has(e.to)) incoming.set(e.to, [])
    incoming.get(e.to)!.push(e.from)
  }

  // Memoized topological depth via DFS
  const depthCache = new Map<string, number>()
  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (depthCache.has(id)) return depthCache.get(id)!
    if (seen.has(id)) return 0 // cycle guard
    seen.add(id)
    const parents = incoming.get(id) ?? []
    const d = parents.length === 0
      ? 0
      : 1 + Math.max(...parents.map((p) => depthOf(p, seen)))
    depthCache.set(id, d)
    return d
  }

  // Group topics by depth, stable order within each row (alphabetical)
  const rows = new Map<number, RoadmapTopic[]>()
  for (const t of topics) {
    const d = depthOf(t.id)
    if (!rows.has(d)) rows.set(d, [])
    rows.get(d)!.push(t)
  }
  for (const arr of rows.values()) arr.sort((a, b) => a.name.localeCompare(b.name))

  // Position nodes
  const flowNodes: Node[] = []
  for (const [depth, rowTopics] of rows.entries()) {
    const count = rowTopics.length
    const rowWidth = (count - 1) * COL_W
    const startX = -rowWidth / 2 // React Flow's fitView will centre the canvas
    rowTopics.forEach((t, i) => {
      flowNodes.push({
        id: t.id,
        type: 'topic',
        position: { x: startX + i * COL_W, y: depth * ROW_H },
        data: { topic: t },
      })
    })
  }

  // Build edges
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
