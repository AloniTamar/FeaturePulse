import { isLoggedIn, clearToken } from '../api/client'

export default function PrivacyPolicy() {
  const loggedIn = isLoggedIn()

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Top nav ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200" style={{ height: 56 }}>
        <div className="flex items-center justify-between h-full" style={{ padding: '0 32px' }}>
          <div className="flex items-center gap-2.5">
            <a href="/" className="flex items-center gap-2.5 no-underline">
              <div className="flex-shrink-0 overflow-hidden" style={{ width: 30, height: 30, borderRadius: 8 }}>
                <img src="/icon.png" alt="FeaturePulse" style={{ width: 30, height: 30, objectFit: 'cover' }} />
              </div>
              <span className="text-slate-900 font-extrabold" style={{ fontSize: 15, letterSpacing: '-0.3px' }}>
                FeaturePulse
              </span>
            </a>
          </div>
          <div className="flex items-center gap-3">
            {loggedIn ? (
              <>
                <a
                  href="/apps"
                  className="inline-flex items-center bg-indigo-600 text-white font-semibold rounded-lg px-4 py-1.5 hover:bg-indigo-700 transition-colors no-underline"
                  style={{ fontSize: 13 }}
                >
                  Go to Dashboard
                </a>
                <button
                  onClick={() => { clearToken(); window.location.href = '/' }}
                  className="text-slate-500 font-medium hover:text-slate-800 transition-colors"
                  style={{ fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="text-slate-600 font-medium hover:text-slate-900 transition-colors no-underline" style={{ fontSize: 13 }}>
                  Sign In
                </a>
                <a
                  href="/login?register=1"
                  className="inline-flex items-center bg-indigo-600 text-white font-semibold rounded-lg px-4 py-1.5 hover:bg-indigo-700 transition-colors no-underline"
                  style={{ fontSize: 13 }}
                >
                  Register
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 100px' }}>
        <a href="/" className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 no-underline mb-6 transition-colors" style={{ fontSize: 13 }}>
          <span>←</span> Back to home
        </a>

        <h1 className="text-slate-900 font-extrabold mb-1" style={{ fontSize: 28, letterSpacing: '-0.5px' }}>Privacy Policy</h1>
        <p className="text-slate-400 mb-10" style={{ fontSize: 13 }}>Last updated: 2026-06-19</p>

        <section className="mb-10">
          <h2 className="text-slate-900 font-bold mb-3" style={{ fontSize: 17 }}>What data we collect</h2>
          <p className="text-slate-600 mb-4" style={{ fontSize: 14, lineHeight: 1.7 }}>
            The FeaturePulse SDK collects the following data from end-users of apps that integrate it:
          </p>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Data', 'Description'].map(h => (
                    <th key={h} className="text-left text-slate-400 font-bold uppercase" style={{ padding: '8px 16px', fontSize: 10, letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { d: 'UI interaction events', v: 'Element type, screen name, event type (tap/impression), timestamp' },
                  { d: 'Session ID', v: 'Random UUID generated per app session — not linked to any user account' },
                  { d: 'Device ID', v: 'Random UUID generated on first SDK init — not a hardware identifier' },
                ].map(({ d, v }) => (
                  <tr key={d} className="border-b border-slate-50 last:border-none">
                    <td className="text-slate-700 font-medium" style={{ padding: '10px 16px', fontSize: 13 }}>{d}</td>
                    <td className="text-slate-500" style={{ padding: '10px 16px', fontSize: 13 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-600" style={{ fontSize: 14, lineHeight: 1.7 }}>
            The FeaturePulse web portal collects: email address and password hash (bcrypt) for account authentication.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-slate-900 font-bold mb-3" style={{ fontSize: 17 }}>What we do NOT collect</h2>
          <ul className="flex flex-col gap-2" style={{ paddingLeft: 0, listStyle: 'none' }}>
            {[
              'Real names, phone numbers, or government IDs',
              'Hardware device identifiers (IMEI, MAC address, advertising ID)',
              'Location data',
              'Photos, contacts, or files',
              "Any data about end-users' identities",
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-slate-600" style={{ fontSize: 14 }}>
                <span className="text-slate-300 mt-0.5">—</span> {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-slate-900 font-bold mb-3" style={{ fontSize: 17 }}>How data is used</h2>
          <p className="text-slate-600" style={{ fontSize: 14, lineHeight: 1.7 }}>
            Raw interaction events are used solely to compute aggregated UI health metrics (interaction rate, feature state). Raw events are automatically deleted after the configured retention period (default: 7 days). Aggregated statistics are retained until the app developer deletes their account.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-slate-900 font-bold mb-3" style={{ fontSize: 17 }}>Who we share data with</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Provider', 'Purpose', 'DPA'].map(h => (
                    <th key={h} className="text-left text-slate-400 font-bold uppercase" style={{ padding: '8px 16px', fontSize: 10, letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50">
                  <td className="text-slate-700 font-medium" style={{ padding: '10px 16px', fontSize: 13 }}>Railway</td>
                  <td className="text-slate-500" style={{ padding: '10px 16px', fontSize: 13 }}>Server hosting + PostgreSQL database</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>
                    <a href="https://railway.app/legal/privacy" className="text-indigo-600 hover:underline no-underline">railway.app/legal/privacy</a>
                  </td>
                </tr>
                <tr>
                  <td className="text-slate-700 font-medium" style={{ padding: '10px 16px', fontSize: 13 }}>OpenRouter</td>
                  <td className="text-slate-500" style={{ padding: '10px 16px', fontSize: 13 }}>AI insights (only if enabled per-app)</td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>
                    <a href="https://openrouter.ai/privacy" className="text-indigo-600 hover:underline no-underline">openrouter.ai/privacy</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-slate-900 font-bold mb-3" style={{ fontSize: 17 }}>Your rights</h2>
          <div className="flex flex-col gap-4">
            {[
              { title: 'Right to erasure', body: 'Delete your account via the portal (Settings → Delete Account). This permanently deletes all apps, features, events, and aggregates.' },
              { title: 'Data portability', body: 'Export your feature data as CSV from the portal Features page.' },
            ].map(({ title, body }) => (
              <div key={title} className="bg-slate-50 rounded-xl p-4">
                <p className="text-slate-900 font-semibold mb-1" style={{ fontSize: 13 }}>{title}</p>
                <p className="text-slate-500" style={{ fontSize: 13 }}>{body}</p>
              </div>
            ))}
            <p className="text-slate-500" style={{ fontSize: 13 }}>
              Contact: <a href="mailto:tamaraloni11@gmail.com" className="text-indigo-600 hover:underline">tamaraloni11@gmail.com</a>
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-slate-900 font-bold mb-3" style={{ fontSize: 17 }}>Jurisdiction</h2>
          <p className="text-slate-600" style={{ fontSize: 14, lineHeight: 1.7 }}>
            This policy is governed by the laws of Israel.
          </p>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-slate-50/95 backdrop-blur-sm" style={{ padding: '12px 32px' }}>
        <div className="flex items-center justify-between" style={{ fontSize: 12 }}>
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 overflow-hidden" style={{ width: 20, height: 20, borderRadius: 5 }}>
              <img src="/icon.png" alt="" style={{ width: 20, height: 20, objectFit: 'cover' }} />
            </div>
            <span className="text-slate-400 font-medium">FeaturePulse</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-400">Cellular Seminar Project</span>
          </div>
          <div className="flex gap-4">
            <a href="/" className="text-slate-400 hover:text-slate-600 no-underline">Home</a>
            {loggedIn ? (
              <button
                onClick={() => { clearToken(); window.location.href = '/' }}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12 }}
              >
                Sign Out
              </button>
            ) : (
              <a href="/login" className="text-slate-400 hover:text-slate-600 no-underline">Sign In</a>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}
