interface HistogramProps {
  data: { bucket: string; count: number }[]
  height?: number
}

export default function Histogram({ data, height = 160 }: HistogramProps) {
  const W         = 320
  const PAD_TOP   = 24
  const PAD_BOT   = 28
  const INNER_H   = height - PAD_TOP - PAD_BOT
  const maxCount  = Math.max(...data.map(d => d.count), 1)
  const slotW     = W / data.length
  const barW      = slotW * 0.55

  return (
    <svg width={W} height={height}>
      {data.map((d, i) => {
        const barH = (d.count / maxCount) * INNER_H
        const x    = i * slotW + (slotW - barW) / 2
        const y    = PAD_TOP + INNER_H - barH
        return (
          <g key={d.bucket}>
            <rect x={x} y={y} width={barW} height={barH || 2} rx={3} fill="#6366F1" opacity={0.85} />
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={11} fill="#334155" fontWeight="600">
                {d.count}
              </text>
            )}
            <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="#94A3B8">
              {d.bucket}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
