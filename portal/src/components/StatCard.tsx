import type { ReactNode } from 'react'

interface Props {
  label: string
  value: number | string
  valueColor?: string
  borderColor?: string
  icon: ReactNode
  iconBg?: string
}

export default function StatCard({
  label,
  value,
  valueColor = '#0F172A',
  borderColor = '#E2E8F0',
  icon,
  iconBg = '#F1F5F9',
}: Props) {
  return (
    <div
      className="bg-white rounded-card p-5 cursor-pointer transition-all hover:-translate-y-px hover:shadow-md flex-1"
      style={{ border: `1px solid ${borderColor}` }}
    >
      <div className="flex items-center justify-between mb-3.5">
        <span
          className="uppercase text-slate-500 font-bold"
          style={{ fontSize: 11, letterSpacing: '0.07em' }}
        >
          {label}
        </span>
        <div
          className="flex items-center justify-center rounded-lg"
          style={{ width: 28, height: 28, background: iconBg }}
        >
          {icon}
        </div>
      </div>
      <div
        className="font-black leading-none"
        style={{ fontSize: 36, letterSpacing: '-1.5px', color: valueColor }}
      >
        {value}
      </div>
    </div>
  )
}
