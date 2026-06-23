import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../api/client'

export default function Login() {
  const nav = useNavigate()
  const [tab,      setTab]    = useState<'login' | 'register'>(
    new URLSearchParams(window.location.search).get('register') === '1' ? 'register' : 'login'
  )
  const [email,    setEmail]  = useState('')
  const [password, setPass]   = useState('')
  const [error,    setError]  = useState('')
  const [loading,  setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        const { token, apps } = await api.login(email, password)
        setToken(token)
        localStorage.setItem('fp_email', email)
        if (apps.length > 0) {
          nav(`/apps/${apps[0].id}/dashboard`)
        } else {
          nav('/apps')
        }
      } else {
        const { token } = await api.register(email, password)
        setToken(token)
        localStorage.setItem('fp_email', email)
        nav('/apps')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
      <div style={{ width: 400 }}>
        <a href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 no-underline mb-4 transition-colors" style={{ fontSize: 13 }}>
          <span>←</span> Back to home
        </a>
      <div
        className="bg-white border border-slate-200 shadow-md"
        style={{ width: 400, padding: 32, borderRadius: 14 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="flex items-center justify-center overflow-hidden flex-shrink-0"
            style={{ width: 32, height: 32, borderRadius: 9 }}
          >
            <img src="/icon.png" alt="FeaturePulse" style={{ width: 32, height: 32, objectFit: 'cover' }} />
          </div>
          <span className="text-slate-900 font-extrabold" style={{ fontSize: 15, letterSpacing: '-0.3px' }}>
            FeaturePulse
          </span>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5 mb-6">
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded font-semibold transition-colors ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              style={{ fontSize: 13 }}
            >
              {t === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            style={{ padding: '10px 14px', fontSize: 14 }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPass(e.target.value)} required
            className="border border-slate-200 rounded-lg text-slate-900 outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 transition-colors"
            style={{ padding: '10px 14px', fontSize: 14 }}
          />
          {error && <p className="text-red-600" style={{ fontSize: 13 }}>{error}</p>}
          <button
            type="submit" disabled={loading}
            className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
            style={{ padding: '10px 0', fontSize: 14 }}
          >
            {loading ? 'Loading…' : tab === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
      </div>
    </div>
  )
}
