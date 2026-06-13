// portal/src/components/TimelineChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { TimelineRow } from '../api/client'

interface Props { data: TimelineRow[] }

export default function TimelineChart({ data }: Props) {
  const chartData = data.map(row => ({
    date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    rate: parseFloat((row.interactionRate * 100).toFixed(2)),
    interactions: row.interactions,
    impressions: row.impressions,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#F1F5F9" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit="%" />
        <Tooltip formatter={(v) => [`${Number(v).toFixed(2)}%`, 'Interaction rate']} />
        <Line type="monotone" dataKey="rate" stroke="#4F46E5" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
