import type { AttemptResult } from '../../lib/api'

export function EvaluationResult({ result }: { result: AttemptResult }) {
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
