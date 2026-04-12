import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import Editor from '@monaco-editor/react'
import {
  api,
  type RecommendedProblem,
  type AttemptPayload,
  type AttemptResult,
} from '../lib/api'
import { track } from '../lib/analytics'
import { Skeleton } from '../components/Skeleton'

// ─── Language options ─────────────────────────────────────────────────────────

const LANGUAGES = [
  { value: 'python',     label: 'Python',     monaco: 'python' },
  { value: 'javascript', label: 'JavaScript', monaco: 'javascript' },
  { value: 'typescript', label: 'TypeScript', monaco: 'typescript' },
  { value: 'java',       label: 'Java',       monaco: 'java' },
  { value: 'cpp',        label: 'C++',        monaco: 'cpp' },
  { value: 'c',          label: 'C',          monaco: 'c' },
  { value: 'go',         label: 'Go',         monaco: 'go' },
  { value: 'rust',       label: 'Rust',       monaco: 'rust' },
  { value: 'ruby',       label: 'Ruby',       monaco: 'ruby' },
  { value: 'swift',      label: 'Swift',      monaco: 'swift' },
  { value: 'kotlin',     label: 'Kotlin',     monaco: 'kotlin' },
  { value: 'other',      label: 'Other',      monaco: 'plaintext' },
]

function monacoLang(value: string) {
  return LANGUAGES.find((l) => l.value === value)?.monaco ?? 'plaintext'
}

// ─── EvaluationResult ────────────────────────────────────────────────────────

