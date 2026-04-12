import type { RecommendedProblem } from '../../lib/api'
import { difficultyBadgeClass } from './constants'
import { AttemptForm } from './AttemptForm'

interface ActiveProblemPanelProps {
  problem: RecommendedProblem
  getToken: () => Promise<string | null>
  onSubmitSuccess: () => void
}

export function ActiveProblemPanel({ problem, getToken, onSubmitSuccess }: ActiveProblemPanelProps) {
  const badgeClass = difficultyBadgeClass(problem.difficulty)

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
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {problem.topic}
          </span>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {problem.pattern}
          </span>
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
