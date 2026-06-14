import { useState } from 'react'

const APP_ID = localStorage.getItem('fp_appId') ?? ''
const BASE   = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export default function Alerts() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saved,      setSaved]      = useState(false)
  const [testing,    setTesting]    = useState(false)
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

  const TRIGGERS = [
    'Feature becomes DEAD',
    'Feature becomes DECLINING',
    'Feature resurrects from DEAD',
  ]

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 className="text-slate-900 font-extrabold mb-1.5" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
        Alerts
      </h1>
      <p className="text-slate-500 mb-7" style={{ fontSize: 13 }}>
        Get notified when a feature becomes DEAD or DECLINING.
      </p>

      {/* Webhook config */}
      <div className="bg-white rounded-card border border-slate-200 p-6 mb-5">
        <h2 className="text-slate-900 font-bold mb-4" style={{ fontSize: 14 }}>
          Webhook Configuration
        </h2>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5" style={{ fontSize: 13 }}>
              Slack / Generic Webhook URL
            </label>
            <input
              type="url"
              placeholder="https://hooks.slack.com/services/…"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors font-mono"
              style={{ padding: '10px 14px', fontSize: 13 }}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              style={{ padding: '9px 20px', fontSize: 13 }}
            >
              {saved ? '✓ Saved' : 'Save'}
            </button>
            <button
              type="button"
              onClick={testWebhook}
              disabled={!webhookUrl || testing}
              className="bg-slate-100 text-slate-700 font-semibold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
              style={{ padding: '9px 20px', fontSize: 13 }}
            >
              {testing ? 'Sending…' : 'Test webhook'}
            </button>
          </div>
          {testResult && (
            <p style={{ fontSize: 13, color: testResult.startsWith('✅') ? '#16A34A' : '#DC2626' }}>
              {testResult}
            </p>
          )}
        </form>
      </div>

      {/* Triggers */}
      <div className="bg-white rounded-card border border-slate-200 p-6">
        <h2 className="text-slate-900 font-bold mb-4" style={{ fontSize: 14 }}>Alert Triggers</h2>
        <div className="flex flex-col gap-3">
          {TRIGGERS.map((label) => (
            <label key={label} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                defaultChecked
                className="w-4 h-4 accent-indigo-600"
              />
              <span className="text-slate-700" style={{ fontSize: 13 }}>{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
