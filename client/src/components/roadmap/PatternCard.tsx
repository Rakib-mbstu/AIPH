import { useNavigate } from 'react-router-dom'
import type { RoadmapPattern } from '../../lib/api'
import { track } from '../../lib/analytics'
import { Sparkline } from '../Sparkline'
import { MasteryBar } from './MasteryBar'

interface PatternCardProps {
  pattern: RoadmapPattern
}

export function PatternCard({ pattern }: PatternCardProps) {
  const navigate = useNavigate()

  const score      = pattern.mastery?.masteryScore   ?? 0
  const confidence = pattern.mastery?.confidenceScore ?? 0
  const solved     = pattern.mastery?.solvedCount     ?? 0

  const handleNav = () => {
    track('cross_nav', { from: 'roadmap', to: 'problems', pattern: pattern.name })
    navigate(`/problems?pattern=${encodeURIComponent(pattern.name)}`)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleNav}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleNav()
        }
      }}
      className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md cursor-pointer transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{pattern.name}</h3>
        <span className="text-xs text-gray-500">{solved} solved</span>
      </div>

      <div className="space-y-2">
        <MasteryBar value={score}      label="Mastery" />
        <MasteryBar value={confidence} label="Confidence" tone="emerald" />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          Last {pattern.recentScores.length || 0} attempts
        </span>
        <Sparkline values={pattern.recentScores} width={100} height={28} />
      </div>
    </div>
  )
}
