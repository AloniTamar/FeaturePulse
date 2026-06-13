// portal/src/pages/Settings.tsx
import { useState } from 'react'
import NavBar from '../components/NavBar'

export default function Settings() {
  const [appId, setAppIdState]   = useState(localStorage.getItem('fp_appId') ?? '')
  const [apiKey, setApiKeyState] = useState(localStorage.getItem('fp_apiKey') ?? '')
  const [saved, setSaved]        = useState(false)

  function save(e: React.FormEvent) {
    e.preventDefault()
    localStorage.setItem('fp_appId',  appId)
    localStorage.setItem('fp_apiKey', apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <>
      <NavBar />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#0F172A' }}>Settings</h1>
        <p style={{ color: '#64748B', marginBottom: 28 }}>App ID and API key for this session.</p>

        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'App ID',  value: appId,  set: setAppIdState,  ph: 'uuid' },
            { label: 'API Key', value: apiKey, set: setApiKeyState, ph: 'fp_…' },
          ].map(({ label, value, set, ph }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{label}</label>
              <input value={value} onChange={e => set(e.target.value)} placeholder={ph}
                style={{ padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14,
                  fontFamily: 'monospace' }} />
            </div>
          ))}

          <button type="submit"
            style={{ alignSelf: 'flex-start', padding: '10px 20px', background: '#4F46E5',
              color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </form>

        <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid #E2E8F0' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>SDK Integration</h2>
        <pre style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
          padding: 16, fontSize: 13, overflowX: 'auto', color: '#334155' }}>
{`// build.gradle.kts
implementation("com.github.featurepulse:sdk:1.0.0")

// Application.kt
FeaturePulse.init(this, PulseConfig.Builder()
    .setApiKey("${apiKey || 'YOUR_API_KEY'}")
    .setAppId("${appId || 'YOUR_APP_ID'}")
    .build())`}
        </pre>
      </div>
    </>
  )
}
