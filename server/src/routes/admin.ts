import { Router, Request, Response } from 'express'
import { getAiLogs, getAiStats, clearAiLogs } from '../lib/ai/logger'

const router = Router()

/**
 * Simple key-based guard — set ADMIN_KEY in your .env.
 * If not set, the routes are open (dev convenience).
 */
function adminGuard(req: Request, res: Response, next: () => void) {
  const key = process.env.ADMIN_KEY
  if (!key) return next() // no key configured → allow in dev
  const provided = req.headers['x-admin-key'] ?? req.query.key
  if (provided !== key) return res.status(403).json({ error: 'forbidden' })
  next()
}

/**
 * GET /api/admin/ai-logs?limit=50
 *
 * Returns the most recent AI calls (newest first). Use `?limit=N` to control
 * how many records come back (max 200).
 */
router.get('/ai-logs', adminGuard, (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)
  res.json({ logs: getAiLogs(limit) })
})

/**
 * GET /api/admin/ai-stats
 *
 * Aggregated stats: total calls, fallback count, error count, avg latency,
 * breakdown by use-case and model.
 */
router.get('/ai-stats', adminGuard, (_req: Request, res: Response) => {
  res.json(getAiStats())
})

/**
 * DELETE /api/admin/ai-logs
 *
 * Wipe the in-memory log (useful when debugging to start fresh).
 */
router.delete('/ai-logs', adminGuard, (_req: Request, res: Response) => {
  clearAiLogs()
  res.json({ ok: true })
})

export default router
