import { useState } from 'react'
import { api, type AttemptPayload, type AttemptResult } from '../../lib/api'
import { track } from '../../lib/analytics'
import { useTimer } from '../../hooks/useTimer'
import { CodeEditor } from './CodeEditor'
import { EvaluationResult } from './EvaluationResult'

type Status = 'solved' | 'attempted' | 'failed'
type SubmissionTab = 'code' | 'text'
type Phase = 'idle' | 'evaluating' | 'done'

const STATUS_BUTTONS: { value: Status; label: string }[] = [
  { value: 'solved',    label: 'Solved' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'failed',    label: 'Failed' },
]

interface AttemptFormProps {
  problemId: string
  getToken: () => Promise<string | null>
  difficulty: string
  onSubmitSuccess: () => void
}

export function AttemptForm({ problemId, getToken, difficulty, onSubmitSuccess }: AttemptFormProps) {
  const timer = useTimer()

  // Submission fields
  const [status, setStatus]             = useState<Status | null>(null)
  const [solveTime, setSolveTime]       = useState(0)
  const [hintsUsed, setHintsUsed]       = useState(0)
  const [submissionTab, setSubmissionTab] = useState<SubmissionTab>('code')
  const [language, setLanguage]         = useState('python')
  const [codeSubmission, setCodeSubmission] = useState('')
  const [approachText, setApproachText] = useState('')

  // Async state
  const [phase, setPhase]               = useState<Phase>('idle')
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const [result, setResult]             = useState<AttemptResult | null>(null)

  // Stop timer + auto-fill time on first status click
  const handleStatusSelect = (s: Status) => {
    setStatus(s)
    if (timer.timerRunning) {
      timer.stop()
      setSolveTime(Math.max(1, Math.ceil(timer.elapsed / 60)))
    }
  }

  const hasCode    = codeSubmission.trim().length > 0
  const hasApproach = approachText.trim().length >= 10
  const canSubmit  =
    status !== null &&
    (submissionTab === 'code' ? hasCode : hasApproach) &&
    phase === 'idle'

  const handleSubmit = async () => {
    if (!canSubmit || !status) return
    setPhase('evaluating')
    setSubmitError(null)
    try {
      const t = await getToken()
      if (!t) {
        setSubmitError('Session expired — please refresh the page')
        setPhase('idle')
        return
      }
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
    timer.reset()
  }

  return (
    <div className="space-y-4">
      {/* ── Toolbar: timer · status · time · hints ── */}
      <div className="flex flex-wrap items-center gap-4 py-3 border-y border-gray-100">
        {/* Timer */}
        <div className="flex items-center gap-2">
          <span className="text-xl font-mono font-bold text-gray-700">{timer.formatted}</span>
          <span className="text-xs text-gray-400">
            {timer.timerRunning ? 'Select status to stop' : 'Stopped'}
          </span>
        </div>

        {/* Status buttons */}
        <div className="flex items-center gap-1.5">
          {STATUS_BUTTONS.map((btn) => (
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

        {/* Time input */}
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

        {/* Hints counter */}
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

      {/* ── Submission tabs ── */}
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
          <CodeEditor
            value={codeSubmission}
            onChange={setCodeSubmission}
            language={language}
            onLanguageChange={setLanguage}
            approachText={approachText}
            onApproachTextChange={setApproachText}
          />
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

      {/* ── Submit button ── */}
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

      {/* ── Evaluation result ── */}
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
