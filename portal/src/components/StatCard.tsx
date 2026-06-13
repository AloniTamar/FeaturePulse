// portal/src/components/StatCard.tsx
interface Props { label: string; value: number | string; color?: string }

export default function StatCard({ label, value, color = '#0F172A' }: Props) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '20px 24px', flex: 1,
    }}>
      <div style={{ fontSize: 36, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>{label}</div>
    </div>
  )
}
