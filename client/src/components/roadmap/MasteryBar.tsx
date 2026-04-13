interface MasteryBarProps {
  value: number
  label?: string
  tone?: 'indigo' | 'emerald'
}

export function MasteryBar({ value, label = 'Mastery', tone = 'indigo' }: MasteryBarProps) {
  const pct = Math.max(0, Math.min(100, value))
  const fill = tone === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500'

  return (
    <div>
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${fill} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
