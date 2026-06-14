import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Feature, TrendPoint } from '../api/client'
import StatCard from '../components/StatCard'
import StateBadge from '../components/StateBadge'
import LineChart from '../components/LineChart'
import DonutChart from '../components/DonutChart'
import DeadFeaturesList from '../components/DeadFeaturesList'
import { useTopbar } from '../components/TopbarContext'
import { COLORS } from '../design-tokens'

const APP_ID = localStorage.getItem('fp_appId') ?? ''

interface RecentTransition {
  id: number; oldState: string; newState: string; changedAt: string
  feature: { resourceName: string | null; screenName: string }
}

interface DashboardData {
  counts: Record<string, number>
  recentTransitions: RecentTransition[]
}

function formatRelativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function GridSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#64748B" strokeWidth="1.4">
      <rect x="1" y="1" width="4.5" height="4.5" rx="0.8"/>
      <rect x="7.5" y="1" width="4.5" height="4.5" rx="0.8"/>
      <rect x="1" y="7.5" width="4.5" height="4.5" rx="0.8"/>
      <rect x="7.5" y="7.5" width="4.5" height="4.5" rx="0.8"/>
    </svg>
  )
}
function DeadSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#DC2626" strokeWidth="1.5">
      <circle cx="6.5" cy="6.5" r="5.5"/>
      <line x1="4" y1="4" x2="9" y2="9" strokeLinecap="round"/>
      <line x1="9" y1="4" x2="4" y2="9" strokeLinecap="round"/>
    </svg>
  )
}
function DeclSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#CA8A04" strokeWidth="1.5">
      <polyline points="1,9 5,5 7,7 12,2" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="8,9 12,9 12,5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
