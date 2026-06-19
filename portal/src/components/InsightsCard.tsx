import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AppInsight } from '../api/client'

interface InsightsCardProps {
  appId: string
  enabled: boolean
  mode: 'nightly' | 'on_demand'
}

export default function InsightsCard({ appId, enabled, mode }: InsightsCardProps) {
  const [data,    setData]    = useState<AppInsight | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try { setData(await api.getInsights(appId)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (enabled) load() }, [appId, enabled])

  if (!enabled) return null

  return (
    <div className="bg-white rounded-card border border-indigo-200 p-6 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>AI Insights</p>
          <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>Powered by Claude</p>
        </div>
        {mode === 'on_demand' && (
          <button onClick={load} disabled={loading}
            className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold rounded-lg transition-colors disabled:opacity-50"
            style={{ padding: '5px 12px', fontSize: 12 }}>
            {loading ? 'Generating…' : '↺ Refresh'}
          </button>
        )}
      </div>
      {loading && !data && <p className="text-slate-400" style={{ fontSize: 13 }}>Generating insights…</p>}
      {error   && <p className="text-red-500"   style={{ fontSize: 13 }}>{error}</p>}
      {data && (
        <>
          <p className="text-slate-700 mb-3" style={{ fontSize: 13, lineHeight: 1.65 }}>{data.summary}</p>
          <ul className="flex flex-col gap-1.5">
            {data.bullets.map((b: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-indigo-500 flex-shrink-0" style={{ fontSize: 13 }}>•</span>
                <span className="text-slate-600" style={{ fontSize: 13 }}>{b}</span>
              </li>
            ))}
          </ul>
          {mode === 'nightly' && (
            <p className="text-slate-300 mt-3" style={{ fontSize: 11 }}>
              Last updated: {new Date(data.generatedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  )
}
