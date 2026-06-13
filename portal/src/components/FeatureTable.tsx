// portal/src/components/FeatureTable.tsx
import { useNavigate } from 'react-router-dom'
import StateBadge from './StateBadge'
import type { Feature } from '../api/client'

interface Props {
  features: Feature[]
  onIgnore?: (id: string, ignore: boolean) => void
}

export default function FeatureTable({ features, onIgnore }: Props) {
  const nav = useNavigate()

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left' }}>
          {['Element', 'Screen', 'State', 'Last used', 'Actions'].map(h => (
            <th key={h} style={{ padding: '10px 12px', color: '#64748B', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {features.map(f => (
          <tr key={f.id} style={{ borderBottom: '1px solid #F1F5F9' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}>
            <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#334155' }}>
              {f.resourceName ?? f.elementType}
            </td>
            <td style={{ padding: '10px 12px', color: '#64748B' }}>{f.screenName}</td>
            <td style={{ padding: '10px 12px' }}><StateBadge state={f.state} /></td>
            <td style={{ padding: '10px 12px', color: '#94A3B8' }}>
              {f.daysSinceLastUse !== null ? `${f.daysSinceLastUse}d ago` : 'Never'}
            </td>
            <td style={{ padding: '10px 12px' }}>
              <button onClick={() => nav(`/features/${f.id}`)}
                style={{ marginRight: 8, padding: '4px 10px', border: '1px solid #E2E8F0',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13, background: '#fff' }}>
                Detail
              </button>
              {onIgnore && (
                <button onClick={() => onIgnore(f.id, !f.isIgnored)}
                  style={{ padding: '4px 10px', border: '1px solid #E2E8F0',
                    borderRadius: 6, cursor: 'pointer', fontSize: 13, background: '#fff',
                    color: f.isIgnored ? '#16A34A' : '#94A3B8' }}>
                  {f.isIgnored ? 'Unignore' : 'Ignore'}
                </button>
              )}
            </td>
          </tr>
        ))}
        {features.length === 0 && (
          <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>No features found</td></tr>
        )}
      </tbody>
    </table>
  )
}
