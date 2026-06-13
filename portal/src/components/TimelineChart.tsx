import LineChart from './LineChart'
import type { TimelineRow } from '../api/client'

interface Props { data: TimelineRow[] }

const N = 30

function buildLabels(data: TimelineRow[]): string[] {
  if (data.length > 0) {
    return data.map((r) =>
      new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    )
  }
  return Array.from({ length: N }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (N - 1 - i))
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
}

export default function TimelineChart({ data }: Props) {
  const labels = buildLabels(data)
  const values = data.length > 0
    ? data.map((r) => parseFloat((r.interactionRate * 100).toFixed(2)))
    : Array(N).fill(0)

  return <LineChart labels={labels} data={values} height={220} />
}
