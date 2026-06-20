import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useApp } from '../context/AppContext'

function NumberInput({ label, description, value, onChange, min = 1, max = 365 }: {
  label: string; description: string; value: number
  onChange: (v: number) => void; min?: number; max?: number
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>{label}</p>
        <p className="text-slate-400 mt-0.5" style={{ fontSize: 12 }}>{description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          type="number" value={value} min={min} max={max}
          onChange={(e) => onChange(Math.max(min, Math.min(max, parseInt(e.target.value, 10) || min)))}
          className="border border-slate-200 rounded-lg text-slate-900 text-center outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
          style={{ width: 64, padding: '6px 8px', fontSize: 14 }}
        />
        <span className="text-slate-400" style={{ fontSize: 12 }}>days</span>
      </div>
    </div>
  )
}

function RenameDeleteCard({ app, onRenamed, onDeleted }: {
  app: { id: string; name: string }
  onRenamed: (name: string) => void
  onDeleted: () => void
}) {
  const nav = useNavigate()
  const [name,     setName]     = useState(app.name)
  const [saving,   setSaving]   = useState(false)
  const [saveOk,   setSaveOk]   = useState(false)
  const [confirm,  setConfirm]  = useState('')
  const [showFinal,setShowFinal]= useState(false)
  const [deleting, setDeleting] = useState(false)
  const [delError, setDelError] = useState('')
  const matches = confirm === app.name

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (name === app.name) return
    setSaving(true)
    try {
      await api.updateAppSettings(app.id, { name })
      onRenamed(name)
      setSaveOk(true)
      setTimeout(() => setSaveOk(false), 2000)
    } catch {}
    finally { setSaving(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    setDelError('')
    try {
      await api.deleteApp(app.id)
      onDeleted()
      localStorage.removeItem('fp_last_app_id')
      nav('/apps')
    } catch (err) {
      setDelError(err instanceof Error ? err.message : 'Failed to delete')
      setShowFinal(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-card border border-red-200 p-6">
        <h2 className="text-red-600 font-bold mb-5" style={{ fontSize: 14 }}>Danger Zone</h2>

        {/* Rename */}
        <form onSubmit={handleRename} className="flex gap-2 mb-6">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            style={{ padding: '8px 12px', fontSize: 14 }}
          />
          <button
            type="submit" disabled={saving || name === app.name}
            className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            style={{ padding: '8px 16px', fontSize: 13 }}
          >
            {saving ? 'Saving…' : saveOk ? '✓ Saved' : 'Rename App'}
          </button>
        </form>

        {/* Delete */}
        <p className="text-slate-500 mb-3" style={{ fontSize: 13 }}>
          Permanently delete this app, all its features, events, and data. This cannot be undone.
        </p>
        <p className="text-slate-700 font-semibold mb-2" style={{ fontSize: 13 }}>
          Type <span className="font-mono bg-slate-100 px-1 rounded">{app.name}</span> to confirm:
        </p>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={app.name}
          className="w-full border border-red-300 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 mb-3 transition-colors"
          style={{ padding: '10px 14px', fontSize: 14 }}
        />
        {delError && <p className="text-red-600 mb-2" style={{ fontSize: 13 }}>{delError}</p>}
        <button
          onClick={() => setShowFinal(true)}
          disabled={!matches}
          className="bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
          style={{ padding: '9px 20px', fontSize: 13 }}
        >
          Delete App
        </button>
      </div>

      {showFinal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-slate-900 font-bold mb-3" style={{ fontSize: 16 }}>Are you absolutely sure?</h2>
            <p className="text-slate-500 mb-5" style={{ fontSize: 13 }}>
              This is permanent. All features, events, and aggregates for <strong>{app.name}</strong> will be destroyed and cannot be recovered.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowFinal(false)}
                className="border border-slate-200 text-slate-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
                style={{ padding: '8px 16px', fontSize: 13 }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                className="bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                style={{ padding: '8px 16px', fontSize: 13 }}>
                {deleting ? 'Deleting…' : 'Yes, delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default function Settings() {
  const { activeApp, reloadApps } = useApp()

  const [deadDays,    setDeadDays]    = useState(activeApp?.deadThresholdDays    ?? 30)
  const [dormantDays, setDormantDays] = useState(activeApp?.dormantThresholdDays ?? 14)
  const [retention,   setRetention]   = useState(activeApp?.eventRetentionDays   ?? 7)

  const [thresholdSaved,   setThresholdSaved]   = useState(false)
  const [thresholdSaving,  setThresholdSaving]  = useState(false)
  const [retentionSaved,   setRetentionSaved]   = useState(false)
  const [retentionSaving,  setRetentionSaving]  = useState(false)

  const [aiEnabled,   setAiEnabled]   = useState(activeApp?.aiInsightsEnabled ?? false)
  const [aiMode,      setAiMode]      = useState<'nightly' | 'on_demand'>(
    (activeApp?.aiInsightsMode ?? 'nightly') as 'nightly' | 'on_demand'
  )
  const [aiSaved,     setAiSaved]     = useState(false)
  const [aiSaving,    setAiSaving]    = useState(false)
  const [customApiKey, setCustomApiKey] = useState('')
  const [apiKeySaved,  setApiKeySaved]  = useState(false)
  const [apiKeySaving, setApiKeySaving] = useState(false)

  if (!activeApp) return <p className="text-slate-400 p-8">Loading…</p>

  async function saveThresholds() {
    setThresholdSaving(true)
    try {
      await api.updateAppSettings(activeApp!.id, { deadThresholdDays: deadDays, dormantThresholdDays: dormantDays })
      await reloadApps()
      setThresholdSaved(true)
      setTimeout(() => setThresholdSaved(false), 2000)
    } catch {}
    finally { setThresholdSaving(false) }
  }

  async function saveRetention() {
    setRetentionSaving(true)
    try {
      await api.updateAppSettings(activeApp!.id, { eventRetentionDays: retention })
      await reloadApps()
      setRetentionSaved(true)
      setTimeout(() => setRetentionSaved(false), 2000)
    } catch {}
    finally { setRetentionSaving(false) }
  }

  async function saveAiSettings() {
    setAiSaving(true)
    try {
      await api.updateAppSettings(activeApp!.id, { aiInsightsEnabled: aiEnabled, aiInsightsMode: aiMode })
      await reloadApps()
      setAiSaved(true)
      setTimeout(() => setAiSaved(false), 2000)
    } catch {}
    finally { setAiSaving(false) }
  }

  async function saveApiKey() {
    setApiKeySaving(true)
    try {
      await api.updateAppSettings(activeApp!.id, { openRouterApiKey: customApiKey || null })
      await reloadApps()
      setCustomApiKey('')
      setApiKeySaved(true)
      setTimeout(() => setApiKeySaved(false), 2000)
    } catch {}
    finally { setApiKeySaving(false) }
  }

  async function clearApiKey() {
    setApiKeySaving(true)
    try {
      await api.updateAppSettings(activeApp!.id, { openRouterApiKey: null })
      await reloadApps()
      setApiKeySaved(true)
      setTimeout(() => setApiKeySaved(false), 2000)
    } catch {}
    finally { setApiKeySaving(false) }
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 className="text-slate-900 font-extrabold mb-1.5" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
        Settings
      </h1>
      <p className="text-slate-500 mb-7" style={{ fontSize: 13 }}>SDK integration and classification config for {activeApp.name}.</p>

      {/* SDK Integration */}
      <div className="bg-white rounded-card border border-slate-200 p-6 mb-5">
        <h2 className="text-slate-900 font-bold mb-4" style={{ fontSize: 14 }}>SDK Integration</h2>
        <pre
          className="bg-slate-50 border border-slate-200 rounded-lg text-slate-700 overflow-x-auto font-mono"
          style={{ padding: 16, fontSize: 12.5, lineHeight: 1.6 }}
        >
          {`// build.gradle.kts\nimplementation("com.github.featurepulse:sdk:1.0.0")\n\n// Application.kt\nFeaturePulse.init(this, PulseConfig.Builder()\n    .setApiKey("${activeApp.apiKey}")\n    .setAppId("${activeApp.id}")\n    .build())`}
        </pre>
      </div>

      {/* Classification Thresholds */}
      <div className="bg-white rounded-card border border-slate-200 p-6 mb-5">
        <h2 className="text-slate-900 font-bold mb-1" style={{ fontSize: 14 }}>Classification Thresholds</h2>
        <p className="text-slate-400 mb-5" style={{ fontSize: 12 }}>
          Controls when features change state. Changes take effect on the next cron run.
        </p>
        <div className="flex flex-col gap-4">
          <NumberInput
            label="Dead threshold"
            description="Mark a feature as Dead after this many days of zero interactions"
            value={deadDays} onChange={setDeadDays}
          />
          <NumberInput
            label="Dormant threshold"
            description="Mark a feature as Dormant after this many days below 1% interaction rate"
            value={dormantDays} onChange={setDormantDays}
          />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={saveThresholds} disabled={thresholdSaving}
            className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
            style={{ padding: '8px 18px', fontSize: 13 }}
          >
            {thresholdSaving ? 'Saving…' : 'Save'}
          </button>
          {thresholdSaved && <span className="text-green-600 font-medium" style={{ fontSize: 13 }}>✓ Saved</span>}
        </div>
      </div>

      {/* Data Retention */}
      <div className="bg-white rounded-card border border-slate-200 p-6 mb-5">
        <h2 className="text-slate-900 font-bold mb-1" style={{ fontSize: 14 }}>Data Retention</h2>
        <p className="text-slate-400 mb-5" style={{ fontSize: 12 }}>
          Raw interaction events older than this are deleted during the nightly cron run.
        </p>
        <NumberInput
          label="Raw event retention"
          description="Keep raw events for this many days (aggregates are kept indefinitely)"
          value={retention} onChange={setRetention}
        />
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={saveRetention} disabled={retentionSaving}
            className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
            style={{ padding: '8px 18px', fontSize: 13 }}
          >
            {retentionSaving ? 'Saving…' : 'Save'}
          </button>
          {retentionSaved && <span className="text-green-600 font-medium" style={{ fontSize: 13 }}>✓ Saved</span>}
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-white rounded-card border border-slate-200 p-6 mb-5">
        <h2 className="text-slate-900 font-bold mb-1" style={{ fontSize: 14 }}>AI Insights</h2>
        <p className="text-slate-400 mb-5" style={{ fontSize: 12 }}>
          When enabled, Claude analyses your app's feature data and generates a health summary with actionable recommendations.
        </p>
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Enable AI Insights</p>
          <button
            onClick={() => setAiEnabled(e => !e)}
            className={`relative inline-flex items-center rounded-full transition-colors flex-shrink-0 ${
              aiEnabled ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
            style={{ width: 40, height: 22 }}
          >
            <span
              className="inline-block bg-white rounded-full shadow transition-transform"
              style={{ width: 16, height: 16, margin: 3, transform: aiEnabled ? 'translateX(18px)' : 'translateX(0)' }}
            />
          </button>
        </div>
        {aiEnabled && (
          <div className="flex flex-col gap-2 mb-4 pl-1">
            <p className="text-slate-600 font-semibold mb-1" style={{ fontSize: 12.5 }}>Generate insights:</p>
            {(['nightly', 'on_demand'] as const).map(m => (
              <label key={m} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio" name="aiMode" value={m} checked={aiMode === m}
                  onChange={() => setAiMode(m)}
                  className="accent-indigo-600"
                />
                <span className="text-slate-700" style={{ fontSize: 13 }}>
                  {m === 'nightly' ? 'Nightly — pre-computed by cron, instant load' : 'On-demand — fresh each time you open Analytics'}
                </span>
              </label>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={saveAiSettings} disabled={aiSaving}
            className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
            style={{ padding: '8px 18px', fontSize: 13 }}
          >
            {aiSaving ? 'Saving…' : 'Save'}
          </button>
          {aiSaved && <span className="text-green-600 font-medium" style={{ fontSize: 13 }}>✓ Saved</span>}
        </div>
        {aiEnabled && (
          <div className="border-t border-slate-100 pt-5">
            <p className="text-slate-800 font-semibold mb-0.5" style={{ fontSize: 13 }}>
              OpenRouter API Key
              <span className="ml-1 text-slate-400 font-normal" style={{ fontSize: 12 }}>(optional — improves AI insights quality)</span>
            </p>
            <p className="text-slate-400 mb-3" style={{ fontSize: 12 }}>
              Get a free key at openrouter.ai. Using your own key enables premium models.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder={activeApp.hasCustomApiKey ? '••••••••••••••••' : 'sk-or-... (uses shared free tier if empty)'}
                value={customApiKey}
                onChange={e => setCustomApiKey(e.target.value)}
                className="flex-1 border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
                style={{ padding: '8px 12px', fontSize: 13 }}
              />
              <button
                onClick={saveApiKey} disabled={apiKeySaving || !customApiKey}
                className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                style={{ padding: '8px 14px', fontSize: 13 }}
              >
                {apiKeySaving ? 'Saving…' : 'Save Key'}
              </button>
              {activeApp.hasCustomApiKey && (
                <button
                  onClick={clearApiKey} disabled={apiKeySaving}
                  className="border border-red-200 text-red-500 font-semibold rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                  style={{ padding: '8px 14px', fontSize: 13 }}
                >
                  Clear
                </button>
              )}
            </div>
            {apiKeySaved && <p className="text-green-600 font-medium mt-2" style={{ fontSize: 13 }}>✓ Saved</p>}
          </div>
        )}
      </div>

      {/* Monthly Event Usage */}
      {activeApp.monthlyEventQuota > 0 && (
        <div className="bg-white rounded-card border border-slate-200 p-6 mb-5">
          <h2 className="text-slate-900 font-bold mb-1" style={{ fontSize: 14 }}>Monthly Event Usage</h2>
          <div className="mt-2 w-full bg-gray-200 rounded-full" style={{ height: 8 }}>
            <div
              className={`rounded-full transition-all ${
                activeApp.currentMonthEvents / activeApp.monthlyEventQuota > 0.9 ? 'bg-red-500' : 'bg-indigo-500'
              }`}
              style={{
                height: 8,
                width: `${Math.min(100, (activeApp.currentMonthEvents / activeApp.monthlyEventQuota) * 100)}%`
              }}
            />
          </div>
          <p className="mt-1 text-slate-500" style={{ fontSize: 12 }}>
            {activeApp.currentMonthEvents.toLocaleString()} / {activeApp.monthlyEventQuota.toLocaleString()} events this month
          </p>
        </div>
      )}

      {/* Danger Zone */}
      <RenameDeleteCard
        app={activeApp}
        onRenamed={async () => { await reloadApps() }}
        onDeleted={() => {}}
      />
    </div>
  )
}
