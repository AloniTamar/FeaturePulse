// portal/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import NavBar from '../components/NavBar'
import StatCard from '../components/StatCard'
import StateBadge from '../components/StateBadge'
import type { Feature } from '../api/client'

const APP_ID = localStorage.getItem('fp_appId') ?? ''

interface DashboardData {
  counts: { TOTAL: number; THRIVING: number; DECLINING: number; DORMANT: number; DEAD: number }
  recentTransitions: Array<{
    id: number; oldState: string; newState: string; changedAt: string; reason: string
    feature: { resourceName: string | null; screenName: string }
  }>
}

export default function Dashboard() {
  const nav = useNavigate()
  const [data, setData]   = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!APP_ID) { nav('/settings'); return }
    api.getDashboard(APP_ID)
      .then(d => setData(d as DashboardData))
      .catch(e => setError(e.message))
  }, [nav])

  if (error) return <><NavBar /><p style={{ padding: 32, color: '#DC2626' }}>{error}</p></>
  if (!data)  return <><NavBar /><p style={{ padding: 32, color: '#94A3B8' }}>Loading…</p></>

  const { counts, recentTransitions } = data

  return (
    <>
      <NavBar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#0F172A' }}>Feature Health</h1>
        <p style={{ color: '#64748B', marginBottom: 28 }}>App · {APP_ID}</p>

        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          <StatCard label="Total Features" value={counts.TOTAL} />
          <StatCard label="Dead"      value={counts.DEAD}      color="#DC2626" />
          <StatCard label="Declining" value={counts.DECLINING} color="#CA8A04" />
          <StatCard label="Thriving"  value={counts.THRIVING}  color="#16A34A" />
        </div>

        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#0F172A' }}>
          Recent State Changes
        </h2>
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          {recentTransitions.length === 0 && (
            <p style={{ padding: 24, color: '#94A3B8' }}>No state changes yet — run the nightly cron first.</p>
          )}
          {recentTransitions.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 20px', borderBottom: '1px solid #F1F5F9',
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#334155', flex: 1 }}>
                {t.feature.resourceName ?? '(unnamed)'} · {t.feature.screenName}
              </span>
              <StateBadge state={t.newState as Feature['state']} />
              <span style={{ fontSize: 12, color: '#94A3B8' }}>
                {new Date(t.changedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
