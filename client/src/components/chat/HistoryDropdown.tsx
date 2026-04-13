import { useEffect, useRef } from 'react'
import type { ChatSessionRecord } from '../../lib/api'
import { SessionItem } from './SessionItem'

function SkeletonItem() {
  return (
    <div className="px-3 py-2.5 space-y-1.5">
      <div className="h-3.5 bg-gray-100 rounded w-3/4 animate-pulse" />
      <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse" />
    </div>
  )
}

export function HistoryDropdown({
  sessions,
  activeSessionId,
  isLoading,
  isOpen,
  onClose,
  onSelect,
  onNewChat,
}: {
  sessions: ChatSessionRecord[]
  activeSessionId: string | null
  isLoading: boolean
  isOpen: boolean
  onClose: () => void
  onSelect: (sessionId: string) => void
  onNewChat: () => void
}) {
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen, onClose])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden"
    >
      {/* New chat button */}
      <div className="p-2 border-b border-gray-100">
        <button
          onClick={() => { onNewChat(); onClose() }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 shrink-0">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          New chat
        </button>
      </div>

      {/* Session list */}
      <div className="max-h-[60vh] overflow-y-auto p-1.5">
        {isLoading ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No past chats yet.</p>
        ) : (
          sessions.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              isActive={s.id === activeSessionId}
              onClick={() => { onSelect(s.id); onClose() }}
            />
          ))
        )}
      </div>
    </div>
  )
}
