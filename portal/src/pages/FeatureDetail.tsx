// portal/src/pages/FeatureDetail.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import NavBar from '../components/NavBar'
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
      .catch(e => setError(e.message))
  }, [featureId])

  async function toggleIgnore() {
    if (!feature) return
    const updated = await api.ignoreFeature(feature.id, !feature.isIgnored)
    setFeature(updated)
  }

  if (error)    return <><NavBar /><p style={{ padding: 32, color: '#DC2626' }}>{error}</p></>
  if (!feature) return <><NavBar /><p style={{ padding: 32, color: '#94A3B8' }}>Loading…</p></>

  const rows = [
    { label: 'Last Interaction', value: feature.daysSinceLastUse !== null ? `${feature.daysSinceLastUse}d ago` : 'Never', danger: feature.state === 'DEAD' },
    { label: 'First Seen',       value: new Date(feature.firstSeen).toLocaleDateString() },
    { label: 'Element Type',     value: feature.elementType },
    { label: 'Screen',           value: feature.screenName },
  ]

  return (
    <>
      <NavBar />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
        <button onClick={() => nav(-1)}
          style={{ marginBottom: 20, padding: '6px 12px', border: '1px solid #E2E8F0',
            borderRadius: 6, cursor: 'pointer', background: '#fff', fontSize: 14, color: '#475569' }}>
          ← Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
              {feature.resourceName ?? feature.elementType}
            </h1>
            <p style={{ color: '#64748B', fontSize: 14 }}>{feature.screenName} · {feature.elementType}</p>
          </div>
          <StateBadge state={feature.state} />
          <button onClick={toggleIgnore}
            style={{ padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8,
              cursor: 'pointer', background: '#fff', fontSize: 14,
              color: feature.isIgnored ? '#16A34A' : '#64748B' }}>
            {feature.isIgnored ? 'Unignore' : 'Ignore'}
          </button>
        </div>

        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#0F172A' }}>
            Interaction Rate — Last 30 Days
          </h2>
          {timeline.length > 0
            ? <TimelineChart data={timeline} />
            : <p style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>No data yet</p>}
        </div>

        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          {rows.map(({ label, value, danger }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', padding: '14px 20px',
              borderBottom: '1px solid #F1F5F9',
            }}>
              <span style={{ color: '#64748B', fontSize: 14 }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: danger ? '#DC2626' : '#334155' }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