function EvaluationResult({ result }: { result: AttemptResult }) {
  const score = result.submission.aiScore
  const scoreColor =
    score >= 80 ? 'text-emerald-600' : score >= 50 ? 'text-indigo-600' : 'text-amber-600'

  return (
    <div className="border border-indigo-100 rounded-lg bg-indigo-50/40 p-4 space-y-3">
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
  getToken,
  difficulty,
  onSubmitSuccess,
}: {
  problemId: string
  getToken: () => Promise<string | null>
  difficulty: string
  onSubmitSuccess: () => void
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerRunning])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // Form state
  const [status, setStatus] = useState<'solved' | 'attempted' | 'failed' | null>(null)
  const [solveTime, setSolveTime] = useState(0)
  const [hintsUsed, setHintsUsed] = useState(0)
  const [submissionTab, setSubmissionTab] = useState<'code' | 'text'>('code')
  const [language, setLanguage] = useState('python')
  const [editorTheme, setEditorTheme] = useState<'vs-dark' | 'light'>('vs-dark')
  const [codeSubmission, setCodeSubmission] = useState('')
  const [approachText, setApproachText] = useState('')
  const [phase, setPhase] = useState<'idle' | 'evaluating' | 'done'>('idle')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [result, setResult] = useState<AttemptResult | null>(null)

  // Clicking a status button stops the timer and auto-fills the time field
  const handleStatusSelect = (s: 'solved' | 'attempted' | 'failed') => {
    setStatus(s)
    if (timerRunning) {
      setTimerRunning(false)
      setSolveTime(Math.max(1, Math.ceil(elapsed / 60)))
    }
  }

  const hasCode = codeSubmission.trim().length > 0
  const hasApproach = approachText.trim().length >= 10
  const canSubmit =
    status !== null &&
    (submissionTab === 'code' ? hasCode : hasApproach) &&
    phase === 'idle'

  const handleSubmit = async () => {
    if (!canSubmit || status === null) return
    setPhase('evaluating')
    setSubmitError(null)
    try {
      const t = await getToken()
      if (!t) { setSubmitError('Session expired — please refresh the page'); setPhase('idle'); return }
      const payload: AttemptPayload = {
        problemId,
        status,
        solveTime: solveTime || 0,
        hintsUsed,
        ...(submissionTab === 'code'
          ? { language, codeSubmission: codeSubmission.trim(), approachText: approachText.trim() || undefined }
          : { approachText: approachText.trim() }
        ),
      }
      const res = await api.submitAttempt(t, payload)
      if (res.error || !res.data) {
        setSubmitError(res.error ?? 'Submission failed')
        setPhase('idle')
      } else {
        setResult(res.data)
        setPhase('done')
        track('attempt_submitted', { problemId, status, difficulty })
      }
    } catch {
      setSubmitError('Something went wrong')
      setPhase('idle')
    }
  }

  const resetForm = () => {
    setResult(null); setPhase('idle'); setStatus(null)
    setSolveTime(0); setHintsUsed(0)
    setCodeSubmission(''); setApproachText('')
    setElapsed(0); setTimerRunning(true)
  }

  const statusButtons: { value: 'solved' | 'attempted' | 'failed'; label: string }[] = [
    { value: 'solved', label: 'Solved' },
    { value: 'attempted', label: 'Attempted' },
    { value: 'failed', label: 'Failed' },
  ]

  return (
    <div className="space-y-4">
      {/* Top bar: timer + status + time + hints in one row */}
      <div className="flex flex-wrap items-center gap-4 py-3 border-y border-gray-100">
        {/* Timer */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-mono font-bold text-gray-700">{formatTime(elapsed)}</span>
          <span className="text-xs text-gray-400">
            {timerRunning ? 'Select status to stop' : 'Stopped'}
          </span>
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5">
          {statusButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => handleStatusSelect(btn.value)}
              className={[
                'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                status === btn.value
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400',
              ].join(' ')}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Time */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">mins</label>
          <input
            type="number"
            min={1}
            step={1}
            value={solveTime || ''}
            onChange={(e) => setSolveTime(Math.max(0, parseInt(e.target.value) || 0))}
            placeholder="0"
            className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Hints */}
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500">hints</label>
          <button
            onClick={() => setHintsUsed((h) => Math.max(0, h - 1))}
            className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm leading-none"
          >−</button>
          <span className="w-5 text-center text-sm font-medium">{hintsUsed}</span>
          <button
            onClick={() => setHintsUsed((h) => h + 1)}
            className="w-6 h-6 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm leading-none"
          >+</button>
        </div>
      </div>

      {/* Code / Written Approach tabs */}
      <div className="space-y-3">
        <div className="flex gap-1 border-b border-gray-200">
          {(['code', 'text'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSubmissionTab(tab)}
              className={[
                'px-4 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                submissionTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {tab === 'code' ? 'Code' : 'Written Approach'}
            </button>
          ))}
        </div>

        {submissionTab === 'code' && (
          <div className="space-y-3">
            {/* Editor toolbar */}
            <div className="flex items-center justify-between">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
              <button
                onClick={() => setEditorTheme((t) => t === 'vs-dark' ? 'light' : 'vs-dark')}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {editorTheme === 'vs-dark' ? '☀ Light' : '☾ Dark'}
              </button>
            </div>

            {/* Monaco Editor */}
            <div className="rounded-lg overflow-hidden border border-gray-300">
              <Editor
                height="max(300px, calc(100vh - 520px))"
                language={monacoLang(language)}
                theme={editorTheme}
                value={codeSubmission}
                onChange={(val) => setCodeSubmission(val ?? '')}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 4,
                  lineNumbers: 'on',
                  renderLineHighlight: 'all',
                  automaticLayout: true,
                  padding: { top: 12, bottom: 12 },
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                  fontLigatures: true,
                }}
              />
            </div>

            {/* Optional approach notes */}
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Notes (optional)</label>
              <textarea
                rows={2}
                value={approachText}
                onChange={(e) => setApproachText(e.target.value)}
                placeholder="Algorithm notes, edge cases, trade-offs…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>
        )}

        {submissionTab === 'text' && (
          <div className="space-y-1">
            <textarea
              rows={8}
              value={approachText}
              onChange={(e) => setApproachText(e.target.value)}
              placeholder="Describe your approach — algorithm, data structures, edge cases…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <p className={`text-xs ${approachText.trim().length < 10 ? 'text-amber-600' : 'text-gray-400'}`}>
              {approachText.trim().length}/10 min characters
            </p>
          </div>
        )}
      </div>

      {/* Submit */}
      {phase !== 'done' && (
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={[
            'w-full py-2.5 rounded-lg text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500',
            canSubmit
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          ].join(' ')}
        >
          Submit Attempt
        </button>
      )}

      {phase === 'evaluating' && (
        <div className="flex items-center gap-2 text-sm text-indigo-600">
          <span className="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          Evaluating your submission…
        </div>
      )}

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}

      {/* AI Evaluation result */}
      {result && (
        <div className="space-y-3">
          <EvaluationResult result={result} />
          <div className="flex gap-2">
            {result.submission.aiScore < 90 && (
              <button
                onClick={resetForm}
                className="flex-1 py-2 rounded-lg text-sm font-semibold bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                Try Again
              </button>
            )}
            {result.submission.aiScore >= 30 && (
              <button
                onClick={onSubmitSuccess}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Done — refresh recommendations
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── SidebarCard ─────────────────────────────────────────────────────────────

function SidebarCard({
  problem,
  isActive,
  onSelect,
}: {
  problem: RecommendedProblem
  isActive: boolean
  onSelect: () => void
}) {
  const difficultyBadge: Record<string, string> = {
    easy: 'bg-emerald-100 text-emerald-800',
    medium: 'bg-amber-100 text-amber-800',
    hard: 'bg-red-100 text-red-800',
  }
  const badgeClass = difficultyBadge[problem.difficulty.toLowerCase()] ?? 'bg-gray-100 text-gray-700'

  return (
    <button
      onClick={onSelect}
      className={[
        'w-full text-left p-3 rounded-lg border transition-all',
        isActive
          ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200'
          : 'bg-white border-gray-200 hover:border-indigo-200 hover:bg-gray-50/80',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold text-gray-900 leading-snug">{problem.title}</span>
        <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full capitalize ${badgeClass}`}>
          {problem.difficulty}
        </span>
      </div>
      <div className="flex flex-wrap gap-1 mb-1.5">
        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{problem.topic}</span>
        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{problem.pattern}</span>
      </div>
      <p className="text-xs text-gray-500 italic leading-snug line-clamp-2">{problem.reason}</p>
      <p className="text-xs text-gray-400 mt-1.5">~{problem.estimatedMinutes} min</p>
    </button>
  )
}

// ─── ActiveProblemPanel ───────────────────────────────────────────────────────

function ActiveProblemPanel({
  problem,
  getToken,
  onSubmitSuccess,
}: {
  problem: RecommendedProblem
  getToken: () => Promise<string | null>
  onSubmitSuccess: () => void
}) {
  const difficultyBadge: Record<string, string> = {
    easy: 'bg-emerald-100 text-emerald-800',
    medium: 'bg-amber-100 text-amber-800',
    hard: 'bg-red-100 text-red-800',
  }
  const badgeClass = difficultyBadge[problem.difficulty.toLowerCase()] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="h-full flex flex-col p-6 space-y-4">
      {/* Problem header */}
      <div className="space-y-2 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">{problem.title}</h2>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${badgeClass}`}>
            {problem.difficulty}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{problem.topic}</span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{problem.pattern}</span>
          <span className="text-xs text-gray-400">~{problem.estimatedMinutes} min</span>
          {problem.source && (
            <a
              href={problem.source}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
            >
              Open on LeetCode ↗
            </a>
          )}
        </div>
        <p className="text-xs text-gray-500 italic">{problem.reason}</p>
      </div>

      {/* Attempt form */}
      <div className="flex-1 min-h-0">
        <AttemptForm
          problemId={problem.problemId}
          getToken={getToken}
          difficulty={problem.difficulty}
          onSubmitSuccess={onSubmitSuccess}
        />
      </div>
    </div>
  )
}

// ─── ProblemsPage ─────────────────────────────────────────────────────────────

export default function ProblemsPage() {
  const { getToken } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [problems, setProblems] = useState<RecommendedProblem[]>([])
  const [activeProblem, setActiveProblem] = useState<RecommendedProblem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProblems = async (topicFilter?: string, patternFilter?: string) => {
    setLoading(true)
    setError(null)
    const t = await getToken()
    if (!t) { setError('Not signed in'); setLoading(false); return }
    const res = await api.getProblems(t, 10, topicFilter, patternFilter)
    if (res.error || !res.data) {
      setError(res.error ?? 'Failed to load problems')
    } else {
      setProblems(res.data.recommendations)
    }
    setLoading(false)
  }

  useEffect(() => {
    document.title = 'Problems | AIPH'
    track('problems_viewed')
    const expandParam = searchParams.get('expand')
    const topicParam = searchParams.get('topic') ?? undefined
    const patternParam = searchParams.get('pattern') ?? undefined

    const cleaned = new URLSearchParams(searchParams)
    cleaned.delete('expand')
    cleaned.delete('topic')
    cleaned.delete('pattern')
    if ([...cleaned].length !== [...searchParams].length) {
      setSearchParams(cleaned, { replace: true })
    }

    fetchProblems(topicParam, patternParam).then(() => {
      if (expandParam) {
        // Auto-select the problem linked from another page
        setActiveProblem((prev) =>
          prev ?? problems.find((p) => p.problemId === expandParam) ?? null
        )
      }
    })
  }, [])

  // When problems load and there's an expand param pending, auto-select
  useEffect(() => {
    const expandParam = searchParams.get('expand')
    if (expandParam && problems.length > 0 && !activeProblem) {
      const match = problems.find((p) => p.problemId === expandParam)
      if (match) setActiveProblem(match)
    }
  }, [problems])

  return (
    // Two-panel layout: left = editor, right = recommendations sidebar
    <div className="flex h-screen overflow-hidden">

      {/* ── Left: active problem + editor ─────────────────── */}
      <div className="flex-1 min-w-0 overflow-y-auto bg-gray-50">
        {activeProblem ? (
          <ActiveProblemPanel
            key={activeProblem.problemId}
            problem={activeProblem}
            getToken={getToken}
            onSubmitSuccess={() => {
              setActiveProblem(null)
              fetchProblems()
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
            <span className="text-6xl select-none">📋</span>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-500">No problem selected</p>
              <p className="text-xs mt-1">Pick one from the list →</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Divider ────────────────────────────────────────── */}
      <div className="w-px bg-gray-200 shrink-0" />

      {/* ── Right: recommendations sidebar ─────────────────── */}
      <div className="w-80 shrink-0 flex flex-col bg-white overflow-hidden">
        {/* Sidebar header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Recommended</h2>
            <p className="text-xs text-gray-500 mt-0.5">Based on your progress</p>
          </div>
          <button
            onClick={() => fetchProblems()}
            className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Refresh
          </button>
        </div>

        {/* Sidebar list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            [1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3 rounded-lg border border-gray-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
                <div className="flex gap-1">
                  <Skeleton className="h-4 w-16 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))
          ) : error ? (
            <div className="p-4 text-center space-y-2">
              <p className="text-xs text-red-600">{error}</p>
              <button
                onClick={() => fetchProblems()}
                className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          ) : problems.length === 0 ? (
            <p className="text-xs text-gray-500 p-3">
              No recommendations yet — submit your first attempt to get personalized suggestions.
            </p>
          ) : (
            problems.map((problem) => (
              <SidebarCard
                key={problem.problemId}
                problem={problem}
                isActive={activeProblem?.problemId === problem.problemId}
                onSelect={() => setActiveProblem(problem)}
              />
            ))
          )}
        </div>
      </div>

    </div>
  )
}
