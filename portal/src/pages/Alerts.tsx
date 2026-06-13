// portal/src/pages/Alerts.tsx
import { useState } from 'react'
import NavBar from '../components/NavBar'

const APP_ID = localStorage.getItem('fp_appId') ?? ''
const BASE   = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export default function Alerts() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saved, setSaved]           = useState(false)
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const token = localStorage.getItem('fp_token')
    await fetch(`${BASE}/api/v1/apps/${APP_ID}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ webhookUrl }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function testWebhook() {
    setTesting(true)
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '✅ FeaturePulse test webhook — connection confirmed' }),
      })
      setTestResult(res.ok ? '✅ Webhook delivered successfully' : `❌ Server returned ${res.status}`)
    } catch {
      setTestResult('❌ Could not reach webhook URL')
    }
    setTesting(false)
  }

  return (
    <>
      <NavBar />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#0F172A' }}>Alerts</h1>
        <p style={{ color: '#64748B', marginBottom: 28 }}>
          Get notified when a feature becomes DEAD or DECLINING.
        </p>

        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
            Slack / Generic Webhook URL
          </label>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/…"
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 15 }}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit"
              style={{ padding: '10px 20px', background: '#4F46E5', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
              {saved ? '✓ Saved' : 'Save'}
            </button>
            <button type="button" onClick={testWebhook} disabled={!webhookUrl || testing}
              style={{ padding: '10px 20px', background: '#F1F5F9', color: '#334155',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              {testing ? 'Sending…' : 'Test webhook'}
            </button>
          </div>
          {testResult && <p style={{ fontSize: 14, color: testResult.startsWith('✅') ? '#16A34A' : '#DC2626' }}>{testResult}</p>}
        </form>

        <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid #E2E8F0' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#0F172A' }}>Alert Triggers</h2>
        {['Feature becomes DEAD', 'Feature becomes DECLINING', 'Feature resurrects from DEAD'].map(label => (
          <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 14, color: '#334155' }}>{label}</span>
          </label>
        ))}
      </div>
    </>
  )
}
