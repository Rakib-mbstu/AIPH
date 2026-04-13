import type { SystemDesignTopicWithProgress } from '../../lib/api'
import { scoreBarColor } from './scoreColors'

const CATEGORY_COLORS: Record<string, string> = {
  'Infrastructure':       'bg-blue-100 text-blue-700',
  'Storage':              'bg-amber-100 text-amber-700',
  'Async Communication':  'bg-purple-100 text-purple-700',
  'Distributed Systems':  'bg-red-100 text-red-700',
  'Architecture':         'bg-teal-100 text-teal-700',
  'Microservices':        'bg-indigo-100 text-indigo-700',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner:     'text-emerald-600',
  intermediate: 'text-amber-600',
  advanced:     'text-red-600',
}

export function TopicProgressCard({ topic }: { topic: SystemDesignTopicWithProgress }) {
  const mastery = topic.progress?.masteryScore ?? 0
  const attempts = topic.progress?.attemptCount ?? 0

  const barColor = scoreBarColor(mastery)

  const categoryClass =
    CATEGORY_COLORS[topic.category] ?? 'bg-gray-100 text-gray-600'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-gray-800 leading-tight">{topic.name}</p>
          <p className={`text-xs mt-0.5 ${DIFFICULTY_COLORS[topic.difficulty] ?? 'text-gray-500'}`}>
            {topic.difficulty}
          </p>
        </div>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${categoryClass}`}>
          {topic.category}
        </span>
      </div>

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Mastery</span>
          <span>{mastery > 0 ? `${mastery}%` : '—'}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${mastery}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-gray-400">
        {attempts > 0 ? `${attempts} attempt${attempts !== 1 ? 's' : ''}` : 'Not started'}
      </p>
    </div>
  )
}
