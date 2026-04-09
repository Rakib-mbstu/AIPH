import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
  api,
  type RecommendedProblem,
  type AttemptPayload,
  type AttemptResult,
} from '../lib/api'
import { track } from '../lib/analytics'

// ─── EvaluationResult ────────────────────────────────────────────────────────

function EvaluationResult({ result }: { result: AttemptResult }) {
  const score = result.submission.aiScore
  const scoreColor =
    score >= 80
      ? 'text-emerald-600'
      : score >= 50
      ? 'text-indigo-600'
      : 'text-amber-600'

  return (
    <div className="mt-4 border border-indigo-100 rounded-lg bg-indigo-50/40 p-4 space-y-3">
      <h4 className="font-semibold text-gray-800 text-sm">AI Evaluation</h4>

      <div className="flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-gray-500">Score </span>
          <span className={`font-bold text-base ${scoreColor}`}>{score}/100</span>
        </div>
        {result.submission.patternIdentified && (
          <div>
            <span className="text-gray-500">Pattern </span>
            <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-0.5 rounded-full">
              {result.submission.patternIdentified}
            </span>
          </div>
        )}
        {result.submission.timeComplexity && (
          <div>
            <span className="text-gray-500">Time </span>
            <span className="font-mono text-gray-800">{result.submission.timeComplexity}</span>
          </div>
        )}
        {result.submission.spaceComplexity && (
          <div>
            <span className="text-gray-500">Space </span>
            <span className="font-mono text-gray-800">{result.submission.spaceComplexity}</span>
          </div>
        )}
      </div>

      {result.submission.feedback && (
        <p className="text-sm text-gray-700 leading-relaxed">{result.submission.feedback}</p>
      )}

      {result.submission.suggestedOptimization && (
        <div className="bg-white border border-indigo-200 rounded p-3 text-sm text-gray-700">
          <span className="font-medium text-indigo-700">Suggestion: </span>
          {result.submission.suggestedOptimization}
        </div>
      )}
    </div>
  )
}

// ─── AttemptForm ─────────────────────────────────────────────────────────────

