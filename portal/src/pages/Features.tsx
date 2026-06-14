import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import FeatureTable from '../components/FeatureTable'
import { useTopbar } from '../components/TopbarContext'
import type { Feature, Pagination } from '../api/client'

const STATES = ['', 'THRIVING', 'DECLINING', 'DORMANT', 'DEAD'] as const

export default function Features() {
  const { appId = '' } = useParams<{ appId: string }>()
  const { setActions } = useTopbar()
  const [features, setFeatures]       = useState<Feature[]>([])
  const [pagination, setPagination]   = useState<Pagination>({ page: 1, limit: 20, total: 0 })
  const [stateFilter, setStateFilter] = useState('')
  const [loading, setLoading]         = useState(false)

  async function load(page = 1) {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' }
      if (stateFilter) params['state'] = stateFilter
      const res = await api.getFeatures(appId, params)
      setFeatures(res.data)
      setPagination(res.pagination)
    } catch {
      // show empty table
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [stateFilter, appId])

  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
    setActions(
      <button
        onClick={async () => {
          const token = localStorage.getItem('fp_token')
          const res = await fetch(`${BASE}/api/v1/apps/${appId}/export?format=csv`, {
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
    )
    return () => setActions(null)
  }, [setActions, appId])

  async function handleIgnore(id: string, ignore: boolean) {
    await api.ignoreFeature(id, ignore)
    load(pagination.page)
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-slate-900 font-extrabold flex-1" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
          Features
        </h1>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="border border-slate-200 rounded-lg text-slate-600 bg-white outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
          style={{ padding: '6px 12px', fontSize: 13 }}
        >
          <option value="">All states</option>
          {STATES.slice(1).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-card border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="text-center text-slate-400 py-10" style={{ fontSize: 13 }}>Loading…</p>
        ) : (
          <FeatureTable features={features} onIgnore={handleIgnore} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center mt-5">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => load(p)}
              className={`rounded-lg font-medium transition-colors ${
                p === pagination.page
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <p className="text-center text-slate-400 mt-3" style={{ fontSize: 13 }}>
        {pagination.total} total features
      </p>
    </div>
  )
}
