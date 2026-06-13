import { Line } from 'react-chartjs-2'
import type { ChartOptions } from 'chart.js'
import { COLORS } from '../design-tokens'

interface Props {
  labels: string[]
  data: number[]
  color?: string
  height?: number
}

const BASE_OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { intersect: false, mode: 'index' },
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
        label: (ctx) => `  ${ctx.parsed.y.toFixed(1)}% interaction rate`,
      },
    },
  },
  scales: {
    x: {
      grid: { color: '#F1F5F9' },
      ticks: {
        color: '#94A3B8',
        font: { family: 'Inter', size: 10 },
        maxTicksLimit: 8,
        maxRotation: 0,
      },
    },
    y: {
      grid: { color: '#F1F5F9' },
      ticks: {
        color: '#94A3B8',
        font: { family: 'Inter', size: 10 },
        callback: (v) => `${v}%`,
        maxTicksLimit: 5,
      },
      min: 0,
    },
  },
}

export default function LineChart({
  labels,
  data,
  color = COLORS.indigo,
  height = 196,
}: Props) {
  const chartData = {
    labels,
    datasets: [
      {
        data,
        borderColor: color,
        backgroundColor: color + '15',
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  }

  return (
    <div style={{ height }}>
      <Line data={chartData} options={BASE_OPTIONS} />
    </div>
  )
}
