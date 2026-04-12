import { useNavigate } from 'react-router-dom'
import type { NodeProps } from '@xyflow/react'
import type { RoadmapTopic } from '../../lib/api'
import { track } from '../../lib/analytics'
import { statusStyles } from './constants'

interface TopicNodeData {
  topic: RoadmapTopic
  highlighted?: boolean
}

export function TopicNode({ data }: NodeProps) {
  const navigate = useNavigate()
  const { topic, highlighted = false } = data as TopicNodeData

  const pct = Math.max(0, Math.min(100, topic.progress?.masteryScore ?? 0))
  const { bg, border, text } = statusStyles(topic.status)
  const isWeak = topic.weakness !== null
  const isClickable = topic.status !== 'locked'

  const handleNav = () => {
    if (!isClickable) return
    track('cross_nav', { from: 'roadmap', to: 'problems', topic: topic.name })
    navigate(`/problems?topic=${encodeURIComponent(topic.name)}`)
  }

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={handleNav}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          handleNav()
        }
      }}
      className={[
        `rounded-lg border-2 ${border} ${bg} ${text} px-3 py-2 w-[180px] shadow-sm`,
        isWeak      ? 'ring-2 ring-rose-400 ring-offset-2' : '',
        highlighted ? 'ring-4 ring-amber-400 ring-offset-2 animate-pulse' : '',
        isClickable ? 'cursor-pointer hover:ring-2 hover:ring-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-sm leading-tight">{topic.name}</div>
        {isWeak && (
          <span className="text-[10px] font-bold uppercase bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
            {topic.weakness!.reason}
          </span>
        )}
      </div>

      <div className="mt-2">
        <div className="h-1.5 bg-black/10 rounded-full overflow-hidden">
          <div className="h-full bg-white/80 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[10px] mt-1 opacity-80">
          {topic.status === 'locked'
            ? 'Locked'
            : `${pct}% · ${topic.progress?.attemptCount ?? 0} attempts`}
        </div>
      </div>
    </div>
  )
}

// Exported as the nodeTypes map so ReactFlow can resolve the 'topic' type
export const nodeTypes = { topic: TopicNode }
