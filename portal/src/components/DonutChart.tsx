import { Doughnut } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

interface Props {
  segments: DonutSegment[]
  height?: number
}

export default function DonutChart({ segments, height = 148 }: Props) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '74%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F172A',
        titleColor: '#94A3B8',
        bodyColor: '#F8FAFC',
        borderColor: '#334155',
        borderWidth: 1,
        padding: 10,
        titleFont: { family: 'Inter', size: 11 },
        bodyFont: { family: 'Inter', size: 12 },
        callbacks: {
          label: (ctx) =>
            `  ${ctx.parsed} features (${Math.round((ctx.parsed / total) * 100)}%)`,
        },
      },
    },
    animation: { animateRotate: true, duration: 600 },
  }

  const chartData = {
    labels: segments.map((s) => s.label),
    datasets: [
      {
        data: segments.map((s) => s.value),
        backgroundColor: segments.map((s) => s.color),
        borderWidth: 3,
        borderColor: '#FFFFFF',
        hoverOffset: 5,
      },
    ],
  }

  return (
    <div style={{ height }}>
      <Doughnut data={chartData} options={options} />
    </div>
  )
}
