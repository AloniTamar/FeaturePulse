interface ReachRow {
  featureId: string
  resourceName: string | null
  screenName: string
  reachPct: number
}

export default function ReachBarChart({ data }: { data: ReachRow[] }) {
  const BAR_H  = 18
  const GAP    = 8
  const LABEL_W = 110
  const BAR_W  = 140
  const height = data.length * (BAR_H + GAP) + GAP

  if (data.length === 0) {
    return <p className="text-slate-400 text-center py-6" style={{ fontSize: 13 }}>No data yet</p>
  }

  return (
    <svg width={LABEL_W + BAR_W + 44} height={height}>
      {data.map((row, i) => {
        const y      = i * (BAR_H + GAP) + GAP
        const label  = (row.resourceName ?? row.screenName)
        const short  = label.length > 14 ? label.slice(0, 13) + '…' : label
        const filledW = (row.reachPct / 100) * BAR_W
        return (
          <g key={row.featureId}>
            <text x={LABEL_W - 6} y={y + 13} textAnchor="end" fontSize={10.5} fill="#64748B">{short}</text>
            <rect x={LABEL_W} y={y} width={BAR_W} height={BAR_H} rx={3} fill="#E2E8F0" />
            <rect x={LABEL_W} y={y} width={filledW || 1} height={BAR_H} rx={3} fill="#6366F1" />
            <text x={LABEL_W + BAR_W + 6} y={y + 13} fontSize={10.5} fill="#334155" fontWeight="600">
              {row.reachPct}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}
