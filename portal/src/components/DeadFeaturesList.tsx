import type { Feature } from '../api/client'

interface Props {
  features: Feature[]
  onIgnore: (id: string, ignore: boolean) => void
}

export default function DeadFeaturesList({ features, onIgnore }: Props) {
  if (features.length === 0) {
    return (
      <p className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>
        No dead features
      </p>
    )
  }

  return (
    <div>
      {features.map((f) => (
        <div
          key={f.id}
          className="flex items-center gap-3 px-5 py-3 border-b border-slate-50 last:border-none hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div
            className="flex-shrink-0 flex items-center justify-center bg-red-100 rounded-lg"
            style={{ width: 30, height: 30 }}
          >
            <svg
              viewBox="0 0 14 14"
              style={{ width: 14, height: 14, stroke: '#DC2626', fill: 'none', strokeWidth: 1.8 }}
            >
              <line x1="4" y1="4" x2="10" y2="10" />
              <line x1="10" y1="4" x2="4" y2="10" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-slate-800 truncate font-medium" style={{ fontSize: 11.5 }}>
              {f.resourceName ?? f.elementType}
            </div>
            <div className="text-slate-400 mt-0.5" style={{ fontSize: 10.5 }}>
              {f.screenName} · {f.elementType}
            </div>
          </div>
          <div className="text-red-600 font-bold flex-shrink-0" style={{ fontSize: 11.5 }}>
            {f.daysSinceLastUse != null ? `${f.daysSinceLastUse}d` : '—'}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onIgnore(f.id, !f.isIgnored)
            }}
            className="text-slate-400 border border-slate-200 bg-white rounded hover:bg-slate-100 hover:text-slate-700 transition-colors flex-shrink-0"
            style={{ fontSize: 11, padding: '3px 8px' }}
          >
            {f.isIgnored ? 'Unignore' : 'Ignore'}
          </button>
        </div>
      ))}
    </div>
  )
}
