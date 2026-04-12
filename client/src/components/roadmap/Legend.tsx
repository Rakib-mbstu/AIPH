interface LegendProps {
  color: string
  label: string
  ring?: boolean
}

export function Legend({ color, label, ring = false }: LegendProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`inline-block w-3 h-3 rounded ${color} ${
          ring ? 'ring-2 ring-rose-400 ring-offset-1' : ''
        }`}
      />
      <span className="text-gray-600">{label}</span>
    </div>
  )
}
