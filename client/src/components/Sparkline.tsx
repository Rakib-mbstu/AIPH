/**
 * Sparkline — zero-dependency SVG trend line.
 *
 * Renders a small line chart from an array of 0–100 scores. Used for pattern
 * trajectory on the roadmap and tracker pages. Handles empty / single-point
 * cases gracefully.
 */

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  stroke?: string
  fill?: string
}

export function Sparkline({
  values,
  width = 120,
  height = 32,
  stroke = '#6366f1',
  fill = 'rgba(99, 102, 241, 0.12)',
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-[10px] text-gray-400"
        style={{ width, height }}
      >
        no data
      </div>
    )
  }

  // Pad a single-point series so it still renders as a dot
  const series = values.length === 1 ? [values[0], values[0]] : values

  // Fixed 0–100 domain so series are visually comparable across patterns
  const min = 0
  const max = 100
  const range = max - min

  const stepX = series.length > 1 ? width / (series.length - 1) : 0
  const points = series.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * height
    return { x, y }
  })

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area =
    `M${points[0].x},${height} ` +
    points.map((p) => `L${p.x},${p.y}`).join(' ') +
    ` L${points[points.length - 1].x},${height} Z`

  const last = points[points.length - 1]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <path d={area} fill={fill} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r={2.5} fill={stroke} />
    </svg>
  )
}
