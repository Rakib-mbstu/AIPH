import type { ChatSessionRecord } from '../../lib/api'

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(diff / 86_400_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'Yesterday'
  if (d < 7) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function SessionItem({
  session,
  isActive,
  onClick,
}: {
  session: ChatSessionRecord
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-3 py-2.5 rounded-lg transition-colors',
        isActive
          ? 'bg-indigo-50 border-l-2 border-indigo-500 pl-2.5'
          : 'hover:bg-gray-50 border-l-2 border-transparent',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={[
            'text-sm truncate leading-tight',
            isActive ? 'font-semibold text-indigo-900' : 'font-medium text-gray-800',
          ].join(' ')}
        >
          {session.title}
        </span>
        <span className="text-xs text-gray-400 shrink-0 mt-0.5">
          {relativeTime(session.updatedAt)}
        </span>
      </div>
      {session.preview && (
        <p className="text-xs text-gray-500 truncate mt-0.5 leading-snug">
          {session.preview}
        </p>
      )}
    </button>
  )
}
