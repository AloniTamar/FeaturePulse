import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { AnalyticsData, Feature } from '../api/client'
import { useApp } from '../context/AppContext'
import StateBadge from '../components/StateBadge'
import LineChart from '../components/LineChart'
import StackedBarChart from '../components/StackedBarChart'
import Histogram from '../components/Histogram'
import ReachBarChart from '../components/ReachBarChart'
import InsightsCard from '../components/InsightsCard'
import { COLORS } from '../design-tokens'

function formatRelativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export default function Analytics() {
  const { appId = '' } = useParams<{ appId: string }>()
  const nav = useNavigate()
  const { activeApp } = useApp()
  const [data,  setData]  = useState<AnalyticsData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!appId) { nav('/apps'); return }
    api.getAnalytics(appId)
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [appId, nav])

  if (error) return <p className="text-red-600 p-8">{error}</p>
  if (!data)  return <p className="text-slate-400 p-8">Loading…</p>

  const aiEnabled = activeApp?.aiInsightsEnabled ?? false
  const aiMode    = (activeApp?.aiInsightsMode ?? 'nightly') as 'nightly' | 'on_demand'

  return (
    <div>
      <h1 className="text-slate-900 font-extrabold mb-1" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
        Analytics
      </h1>
      <p className="text-slate-500 mb-6" style={{ fontSize: 13 }}>
        Usage patterns, user distribution, and AI-powered insights.
      </p>

      <InsightsCard appId={appId} enabled={aiEnabled} mode={aiMode} />

      {/* Screen Health */}
      <div className="bg-white rounded-card border border-slate-200 mb-5">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Screen Health</p>
          <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>
            Feature health per screen — sorted worst to best
          </p>
        </div>
        <div className="p-5 overflow-x-auto">
          <StackedBarChart data={data.screenBreakdown} />
          <div className="flex items-center gap-4 mt-3">
            {([['#16A34A', 'Thriving'], ['#CA8A04', 'Declining / Dormant'], ['#DC2626', 'Dead']] as [string, string][]).map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="inline-block rounded-sm flex-shrink-0" style={{ width: 10, height: 10, background: color }} />
                <span className="text-slate-500" style={{ fontSize: 11 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Declining */}
      <div className="bg-white rounded-card border border-slate-200 mb-5">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Top Declining Features</p>
          <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>Ranked by week-over-week interaction rate drop</p>
        </div>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['Feature', 'Screen', 'State', 'WoW Drop', 'Last Interaction'].map(h => (
                <th key={h} className="text-left text-slate-400 font-bold uppercase"
                  style={{ padding: '8px 20px', fontSize: 10, letterSpacing: '0.07em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.topDeclining.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>
                  No declining features — looking good!
                </td>
              </tr>
            )}
            {data.topDeclining.map(f => (
              <tr key={f.id} onClick={() => nav(`/apps/${appId}/features/${f.id}`)}
                className="border-b border-slate-50 last:border-none hover:bg-slate-50 cursor-pointer transition-colors">
                <td style={{ padding: '11px 20px' }}>
                  <span className="font-mono text-slate-800" style={{ fontSize: 11.5 }}>
                    {f.resourceName ?? '(unnamed)'}
                  </span>
                </td>
                <td className="text-slate-500" style={{ padding: '11px 20px', fontSize: 12 }}>{f.screenName}</td>
                <td style={{ padding: '11px 20px' }}>
                  <StateBadge state={f.state as Feature['state']} />
                </td>
                <td style={{ padding: '11px 20px' }}>
                  <span className="font-bold text-red-600" style={{ fontSize: 12 }}>▼ {f.wowChangePct}%</span>
                </td>
                <td className="text-slate-400" style={{ padding: '11px 20px', fontSize: 11.5 }}>
                  {f.lastInteraction ? formatRelativeTime(f.lastInteraction) : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Metrics */}
      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="bg-white rounded-card border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Daily Active Users</p>
            <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>Unique users per day — last 30 days</p>
          </div>
          <div className="p-5">
            {data.dauTrend.length > 0 ? (
              <LineChart
                labels={data.dauTrend.map(r => new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}
                data={data.dauTrend.map(r => r.dailyActiveUsers)}
                color={COLORS.indigo}
                height={160}
              />
            ) : (
              <p className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>No data yet — run cron first</p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-card border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Feature Reach</p>
            <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>% of daily users who touched each feature</p>
          </div>
          <div className="p-5">
            <ReachBarChart data={data.featureReach} />
          </div>
        </div>
      </div>

      {/* Rate Distribution */}
      <div className="bg-white rounded-card border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Interaction Rate Distribution</p>
          <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>
            How many features fall into each engagement tier
          </p>
        </div>
        <div className="p-5">
          <Histogram data={data.rateHistogram} height={160} />
        </div>
      </div>
    </div>
  )
}