function AttemptForm({
  problemId,
  token,
  difficulty,
}: {
  problemId: string
  token: string
  difficulty: string
}) {
  // Timer
  const [elapsed, setElapsed] = useState(0)
  const [timerRunning, setTimerRunning] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [timerRunning])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const stopTimer = () => {
    setTimerRunning(false)
    setSolveTime(Math.max(1, Math.ceil(elapsed / 60)))
  }

  // Form state
  const [status, setStatus] = useState<'solved' | 'attempted' | 'failed' | null>(null)
  const [solveTime, setSolveTime] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [approachText, setApproachText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<AttemptResult | null>(null)

  const canSubmit =
    status !== null &&
    approachText.trim().length >= 10 &&
    !submitting

  const handleSubmit = async () => {
    if (!canSubmit || status === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const payload: AttemptPayload = {
        problemId,
        status,
        solveTime: solveTime || 0,
        hintsUsed,
        approachText: approachText.trim(),
      }
      const res = await api.submitAttempt(token, payload)
      if (res.error || !res.data) {
        setSubmitError(res.error ?? 'Submission failed')
      } else {
        setResult(res.data)
        track('attempt_submitted', { problemId, status, difficulty })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const statusButtons: { value: 'solved' | 'attempted' | 'failed'; label: string }[] = [
    { value: 'solved', label: 'Solved' },
    { value: 'attempted', label: 'Attempted' },
    { value: 'failed', label: 'Failed' },
  ]

  return (
    <div className="mt-4 border-t border-gray-100 pt-4 space-y-4">
      {/* Timer */}
      <div className="flex items-center gap-3">
        <span className="text-2xl font-mono font-bold text-gray-700">{formatTime(elapsed)}</span>
        {timerRunning && (
          <button
            onClick={stopTimer}
            className="text-xs px-3 py-1 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Stop Timer
          </button>
        )}
        {!timerRunning && (
          <span className="text-xs text-gray-400">Timer stopped</span>
        )}
      </div>

      {/* Status */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Status</label>
        <div className="flex gap-2">
          {statusButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => setStatus(btn.value)}
              className={[
                'px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                status === btn.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400',
              ].join(' ')}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Solve time */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Time (minutes)</label>
        <input
          type="number"
          min={1}
          step={1}
          value={solveTime || ''}
          onChange={(e) => setSolveTime(Math.max(0, parseInt(e.target.value) || 0))}
          placeholder="0"
          className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Hints */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Hints used</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setHintsUsed((h) => Math.max(0, h - 1))}
            className="w-7 h-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-lg leading-none"
          >
            −
          </button>
          <span className="w-6 text-center text-sm font-medium">{hintsUsed}</span>
          <button
            onClick={() => setHintsUsed((h) => h + 1)}
            className="w-7 h-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-lg leading-none"
          >
            +
          </button>
        </div>
      </div>

      {/* Approach */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-700">Your approach</label>
        <textarea
          rows={5}
          value={approachText}
          onChange={(e) => setApproachText(e.target.value)}
          placeholder="Describe your approach — algorithm, data structures, edge cases..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
        <p className={`text-xs ${approachText.trim().length < 10 ? 'text-amber-600' : 'text-gray-400'}`}>
          {approachText.trim().length}/10 min
        </p>
      </div>

      {/* Submit */}
      {!result && (
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={[
            'w-full py-2 rounded-lg text-sm font-semibold transition-colors',
            canSubmit
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          ].join(' ')}
        >
          {submitting ? 'Evaluating…' : 'Submit Attempt'}
        </button>
      )}

      {submitError && (
        <p className="text-sm text-red-600">{submitError}</p>
      )}

      {/* AI Evaluation */}
      {result && <EvaluationResult result={result} />}
    </div>
  )
}

// ─── ProblemCard ─────────────────────────────────────────────────────────────

function ProblemCard({
  problem,
  isExpanded,
  onToggle,
  token,
}: {
  problem: RecommendedProblem
  isExpanded: boolean
  onToggle: () => void
  token: string
}) {
  const difficultyBadge: Record<string, string> = {
    easy: 'bg-emerald-100 text-emerald-800',
    medium: 'bg-amber-100 text-amber-800',
    hard: 'bg-red-100 text-red-800',
  }
  const badgeClass = difficultyBadge[problem.difficulty.toLowerCase()] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className={`border border-gray-200 rounded-lg bg-white shadow-sm transition-shadow ${isExpanded ? 'shadow-md' : 'hover:shadow-md'}`}>
      {/* Collapsed header — always visible */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 text-sm">{problem.title}</h3>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${badgeClass}`}>
                {problem.difficulty}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {problem.topic}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {problem.pattern}
              </span>
            </div>
            <p className="text-xs text-gray-500 italic">{problem.reason}</p>
            <p className="text-xs text-gray-400 mt-1">~{problem.estimatedMinutes} min</p>
          </div>
          <button
            onClick={onToggle}
            className={[
              'shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              isExpanded
                ? 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700',
            ].join(' ')}
          >
            {isExpanded ? 'Collapse' : 'Start'}
          </button>
        </div>
      </div>

      {/* Expanded: attempt form */}
      {isExpanded && (
        <div className="px-4 pb-4">
          <AttemptForm
            problemId={problem.problemId}
            token={token}
            difficulty={problem.difficulty}
          />
        </div>
      )}
    </div>
  )
}

// ─── ProblemsPage ─────────────────────────────────────────────────────────────

export default function ProblemsPage() {
  const { getToken } = useAuth()
  const [problems, setProblems] = useState<RecommendedProblem[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const fetchProblems = async () => {
    setLoading(true)
    setError(null)
    setExpandedId(null)
    const t = await getToken()
    if (!t) { setError('Not signed in'); setLoading(false); return }
    setToken(t)
    const res = await api.getProblems(t, 10)
    if (res.error || !res.data) {
      setError(res.error ?? 'Failed to load problems')
    } else {
      setProblems(res.data.recommendations)
    }
    setLoading(false)
  }

  useEffect(() => {
    track('problems_viewed')
    fetchProblems()
  }, [])

  if (loading) return <div className="p-8 text-gray-500">Loading recommendations…</div>
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Problems</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Personalized recommendations based on your mastery and weak areas.
          </p>
        </div>
        <button
          onClick={fetchProblems}
          className="text-sm px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Empty state */}
      {problems.length === 0 && (
        <div className="text-gray-500 text-sm p-6 bg-white border border-gray-200 rounded-lg">
          No recommendations yet — submit your first attempt to get personalized suggestions.
        </div>
      )}

      {/* Problem cards */}
      {problems.map((problem) => (
        <ProblemCard
          key={problem.problemId}
          problem={problem}
          isExpanded={expandedId === problem.problemId}
          onToggle={() =>
            setExpandedId((id) =>
              id === problem.problemId ? null : problem.problemId
            )
          }
          token={token ?? ''}
        />
      ))}
    </div>
  )
}
