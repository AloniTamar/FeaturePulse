// portal/src/components/StateBadge.tsx
import type { Feature } from '../api/client'

const STATE_COLORS: Record<Feature['state'], { bg: string; text: string }> = {
  THRIVING: { bg: '#DCFCE7', text: '#16A34A' },
  DECLINING: { bg: '#FEF9C3', text: '#CA8A04' },
  DORMANT:   { bg: '#FFEDD5', text: '#EA580C' },
  DEAD:      { bg: '#FEE2E2', text: '#DC2626' },
}

export default function StateBadge({ state }: { state: Feature['state'] }) {
  const { bg, text } = STATE_COLORS[state]
  return (
    <span style={{
      background: bg, color: text, padding: '2px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
    }}>
      {state}
    </span>
  )
}
