import type { SystemDesignQuestion } from '../../lib/api'
import { difficultyBadgeClass } from '../problems/constants'

export function QuestionCard({
  question,
  isActive,
  onSelect,
}: {
  question: SystemDesignQuestion
  isActive: boolean
  onSelect: () => void
}) {
  const visibleConcepts = question.expectedConcepts.slice(0, 4)
  const overflow = question.expectedConcepts.length - visibleConcepts.length

  return (
    <button
      onClick={onSelect}
      className={[
        'w-full text-left px-4 py-3 rounded-xl border transition-all',
        isActive
          ? 'border-indigo-300 bg-indigo-50 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span
          className={[
            'text-sm font-medium leading-snug line-clamp-2',
            isActive ? 'text-indigo-900' : 'text-gray-800',
          ].join(' ')}
        >
          {question.prompt}
        </span>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${difficultyBadgeClass(question.difficulty)}`}
          >
            {question.difficulty}
          </span>
          {question.attemptCount > 0 && (
            <span className="text-xs text-gray-400">
              {question.attemptCount} attempt{question.attemptCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mt-1">
        {visibleConcepts.map((c) => (
          <span
            key={c}
            className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
          >
            {c}
          </span>
        ))}
        {overflow > 0 && (
          <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
            +{overflow} more
          </span>
        )}
      </div>
    </button>
  )
}
