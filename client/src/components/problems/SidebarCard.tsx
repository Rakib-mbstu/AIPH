import type { RecommendedProblem } from '../../lib/api'
import { difficultyBadgeClass } from './constants'

interface SidebarCardProps {
  problem: RecommendedProblem
  isActive: boolean
  onSelect: () => void
}

export function SidebarCard({ problem, isActive, onSelect }: SidebarCardProps) {
  const badgeClass = difficultyBadgeClass(problem.difficulty)

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
        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
          {problem.topic}
        </span>
        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
          {problem.pattern}
        </span>
      </div>

      <p className="text-xs text-gray-500 italic leading-snug line-clamp-2">{problem.reason}</p>
      <p className="text-xs text-gray-400 mt-1.5">~{problem.estimatedMinutes} min</p>
    </button>
  )
}
