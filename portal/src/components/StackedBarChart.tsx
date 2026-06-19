interface ScreenRow {
  screenName: string
  thriving: number
  declining: number
  dormant: number
  dead: number
  healthPct: number
}

export default function StackedBarChart({ data }: { data: ScreenRow[] }) {
  const BAR_H  = 22
  const GAP    = 10
  const LABEL_W = 120
  const BAR_W  = 240
  const height = data.length * (BAR_H + GAP) + GAP

  if (data.length === 0) {
    return <p className="text-slate-400 text-center py-6" style={{ fontSize: 13 }}>No screen data yet</p>
  }

  return (
    <svg width={LABEL_W + BAR_W + 44} height={height}>
      {data.map((row, i) => {
        const y     = i * (BAR_H + GAP) + GAP
        const total = row.thriving + row.declining + row.dormant + row.dead || 1
        const thrivW = (row.thriving / total) * BAR_W
        const declW  = ((row.declining + row.dormant) / total) * BAR_W
        const deadW  = (row.dead / total) * BAR_W
        const label  = row.screenName.length > 16 ? row.screenName.slice(0, 15) + '…' : row.screenName
        return (
          <g key={row.screenName}>
            <text x={LABEL_W - 8} y={y + 15} textAnchor="end" fontSize={11} fill="#64748B">{label}</text>
            <rect x={LABEL_W}                    y={y} width={BAR_W} height={BAR_H} rx={3} fill="#F1F5F9" />
            <rect x={LABEL_W}                    y={y} width={thrivW} height={BAR_H} rx={3} fill="#16A34A" />
            <rect x={LABEL_W + thrivW}           y={y} width={declW}  height={BAR_H} fill="#CA8A04" />
            <rect x={LABEL_W + thrivW + declW}   y={y} width={deadW}  height={BAR_H} fill="#DC2626" />
            <text x={LABEL_W + BAR_W + 8} y={y + 15} fontSize={11} fill="#334155" fontWeight="600">
              {row.healthPct}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}