function ThrivSvg() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#16A34A" strokeWidth="1.5">
      <circle cx="6.5" cy="6.5" r="5.5"/>
      <polyline points="3.5,6.5 5.5,8.5 9.5,4.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export default function Dashboard() {
  const nav = useNavigate()
  const { setActions } = useTopbar()
  const [data, setData]         = useState<DashboardData | null>(null)
  const [deadFeatures, setDead] = useState<Feature[]>([])
  const [trend, setTrend]       = useState<{ labels: string[]; data: number[] }>({ labels: [], data: [] })
  const [error, setError]       = useState('')
  const [cronState, setCronState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')

  async function runCron() {
    if (cronState === 'loading') return
    setCronState('loading')
    const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
    const token = localStorage.getItem('fp_token')
    try {
      const res = await fetch(`${BASE}/api/v1/cron`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      })
      if (!res.ok) throw new Error('failed')
      setCronState('ok')
      // Refresh dashboard counts to reflect the new aggregation
      api.getDashboard(APP_ID)
        .then((d) => setData(d as DashboardData))
        .catch(() => {})
    } catch {
      setCronState('error')
    } finally {
      setTimeout(() => setCronState('idle'), 3000)
    }
  }

  useEffect(() => {
    if (!APP_ID) { nav('/settings'); return }
    const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
    Promise.all([
      api.getDashboard(APP_ID),
      api.getFeatures(APP_ID, { state: 'DEAD', page: '1', limit: '8' })
        .catch(() => ({ data: [] as Feature[], pagination: { page: 1, limit: 8, total: 0 } })),
      api.getTrend(APP_ID, 30)
        .catch(() => [] as TrendPoint[]),
    ]).then(([d, dead, trendRows]) => {
      setData(d as DashboardData)
      setDead(dead.data)
      if (trendRows.length > 0) {
        setTrend({
          labels: trendRows.map(r =>
            new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          ),
          data: trendRows.map(r => +(r.avgInteractionRate * 100).toFixed(1)),
        })
      } else {
        // No aggregates yet — flat zero line so the chart renders without crashing
        const N = 30
        setTrend({
          labels: Array.from({ length: N }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (N - 1 - i))
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }),
          data: Array(N).fill(0),
        })
      }
    }).catch((e) => setError(e.message))

    setActions(
      <div className="flex items-center gap-2">
        <button
          onClick={runCron}
          disabled={cronState === 'loading'}
          className={`border font-semibold rounded-lg transition-colors ${
            cronState === 'ok'
              ? 'border-green-300 bg-green-50 text-green-600'
              : cronState === 'error'
              ? 'border-red-300 bg-red-50 text-red-600'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          style={{ padding: '6px 13px', fontSize: 12.5 }}
        >
          {cronState === 'loading' ? 'Running…' : cronState === 'ok' ? '✓ Done' : cronState === 'error' ? 'Error' : 'Run Cron Now'}
        </button>
        <button
          onClick={async () => {
            const token = localStorage.getItem('fp_token')
            const res = await fetch(`${BASE}/api/v1/apps/${APP_ID}/export?format=csv`, {
              headers: { Authorization: `Bearer ${token ?? ''}` },
            })
            if (!res.ok) return
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = 'features.csv'; a.click()
            URL.revokeObjectURL(url)
          }}
          className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold rounded-lg transition-colors"
          style={{ padding: '6px 13px', fontSize: 12.5 }}
        >
          Export CSV
        </button>
      </div>
    )
    return () => setActions(null)
  }, [nav, setActions, runCron, cronState])

  async function handleIgnore(id: string, ignore: boolean) {
    await api.ignoreFeature(id, ignore)
    setDead((prev) => prev.map((f) => (f.id === id ? { ...f, isIgnored: ignore } : f)))
  }

  if (error) return <p className="text-red-600 p-8">{error}</p>
  if (!data)  return <p className="text-slate-400 p-8">Loading…</p>

  const { counts, recentTransitions } = data
  const total = counts['TOTAL'] || 1
  const healthPct = Math.round(((counts['THRIVING'] ?? 0) / total) * 100)
  const healthColor = healthPct >= 70 ? '#16A34A' : healthPct >= 40 ? '#CA8A04' : '#DC2626'

  const donutSegments = [
    { label: 'Thriving',  value: counts['THRIVING']  ?? 0, color: COLORS.green    },
    { label: 'Dead',      value: counts['DEAD']      ?? 0, color: COLORS.red      },
    { label: 'Declining', value: counts['DECLINING'] ?? 0, color: COLORS.yellow   },
    { label: 'Dormant',   value: counts['DORMANT']   ?? 0, color: COLORS.slate300 },
  ]

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-slate-900 font-extrabold mb-1" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
            Feature Health
          </h1>
          <p className="text-slate-500 mb-1.5" style={{ fontSize: 13 }}>
            {localStorage.getItem('fp_appName') ?? 'My App'} · {APP_ID} · {counts['TOTAL'] ?? 0} features tracked
          </p>
          <div className="flex items-center gap-2">
            <span className="text-slate-500" style={{ fontSize: 12 }}>Health score</span>
            <div className="rounded-full overflow-hidden" style={{ width: 110, height: 5, background: '#E2E8F0' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${healthPct}%`,
                  background: 'linear-gradient(90deg, #DC2626 0%, #CA8A04 50%, #16A34A 90%)',
                }}
              />
            </div>
            <span className="font-bold" style={{ fontSize: 12, color: healthColor }}>{healthPct}%</span>
            <span className="text-slate-400" style={{ fontSize: 11.5 }}>
              — {(counts['DECLINING'] ?? 0) + (counts['DORMANT'] ?? 0)} features degraded in the last 30 days
            </span>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3.5 mb-5">
        <StatCard label="Total Features" value={counts['TOTAL'] ?? 0} icon={<GridSvg />} />
        <StatCard
          label="Dead" value={counts['DEAD'] ?? 0}
          valueColor="#DC2626" borderColor="#FECACA"
          icon={<DeadSvg />} iconBg="#FEE2E2"
        />
        <StatCard
          label="Declining" value={counts['DECLINING'] ?? 0}
          valueColor="#CA8A04" borderColor="#FEF08A"
          icon={<DeclSvg />} iconBg="#FEF9C3"
        />
        <StatCard
          label="Thriving" value={counts['THRIVING'] ?? 0}
          valueColor="#16A34A" borderColor="#BBF7D0"
          icon={<ThrivSvg />} iconBg="#DCFCE7"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Line chart */}
        <div className="bg-white rounded-card border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Interaction Rate — Last 30 Days</p>
            <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>
              Average % of sessions where each feature was interacted with
            </p>
          </div>
          <div className="p-5">
            <LineChart labels={trend.labels} data={trend.data} color={COLORS.indigo} height={196} />
          </div>
        </div>

        {/* Donut chart */}
        <div className="bg-white rounded-card border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>State Distribution</p>
            <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>Current classification</p>
          </div>
          <div className="p-5">
            <DonutChart segments={donutSegments} height={148} />
            <div className="mt-3.5 flex flex-col gap-1.5">
              {donutSegments.map(({ label, value, color }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span
                    className="inline-block rounded-full flex-shrink-0"
                    style={{ width: 9, height: 9, background: color }}
                  />
                  <span className="text-slate-600 flex-1" style={{ fontSize: 12.5 }}>{label}</span>
                  <span className="text-slate-800 font-bold" style={{ fontSize: 12.5 }}>{value}</span>
                  <span className="text-slate-400 text-right" style={{ fontSize: 11, width: 32 }}>
                    {Math.round((value / total) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1.15fr 1fr' }}>
        {/* Recent state changes */}
        <div className="bg-white rounded-card border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Recent State Changes</p>
            <Link to="/features" className="text-indigo-600 font-semibold hover:underline" style={{ fontSize: 12 }}>
              View all transitions
            </Link>
          </div>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Feature', 'Transition', 'When'].map((h) => (
                  <th key={h} className="text-left text-slate-400 font-bold uppercase"
                    style={{ padding: '8px 20px', fontSize: 10, letterSpacing: '0.07em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentTransitions.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>
                    No state changes yet — run the nightly cron first.
                  </td>
                </tr>
              )}
              {recentTransitions.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 last:border-none hover:bg-slate-50 transition-colors">
                  <td style={{ padding: '11px 20px' }}>
                    <div className="font-mono text-slate-800" style={{ fontSize: 11.5 }}>
                      {t.feature.resourceName ?? '(unnamed)'}
                    </div>
                    <div className="text-slate-400 mt-0.5" style={{ fontSize: 11 }}>{t.feature.screenName}</div>
                  </td>
                  <td style={{ padding: '11px 20px' }}>
                    <div className="flex items-center gap-1.5">
                      <StateBadge state={t.oldState as Feature['state']} />
                      <span className="text-slate-300" style={{ fontSize: 13 }}>→</span>
                      <StateBadge state={t.newState as Feature['state']} />
                    </div>
                  </td>
                  <td className="text-slate-400" style={{ padding: '11px 20px', fontSize: 11.5 }}>
                    {formatRelativeTime(t.changedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dead features */}
        <div className="bg-white rounded-card border border-slate-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Dead Features</p>
            <Link to="/features" className="text-indigo-600 font-semibold hover:underline" style={{ fontSize: 12 }}>
              Manage all
            </Link>
          </div>
          <DeadFeaturesList features={deadFeatures} onIgnore={handleIgnore} />
        </div>
      </div>
    </div>
  )
}
