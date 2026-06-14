import { useState } from 'react'

export default function Settings() {
  const [appId,  setAppId]  = useState(localStorage.getItem('fp_appId')  ?? '')
  const [apiKey, setApiKey] = useState(localStorage.getItem('fp_apiKey') ?? '')
  const [saved,  setSaved]  = useState(false)

  function save(e: React.FormEvent) {
    e.preventDefault()
    localStorage.setItem('fp_appId',  appId)
    localStorage.setItem('fp_apiKey', apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const fields = [
    { label: 'App ID',  value: appId,  set: setAppId,  ph: 'uuid' },
    { label: 'API Key', value: apiKey, set: setApiKey, ph: 'fp_…' },
  ]

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 className="text-slate-900 font-extrabold mb-1.5" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
        Settings
      </h1>
      <p className="text-slate-500 mb-7" style={{ fontSize: 13 }}>App ID and API key for this session.</p>

      {/* Credentials form */}
      <div className="bg-white rounded-card border border-slate-200 p-6 mb-5">
        <h2 className="text-slate-900 font-bold mb-4" style={{ fontSize: 14 }}>Credentials</h2>
        <form onSubmit={save} className="flex flex-col gap-4">
          {fields.map(({ label, value, set, ph }) => (
            <div key={label}>
              <label className="block text-slate-700 font-semibold mb-1.5" style={{ fontSize: 13 }}>
                {label}
              </label>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                placeholder={ph}
                className="w-full border border-slate-200 rounded-lg text-slate-900 font-mono outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
                style={{ padding: '10px 14px', fontSize: 13 }}
              />
            </div>
          ))}
          <div>
            <button
              type="submit"
              className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              style={{ padding: '9px 20px', fontSize: 13 }}
            >
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      {/* SDK snippet */}
      <div className="bg-white rounded-card border border-slate-200 p-6">
        <h2 className="text-slate-900 font-bold mb-4" style={{ fontSize: 14 }}>SDK Integration</h2>
        <pre
          className="bg-slate-50 border border-slate-200 rounded-lg text-slate-700 overflow-x-auto font-mono"
          style={{ padding: 16, fontSize: 12.5, lineHeight: 1.6 }}
        >
{`// build.gradle.kts
implementation("com.github.featurepulse:sdk:1.0.0")

// Application.kt
FeaturePulse.init(this, PulseConfig.Builder()
    .setApiKey("${apiKey || 'YOUR_API_KEY'}")
    .setAppId("${appId || 'YOUR_APP_ID'}")
    .build())`}
        </pre>
      </div>
    </div>
  )
}
