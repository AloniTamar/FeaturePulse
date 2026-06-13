import type { Feature } from '../api/client'

const CLASSES: Record<Feature['state'], string> = {
  THRIVING: 'bg-green-100 text-green-600',
  DECLINING: 'bg-yellow-100 text-yellow-600',
  DORMANT:   'bg-orange-100 text-orange-600',
  DEAD:      'bg-red-100 text-red-600',
}

export default function StateBadge({ state }: { state: Feature['state'] }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold ${CLASSES[state]}`}
      style={{ fontSize: 10.5, padding: '2px 8px', letterSpacing: '0.04em' }}
    >
      {state}
    </span>
  )
}
