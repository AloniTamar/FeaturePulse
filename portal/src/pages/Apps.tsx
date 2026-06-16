import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type AppSummary } from '../api/client'
import { useApp } from '../context/AppContext'
import { AppModal } from '../components/AppModal'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="text-slate-400 hover:text-indigo-600 transition-colors"
      style={{ fontSize: 11, padding: '2px 6px' }}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function DeleteModal({ app, onClose, onDeleted }: { app: AppSummary; onClose: () => void; onDeleted: () => void }) {
  const [confirm,   setConfirm]   = useState('')
  const [showFinal, setShowFinal] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const matches = confirm === app.name

  async function handleDelete() {
    setLoading(true)
    try {
      await api.deleteApp(app.id)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
      setShowFinal(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <h2 className="text-slate-900 font-bold mb-2" style={{ fontSize: 16 }}>
            Delete "{app.name}"?
          </h2>
          <p className="text-slate-500 mb-4" style={{ fontSize: 13 }}>
            This permanently deletes the app and all its features, events, and data. This cannot be undone.
          </p>
          <p className="text-slate-700 font-semibold mb-2" style={{ fontSize: 13 }}>
            Type <span className="font-mono bg-slate-100 px-1 rounded">{app.name}</span> to confirm:
          </p>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={app.name}
            autoFocus
            className="w-full border border-red-300 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-4 transition-colors"
            style={{ padding: '10px 14px', fontSize: 14 }}
          />
          {error && <p className="text-red-600 mb-3" style={{ fontSize: 13 }}>{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button" onClick={onClose}
              className="border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              Cancel
            </button>
            <button
              onClick={() => setShowFinal(true)}
              disabled={!matches}
              className="bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              Delete App
            </button>
          </div>
        </div>
      </div>

      {showFinal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-slate-900 font-bold mb-3" style={{ fontSize: 16 }}>
              Are you absolutely sure?
            </h2>
            <p className="text-slate-500 mb-5" style={{ fontSize: 13 }}>
              This is permanent. All features, events, and aggregates for <strong>{app.name}</strong> will be destroyed and cannot be recovered.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowFinal(false)}
                className="border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                style={{ padding: '8px 16px', fontSize: 13 }}
              >
                {loading ? 'Deleting…' : 'Yes, delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function AppCard({ app, onRenamed, onDeleted, onOpen }: {
  app: AppSummary
  onRenamed: (updated: AppSummary) => void
  onDeleted: () => void
  onOpen: () => void
}) {
  const [editing, setEditing]   = useState(false)
  const [name, setName]         = useState(app.name)
  const [saving, setSaving]     = useState(false)
  const [showDelete, setDelete] = useState(false)
  const [masked, setMasked]     = useState(true)
  const maskedKey = app.apiKey.slice(0, 6) + '••••••••••••' + app.apiKey.slice(-4)

  async function saveRename() {
    if (name === app.name) { setEditing(false); return }
    setSaving(true)
    try {
      const updated = await api.renameApp(app.id, name)
      onRenamed(updated)
    } catch {
      setName(app.name)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  function stopProp(e: React.MouseEvent) { e.stopPropagation() }

  return (
    <>
      <div
        onClick={onOpen}
        className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
      >
        {/* Header */}
        <div className="flex items-start gap-3" onClick={stopProp}>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveRename}
                onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setName(app.name); setEditing(false) } }}
                autoFocus
                disabled={saving}
                className="border border-indigo-400 rounded-lg text-slate-900 font-bold outline-none focus:ring-2 focus:ring-indigo-600 w-full"
                style={{ padding: '4px 8px', fontSize: 15 }}
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-slate-900 font-bold truncate" style={{ fontSize: 15 }}>{app.name}</span>
                <button
                  onClick={(e) => { stopProp(e); setEditing(true) }}
                  className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0"
                  title="Rename"
                >
                  <svg width="13" height="13" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M10.5 1.5l3 3-9 9H1.5v-3l9-9z" />
                  </svg>
                </button>
              </div>
            )}
            <div className="font-mono text-slate-400 mt-0.5 truncate" style={{ fontSize: 11.5 }}>{app.packageName}</div>
          </div>
        </div>

        {/* API Key */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2" onClick={stopProp}>
          <span className="font-mono text-slate-600 flex-1 truncate" style={{ fontSize: 11.5 }}>
            {masked ? maskedKey : app.apiKey}
          </span>
          <button onClick={(e) => { stopProp(e); setMasked(m => !m) }} className="text-slate-400 hover:text-slate-600 transition-colors" style={{ fontSize: 11 }}>
            {masked ? 'Show' : 'Hide'}
          </button>
          <div onClick={stopProp}><CopyButton text={app.apiKey} /></div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between" onClick={stopProp}>
          <span className="text-slate-400" style={{ fontSize: 11.5 }}>
            {app.featureCount} features · Created {new Date(app.createdAt).toLocaleDateString()}
          </span>
          <button
            onClick={(e) => { stopProp(e); setDelete(true) }}
            className="text-red-400 hover:text-red-600 font-semibold transition-colors"
            style={{ fontSize: 12 }}
          >
            Delete
          </button>
        </div>
      </div>

      {showDelete && (
        <DeleteModal
          app={app}
          onClose={() => setDelete(false)}
          onDeleted={() => { setDelete(false); onDeleted() }}
        />
      )}
    </>
  )
}

export default function Apps() {
  const nav = useNavigate()
  const { apps, reloadApps } = useApp()
  const [showModal, setShowModal] = useState(false)
  const [localApps, setLocalApps] = useState<AppSummary[] | null>(null)

  const displayApps = localApps ?? apps

  function handleCreated(app: AppSummary) {
    setShowModal(false)
    reloadApps()
    nav(`/apps/${app.id}/dashboard`)
  }

  function handleRenamed(updated: AppSummary) {
    setLocalApps(prev => (prev ?? apps).map(a => a.id === updated.id ? updated : a))
    reloadApps()
  }

  function handleDeleted(appId: string) {
    setLocalApps(prev => (prev ?? apps).filter(a => a.id !== appId))
    reloadApps()
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-slate-900 font-extrabold mb-1" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
            Apps
          </h1>
          <p className="text-slate-500" style={{ fontSize: 13 }}>Manage all your apps in one place.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          style={{ padding: '8px 18px', fontSize: 13 }}
        >
          + New App
        </button>
      </div>

      {displayApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 py-16">
          <div className="bg-indigo-50 rounded-2xl flex items-center justify-center mb-4" style={{ width: 56, height: 56 }}>
            <svg width="24" height="24" viewBox="0 0 15 15" fill="none" stroke="#4F46E5" strokeWidth="1.4">
              <rect x="1" y="1" width="5.5" height="5.5" rx="1" />
              <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" />
              <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" />
              <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" />
            </svg>
          </div>
          <p className="text-slate-900 font-bold mb-1" style={{ fontSize: 15 }}>No apps yet</p>
          <p className="text-slate-500 mb-5" style={{ fontSize: 13 }}>Create your first app to start tracking features.</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            style={{ padding: '9px 22px', fontSize: 13 }}
          >
            Create your first app
          </button>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
          {displayApps.map(app => (
            <AppCard
              key={app.id}
              app={app}
              onRenamed={handleRenamed}
              onDeleted={() => handleDeleted(app.id)}
              onOpen={() => nav(`/apps/${app.id}/dashboard`)}
            />
          ))}
        </div>
      )}

      {showModal && <AppModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
    </div>
  )
}
