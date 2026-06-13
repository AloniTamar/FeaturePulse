// portal/src/pages/Features.tsx
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import NavBar from '../components/NavBar'
import FeatureTable from '../components/FeatureTable'
import type { Feature, Pagination } from '../api/client'

const APP_ID = localStorage.getItem('fp_appId') ?? ''
const STATES = ['', 'THRIVING', 'DECLINING', 'DORMANT', 'DEAD'] as const

export default function Features() {
  const [features, setFeatures]   = useState<Feature[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0 })
  const [stateFilter, setStateFilter] = useState('')
  const [loading, setLoading]     = useState(false)

  async function load(page = 1) {
    setLoading(true)
    const params: Record<string, string> = { page: String(page), limit: '20' }
    if (stateFilter) params.state = stateFilter
    const res = await api.getFeatures(APP_ID, params)
    setFeatures(res.data)
    setPagination(res.pagination)
    setLoading(false)
  }

  useEffect(() => { load(1) }, [stateFilter])

  async function handleIgnore(id: string, ignore: boolean) {
    await api.ignoreFeature(id, ignore)
    load(pagination.page)
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <>
      <NavBar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', flex: 1 }}>Features</h1>
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14 }}>
            <option value="">All states</option>
            {STATES.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <a href={api.exportFeatures(APP_ID, 'csv')} download
            style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', borderRadius: 8,
              textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            Export CSV
          </a>
        </div>

        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          {loading
            ? <p style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Loading…</p>
            : <FeatureTable features={features} onIgnore={handleIgnore} />}
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => load(p)}
                style={{ padding: '6px 12px', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer',
                  background: p === pagination.page ? '#4F46E5' : '#fff',
                  color: p === pagination.page ? '#fff' : '#475569' }}>
                {p}
              </button>
            ))}
          </div>
        )}
        <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 12 }}>
          {pagination.total} total features
        </p>
      </div>
    </>
  )
}
