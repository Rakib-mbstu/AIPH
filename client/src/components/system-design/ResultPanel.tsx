import { useNavigate } from 'react-router-dom'
import type { SystemDesignAttemptResult } from '../../lib/api'
import { scoreBarColor, scoreTextColor, scoreBadgeClass } from './scoreColors'

function SubScoreBar({
  label,
  score,
  max,
}: {
  label: string
  score: number
  max: number
}) {
  const pct = Math.round((score / max) * 100)
  const barColor = scoreBarColor(pct)

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span className="font-medium">{score}/{max}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function ResultPanel({
  result,
  onDone,
}: {
  result: SystemDesignAttemptResult
  onDone: () => void
}) {
  const navigate = useNavigate()

  const scoreColor = scoreTextColor(result.score)
  const scoreBg = scoreBadgeClass(result.score)

  return (
    <div className="space-y-5">
      {/* Overall score */}
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${scoreBg}`}>
        <div className={`text-4xl font-bold ${scoreColor}`}>{result.score}</div>
        <div>
          <p className="text-sm font-semibold text-gray-800">Overall Score</p>
          <p className="text-xs text-gray-500">out of 100</p>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="space-y-3">
        <SubScoreBar label="Requirements Clarification" score={result.requirementsClarification} max={25} />
        <SubScoreBar label="Component Coverage"         score={result.componentCoverage}         max={25} />
        <SubScoreBar label="Scalability Reasoning"      score={result.scalabilityReasoning}      max={25} />
        <SubScoreBar label="Tradeoff Awareness"         score={result.tradeoffAwareness}         max={25} />
      </div>

      {/* Feedback */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Feedback</p>
        <p className="text-sm text-gray-700 leading-relaxed">{result.feedback}</p>
      </div>

      {/* Missing concepts */}
      {result.missingConcepts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Concepts to strengthen
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.missingConcepts.map((c) => (
              <span
                key={c}
                className="text-xs bg-red-50 text-red-700 border border-red-100 px-2.5 py-1 rounded-full"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Deep dive suggestion */}
      {result.suggestedDeepDive && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-0.5">
              Suggested deep dive
            </p>
            <p className="text-sm text-indigo-900">{result.suggestedDeepDive}</p>
          </div>
          <button
            onClick={() =>
              navigate(`/chat?topic=${encodeURIComponent(result.suggestedDeepDive!)}`)
            }
            className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800 underline underline-offset-2 transition-colors"
          >
            Learn more
          </button>
        </div>
      )}

      <button
        onClick={onDone}
        className="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
      >
        Done
      </button>
    </div>
  )
}
