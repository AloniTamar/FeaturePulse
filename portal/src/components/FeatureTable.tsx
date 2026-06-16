import { useNavigate, useParams } from 'react-router-dom'
import StateBadge from './StateBadge'
import type { Feature } from '../api/client'

interface Props {
  features: Feature[]
  onIgnore?: (id: string, ignore: boolean) => void
}

export default function FeatureTable({ features, onIgnore }: Props) {
  const nav = useNavigate()
  const { appId } = useParams<{ appId: string }>()

  return (
    <table className="w-full" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {['Feature', 'Type', 'State', 'Last Used', 'Actions'].map((h) => (
            <th
              key={h}
              className="text-left text-slate-400 font-bold uppercase"
              style={{ padding: '8px 20px', fontSize: 10, letterSpacing: '0.07em' }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {features.map((f) => (
          <tr
            key={f.id}
            className="border-b border-slate-50 last:border-none cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => nav(`/apps/${appId}/features/${f.id}`)}
          >
            <td style={{ padding: '11px 20px' }}>
              <div className="font-mono text-slate-800 font-medium" style={{ fontSize: 11.5 }}>
                {f.resourceName ?? f.elementType}
              </div>
              <div className="text-slate-400 mt-0.5" style={{ fontSize: 11 }}>
                {f.screenName}
              </div>
            </td>
            <td className="text-slate-700" style={{ padding: '11px 20px', fontSize: 12.5 }}>
              {f.elementType}
            </td>
            <td style={{ padding: '11px 20px' }}>
              <StateBadge state={f.state} />
            </td>
            <td className="text-slate-400" style={{ padding: '11px 20px', fontSize: 11.5 }}>
              {f.daysSinceLastUse !== null ? `${f.daysSinceLastUse}d ago` : 'Never'}
            </td>
            <td style={{ padding: '11px 20px' }} onClick={(e) => e.stopPropagation()}>
              {onIgnore && (
                <button
                  onClick={() => onIgnore(f.id, !f.isIgnored)}
                  className="border border-slate-200 bg-white rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  style={{ fontSize: 11, padding: '3px 8px' }}
                >
                  {f.isIgnored ? 'Unignore' : 'Ignore'}
                </button>
              )}
            </td>
          </tr>
        ))}
        {features.length === 0 && (
          <tr>
            <td colSpan={5} className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>
              No features found
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
