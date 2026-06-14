import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import StateBadge from '../components/StateBadge'
import TimelineChart from '../components/TimelineChart'
import type { Feature, TimelineRow } from '../api/client'

export default function FeatureDetail() {
  const { featureId } = useParams<{ featureId: string }>()
  const nav = useNavigate()
  const [feature,  setFeature]  = useState<Feature | null>(null)
  const [timeline, setTimeline] = useState<TimelineRow[]>([])
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!featureId) return
    Promise.all([api.getFeature(featureId), api.getTimeline(featureId, 30)])
      .then(([f, t]) => { setFeature(f); setTimeline(t) })
      .catch((e) => setError(e.message))
  }, [featureId])

  async function toggleIgnore() {
    if (!feature) return
    const updated = await api.ignoreFeature(feature.id, !feature.isIgnored)
    setFeature(updated)
  }

  if (error)    return <p className="text-red-600 p-8">{error}</p>
  if (!feature) return <p className="text-slate-400 p-8">Loading…</p>

  const meta = [
    {
      label: 'Last Interaction',
      value: feature.daysSinceLastUse !== null ? `${feature.daysSinceLastUse}d ago` : 'Never',
      danger: feature.state === 'DEAD',
    },
    { label: 'First Seen',   value: new Date(feature.firstSeen).toLocaleDateString() },
    { label: 'Element Type', value: feature.elementType },
    { label: 'Screen',       value: feature.screenName },
  ]

  return (
    <div>
      {/* Back */}
      <button
        onClick={() => nav(-1)}
        className="text-slate-500 hover:text-slate-900 font-medium mb-5 transition-colors"
        style={{ fontSize: 13 }}
      >
        ← Features
      </button>

      {/* Hero row */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <h1 className="font-mono text-slate-900 font-semibold mb-1" style={{ fontSize: 24 }}>
            {feature.resourceName ?? feature.elementType}
          </h1>
          <p className="text-slate-500" style={{ fontSize: 14 }}>
            {feature.screenName} · {feature.elementType}
          </p>
        </div>
        <StateBadge state={feature.state} />
        <button
          onClick={toggleIgnore}
          className="border border-slate-200 bg-white rounded-lg text-slate-600 hover:bg-slate-50 font-medium transition-colors"
          style={{ padding: '6px 14px', fontSize: 13, color: feature.isIgnored ? '#16A34A' : undefined }}
        >
          {feature.isIgnored ? 'Unignore' : 'Ignore'}
        </button>
      </div>

      {/* Timeline chart */}
      <div className="bg-white rounded-card border border-slate-200 p-6 mb-5">
        <h2 className="text-slate-900 font-bold mb-4" style={{ fontSize: 14 }}>
          Interaction Rate — Last 30 Days
        </h2>
        {timeline.length > 0 ? (
          <TimelineChart data={timeline} />
        ) : (
          <p className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>No data yet</p>
        )}
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-card border border-slate-200 overflow-hidden">
        {meta.map(({ label, value, danger }) => (
          <div
            key={label}
            className="flex justify-between items-center border-b border-slate-50 last:border-none"
            style={{ padding: '14px 20px' }}
          >
            <span className="text-slate-500" style={{ fontSize: 14 }}>{label}</span>
            <span
              className="font-semibold"
              style={{ fontSize: 14, color: danger ? '#DC2626' : '#334155' }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
