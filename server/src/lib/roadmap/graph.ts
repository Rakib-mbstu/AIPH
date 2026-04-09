import fs from 'fs'
import path from 'path'

/**
 * Topic graph loader.
 *
 * The topic graph is stored as a static JSON file at the repo root
 * (`data/topicGraph.json`). Edges are prerequisites: `from` must be mastered
 * before `to` unlocks.
 *
 * Why static JSON, not a DB table? The graph is global — every user sees the
 * same edges. Per-user adaptivity comes from node *status* (computed below),
 * not from mutating the edges. Keeping this in-process means no migration to
 * change the curriculum and no extra query on roadmap reads.
 */

export interface GraphEdge {
  from: string // topic name
  to: string // topic name
}

interface GraphFile {
  edges: GraphEdge[]
}

// Resolve from the server's CWD → /server. Graph lives at repo root /data.
const GRAPH_PATH = path.resolve(process.cwd(), '..', 'data', 'topicGraph.json')

let cache: GraphFile | null = null

export function loadTopicGraph(): GraphFile {
  if (cache) return cache
  const raw = fs.readFileSync(GRAPH_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as GraphFile
  validateGraph(parsed)
  cache = parsed
  return cache
}

/**
 * Sanity-check the on-disk graph at load time. Catches the kinds of bugs that
 * would otherwise surface as confusing UI states (a node permanently locked
 * because of a typoed prereq name, or a cycle hanging the layout pass).
 */
function validateGraph(graph: GraphFile): void {
  if (!Array.isArray(graph.edges)) {
    throw new Error('topicGraph.json: "edges" must be an array')
  }
  for (const e of graph.edges) {
    if (!e || typeof e.from !== 'string' || typeof e.to !== 'string') {
      throw new Error(`topicGraph.json: malformed edge ${JSON.stringify(e)}`)
    }
    if (e.from === e.to) {
      throw new Error(`topicGraph.json: self-loop on "${e.from}"`)
    }
  }
  // Cycle check via DFS — small graph, recursion is fine.
  const adj = new Map<string, string[]>()
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    adj.get(e.from)!.push(e.to)
  }
  const WHITE = 0, GRAY = 1, BLACK = 2
  const color = new Map<string, number>()
  const visit = (node: string): void => {
    color.set(node, GRAY)
    for (const next of adj.get(node) ?? []) {
      const c = color.get(next) ?? WHITE
      if (c === GRAY) throw new Error(`topicGraph.json: cycle detected at "${next}"`)
      if (c === WHITE) visit(next)
    }
    color.set(node, BLACK)
  }
  for (const node of adj.keys()) {
    if ((color.get(node) ?? WHITE) === WHITE) visit(node)
  }
}

export type NodeStatus = 'mastered' | 'in-progress' | 'available' | 'locked'

interface StatusInput {
  topicName: string
  masteryScore: number
  hasAttempts: boolean
  prereqNames: string[]
  masteryByTopic: Map<string, number>
}

/**
 * Compute a single node's status for the adaptive view.
 *
 *   mastered     — masteryScore ≥ 80
 *   in-progress  — user has attempts, mastery < 80
 *   available    — no attempts yet, but all prereqs are mastered (or none)
 *   locked       — no attempts yet, at least one prereq isn't mastered
 *
 * Root nodes (no prereqs) are always at least `available`.
 */
export function computeNodeStatus(input: StatusInput): NodeStatus {
  const { masteryScore, hasAttempts, prereqNames, masteryByTopic } = input

  if (masteryScore >= 80) return 'mastered'
  if (hasAttempts) return 'in-progress'

  const allPrereqsMastered = prereqNames.every(
    (name) => (masteryByTopic.get(name) ?? 0) >= 80
  )
  return allPrereqsMastered ? 'available' : 'locked'
}

/**
 * Build the adjacency map: topicName → list of prerequisite topic names.
 * (i.e. the reverse of the edge direction.)
 */
export function buildPrereqMap(edges: GraphEdge[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const edge of edges) {
    if (!map.has(edge.to)) map.set(edge.to, [])
    map.get(edge.to)!.push(edge.from)
  }
  return map
}
