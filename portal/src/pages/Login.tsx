// portal/src/pages/Login.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../api/client'

export default function Login() {
  const nav = useNavigate()
  const [tab, setTab]         = useState<'login' | 'register'>('login')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [appName, setAppName] = useState('')
  const [pkgName, setPkg]     = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        const { token } = await api.login(email, password)
        setToken(token)
        nav('/dashboard')
      } else {
        const { token, appId, apiKey } = await api.register(email, password, appName, pkgName)
        setToken(token)
        localStorage.setItem('fp_appId', appId)
        localStorage.setItem('fp_apiKey', apiKey)
        nav('/dashboard')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: '32px', border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>FeaturePulse</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['login', 'register'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: tab === t ? '#4F46E5' : '#F1F5F9', color: tab === t ? '#fff' : '#334155' }}>
            {t === 'login' ? 'Sign in' : 'Register'}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          required style={inputStyle} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPass(e.target.value)}
          required style={inputStyle} />
        {tab === 'register' && <>
          <input placeholder="App name" value={appName} onChange={e => setAppName(e.target.value)}
            required style={inputStyle} />
          <input placeholder="Package name (com.example.app)" value={pkgName} onChange={e => setPkg(e.target.value)}
            required style={inputStyle} />
        </>}
        {error && <p style={{ color: '#DC2626', fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={loading}
          style={{ padding: 12, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
          {loading ? 'Loading…' : tab === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 15,
}
