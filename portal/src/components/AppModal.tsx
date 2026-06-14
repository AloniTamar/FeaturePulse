import { useState, type FC } from 'react'
import { api, type AppSummary } from '../api/client'

interface Props {
  onClose: () => void
  onCreated: (app: AppSummary) => void
}

export const AppModal: FC<Props> = ({ onClose, onCreated }) => {
  const [name, setName]             = useState('')
  const [packageName, setPkg]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const app = await api.createApp(name, packageName)
      onCreated(app)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create app')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-slate-900 font-bold mb-4" style={{ fontSize: 16 }}>New App</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            placeholder="App name" value={name}
            onChange={(e) => setName(e.target.value)}
            required autoFocus
            className="border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            style={{ padding: '10px 14px', fontSize: 14 }}
          />
          <input
            placeholder="Package name (com.example.app)" value={packageName}
            onChange={(e) => setPkg(e.target.value)}
            required
            className="border border-slate-200 rounded-lg text-slate-900 font-mono outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            style={{ padding: '10px 14px', fontSize: 13 }}
          />
          {error && <p className="text-red-600" style={{ fontSize: 13 }}>{error}</p>}
          <div className="flex gap-2 justify-end mt-1">
            <button
              type="button" onClick={onClose}
              className="border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              {loading ? 'Creating…' : 'Create App'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
