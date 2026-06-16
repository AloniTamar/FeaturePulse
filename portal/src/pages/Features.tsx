import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api/client'
import FeatureTable from '../components/FeatureTable'
import FilterPills from '../components/FilterPills'
import { useTopbar } from '../components/TopbarContext'
import { useApp } from '../context/AppContext'
import { useCron } from '../hooks/useCron'
import type { Feature, Pagination } from '../api/client'

const SORT_OPTIONS = [
  { value: 'lastInteraction_desc', label: 'Last interaction — newest' },
  { value: 'lastInteraction_asc',  label: 'Last interaction — oldest' },
  { value: 'name_asc',             label: 'Name (A → Z)' },
]

export default function Features() {
  const { appId = '' }   = useParams<{ appId: string }>()
  const { activeApp }    = useApp()
  const { setActions }   = useTopbar()
  const { cronState, runCron } = useCron(appId)
  const [searchParams, setSearchParams] = useSearchParams()

  const [features, setFeatures]     = useState<Feature[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0 })
  const [stateFilter, setStateFilter] = useState(() => searchParams.get('state') ?? '')
  const [sort, setSort]             = useState('lastInteraction_desc')
  const [loading, setLoading]       = useState(false)

  async function load(page = 1) {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '20', sort }
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

  useEffect(() => { load(1) }, [stateFilter, sort, appId])

  useEffect(() => {
    if (cronState === 'ok') load(1)
  }, [cronState])

  function handleFilterChange(v: string) {
    setStateFilter(v)
    setSearchParams(v ? { state: v } : {}, { replace: true })
  }

  const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

  useEffect(() => {
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
            const res = await fetch(`${BASE}/api/v1/apps/${appId}/export?format=csv`, {
              headers: { Authorization: `Bearer ${token ?? ''}` },
            })
            if (!res.ok) return
            const blob = await res.blob()
            const url  = URL.createObjectURL(blob)
            const a    = document.createElement('a')
            a.href = url
            a.download = `${activeApp?.name ?? appId}-features.csv`
            a.click()
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
  }, [setActions, appId, activeApp, cronState, runCron])

  async function handleIgnore(id: string, ignore: boolean) {
    await api.ignoreFeature(id, ignore)
    load(pagination.page)
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-slate-900 font-extrabold mb-4" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
          Features
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <FilterPills value={stateFilter} onChange={handleFilterChange} />
          <div className="ml-auto flex-shrink-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="border border-slate-200 rounded-lg text-slate-600 bg-white outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
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
