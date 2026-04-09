import { Router, Request, Response, NextFunction } from 'express'
import { protect, getUserId } from '../middleware/auth'
import {
  loadTopicGraph,
  buildPrereqMap,
  computeNodeStatus,
  type NodeStatus,
} from '../lib/roadmap/graph'
import { getPatternsWithTrends } from '../lib/db/queries/patterns'
import { prisma } from '../index'

const router = Router()

/**
 * GET /api/roadmap
 *
 * Returns the adaptive topic graph + pattern mastery, left-joined with the
 * current user's progress. Response shape:
 *
 *   {
 *     topics: [
 *       { id, name, description, progress, status, weakness, prereqIds }
 *     ],
 *     edges: [{ from: topicId, to: topicId }],
 *     patterns: [{ id, name, description, mastery }]
 *   }
 *
 * Topics the user hasn't touched yet appear with `progress: null` and a
 * computed `status` of either `available` (prereqs satisfied) or `locked`.
 * `weakness` is the open WeakArea reason on that topic, if any.
 *
 * Edges use topic IDs, not names, so the client doesn't have to resolve them.
 */
router.get('/', protect, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clerkId = getUserId(req)
    const user = await prisma.user.findUnique({ where: { clerkId } })
    if (!user) return res.status(404).json({ error: 'User not onboarded' })

    const [topics, patternsWithTrends, topicProgress, weakAreas] =
      await Promise.all([
        prisma.topic.findMany({ orderBy: { name: 'asc' } }),
        getPatternsWithTrends(user.id),
        prisma.topicProgress.findMany({ where: { userId: user.id } }),
        prisma.weakArea.findMany({
          where: { userId: user.id, resolvedAt: null, topicId: { not: null } },
        }),
      ])

    const progressByTopic = new Map(topicProgress.map((p) => [p.topicId, p]))
    const weaknessByTopic = new Map(
      weakAreas
        .filter((w): w is typeof w & { topicId: string } => Boolean(w.topicId))
        .map((w) => [w.topicId, { reason: w.reason, severity: w.severity }])
    )

    // Name → id lookup so we can translate the static graph file
    const topicByName = new Map(topics.map((t) => [t.name, t]))
    const masteryByTopicName = new Map(
      topics.map((t) => {
        const progress = progressByTopic.get(t.id)
        return [t.name, progress?.masteryScore ?? 0]
      })
    )

    // Load the static graph and resolve to IDs
    const graph = loadTopicGraph()
    const prereqMap = buildPrereqMap(graph.edges) // topicName → prereq names

    const topicNodes = topics.map((t) => {
      const progress = progressByTopic.get(t.id) ?? null
      const prereqNames = prereqMap.get(t.name) ?? []
      const status: NodeStatus = computeNodeStatus({
        topicName: t.name,
        masteryScore: progress?.masteryScore ?? 0,
        hasAttempts: (progress?.attemptCount ?? 0) > 0,
        prereqNames,
        masteryByTopic: masteryByTopicName,
      })
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        progress,
        status,
        weakness: weaknessByTopic.get(t.id) ?? null,
        prereqIds: prereqNames
          .map((name) => topicByName.get(name)?.id)
          .filter((id): id is string => Boolean(id)),
      }
    })

    // Translate edges from names to ids; drop any edge that references an
    // unknown topic (protects against graph-file drift vs. seed data).
    const edges = graph.edges
      .map((e) => {
        const from = topicByName.get(e.from)
        const to = topicByName.get(e.to)
        if (!from || !to) return null
        return { from: from.id, to: to.id }
      })
      .filter((e): e is { from: string; to: string } => e !== null)

    res.json({
      topics: topicNodes,
      edges,
      patterns: patternsWithTrends,
    })
  } catch (err) {
    next(err)
  }
})

/**
 * POST /api/roadmap/generate — Phase 2 placeholder. The adaptive graph
 * generator (LLM-driven) will eventually live here. For now the static
 * graph + computed node status is enough adaptivity.
 */
router.post('/generate', protect, async (_req, res) => {
  res.status(501).json({ error: 'Adaptive roadmap generation lands later' })
})

export default router
