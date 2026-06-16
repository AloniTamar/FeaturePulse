import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import FilterPills from '../components/FilterPills'
import StateBadge from '../components/StateBadge'
import { useTopbar } from '../components/TopbarContext'
import { useCron } from '../hooks/useCron'
import type { TransitionRecord, Pagination, Feature } from '../api/client'

function formatRelativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export default function Transitions() {
  const { appId = '' } = useParams<{ appId: string }>()
  const [transitions, setTransitions] = useState<TransitionRecord[]>([])
  const [pagination, setPagination]   = useState<Pagination>({ page: 1, limit: 20, total: 0 })
  const [toState, setToState]         = useState('')
  const [sort, setSort]               = useState('desc')
  const [loading, setLoading]         = useState(false)

  const { setActions }             = useTopbar()
  const { cronState, runCron }     = useCron(appId)

  async function exportCSV() {
    const params: Record<string, string> = { page: '1', limit: '9999', sort }
    if (toState) params['toState'] = toState
    const res = await api.getTransitions(appId, params)
    const rows = [
      ['feature', 'screen', 'from_state', 'to_state', 'changed_at', 'reason'],
      ...res.data.map(t => [
        t.feature.resourceName ?? '(unnamed)',
        t.feature.screenName,
        t.oldState ?? 'new',
        t.newState,
        t.changedAt,
        t.reason ?? '',
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `transitions${toState ? `-${toState.toLowerCase()}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
          onClick={exportCSV}
          className="bg-indigo-600 text-white hover:bg-indigo-700 font-semibold rounded-lg transition-colors"
          style={{ padding: '6px 13px', fontSize: 12.5 }}
        >
          Export CSV
        </button>
      </div>
    )
    return () => setActions(null)
  }, [setActions, appId, cronState, runCron, toState, sort])

  useEffect(() => { if (cronState === 'ok') load(1) }, [cronState])

  async function load(page = 1) {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '20', sort }
      if (toState) params['toState'] = toState
      const res = await api.getTransitions(appId, params)
      setTransitions(res.data)
      setPagination(res.pagination)
    } catch {
      // show empty table
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [toState, sort, appId])

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-slate-900 font-extrabold mb-4" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
          Transitions
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <FilterPills value={toState} onChange={setToState} />
          <div className="ml-auto flex-shrink-0">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="border border-slate-200 rounded-lg text-slate-600 bg-white outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
              style={{ padding: '6px 12px', fontSize: 13 }}
            >
              <option value="desc">Date — newest first</option>
              <option value="asc">Date — oldest first</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-card border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="text-center text-slate-400 py-10" style={{ fontSize: 13 }}>Loading…</p>
        ) : transitions.length === 0 ? (
          <p className="text-center text-slate-400 py-10" style={{ fontSize: 13 }}>
            No transitions yet — run the cron to classify features.
          </p>
        ) : (
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
              {transitions.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 last:border-none hover:bg-slate-50 transition-colors">
                  <td style={{ padding: '11px 20px' }}>
                    <div className="font-mono text-slate-800" style={{ fontSize: 11.5 }}>
                      {t.feature.resourceName ?? '(unnamed)'}
                    </div>
                    <div className="text-slate-400 mt-0.5" style={{ fontSize: 11 }}>{t.feature.screenName}</div>
                  </td>
                  <td style={{ padding: '11px 20px' }}>
                    <div className="flex items-center gap-1.5">
                      {t.oldState
                        ? <StateBadge state={t.oldState as Feature['state']} />
                        : <span className="text-slate-300 text-xs">new</span>
                      }
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
        )}
      </div>

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
        {pagination.total} total transitions
      </p>
    </div>
  )
}
