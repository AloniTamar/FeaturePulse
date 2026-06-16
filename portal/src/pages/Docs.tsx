import { useState, useEffect, useRef } from 'react'

const SECTIONS = [
  { id: 'getting-started',          label: 'Getting Started'         },
  { id: 'sdk-integration',          label: 'SDK Integration'         },
  { id: 'api-reference',            label: 'API Reference'           },
  { id: 'how-classification-works', label: 'How Classification Works'},
]

const ENDPOINTS = [
  { method: 'POST',   path: '/auth/register',              auth: false, desc: 'Create a new account' },
  { method: 'POST',   path: '/auth/login',                 auth: false, desc: 'Login — returns token + apps list' },
  { method: 'PATCH',  path: '/auth/me/password',           auth: true,  desc: 'Change password' },
  { method: 'DELETE', path: '/auth/me',                    auth: true,  desc: 'Delete account (cascades all apps)' },
  { method: 'GET',    path: '/apps',                       auth: true,  desc: 'List all apps for authenticated user' },
  { method: 'POST',   path: '/apps',                       auth: true,  desc: 'Create a new app — returns apiKey' },
  { method: 'PATCH',  path: '/apps/:appId',                auth: true,  desc: 'Rename app or update settings (thresholds, retention)' },
  { method: 'DELETE', path: '/apps/:appId',                auth: true,  desc: 'Delete app and all its data' },
  { method: 'GET',    path: '/apps/:appId/dashboard',      auth: true,  desc: 'Feature counts + 10 most recent transitions' },
  { method: 'GET',    path: '/apps/:appId/features',       auth: true,  desc: 'Paginated feature list (filter by state, sort)' },
  { method: 'GET',    path: '/apps/:appId/features/:id',   auth: true,  desc: 'Single feature detail' },
  { method: 'PATCH',  path: '/apps/:appId/features/:id/ignore', auth: true, desc: 'Mark feature as ignored (excluded from cron)' },
  { method: 'GET',    path: '/apps/:appId/transitions',    auth: true,  desc: 'Paginated state-transition log (filter by toState, sort)' },
  { method: 'GET',    path: '/apps/:appId/export',         auth: true,  desc: 'Export features as CSV or JSON' },
  { method: 'GET',    path: '/apps/:appId/trend',          auth: true,  desc: 'Daily interaction-rate trend (last N days)' },
  { method: 'POST',   path: '/api/v1/cron',                auth: true,  desc: 'Manually trigger nightly classification run' },
  { method: 'POST',   path: '/api/v1/events/batch',        auth: false, desc: 'SDK — ingest a batch of interaction events (API key auth)' },
]

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-blue-50 text-blue-700 border-blue-200',
  POST:   'bg-green-50 text-green-700 border-green-200',
  PATCH:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
}

function Pre({ children }: { children: string }) {
  return (
    <pre
      className="bg-slate-900 text-slate-100 rounded-lg overflow-x-auto font-mono"
      style={{ padding: 16, fontSize: 12.5, lineHeight: 1.7 }}
    >
      {children}
    </pre>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 56 }}>
      <h2 className="text-slate-900 font-extrabold mb-5" style={{ fontSize: 20, letterSpacing: '-0.3px' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function Docs() {
  const [activeId, setActiveId] = useState('getting-started')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.id)
        }
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex gap-10" style={{ maxWidth: 960 }}>
      {/* Sticky sidebar */}
      <aside
        className="flex-shrink-0 sticky"
        style={{ width: 180, top: 26, height: 'fit-content' }}
      >
        <p className="text-slate-400 font-bold uppercase mb-3" style={{ fontSize: 10, letterSpacing: '0.09em' }}>
          Contents
        </p>
        <nav className="flex flex-col gap-1">
          {SECTIONS.map(s => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`rounded-lg px-3 py-1.5 no-underline transition-colors font-medium ${
                activeId === s.id
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              style={{ fontSize: 13 }}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div ref={containerRef} className="flex-1 min-w-0">

        <Section id="getting-started" title="Getting Started">
          <ol className="flex flex-col gap-5">
            {[
              { n: 1, title: 'Create an account', body: 'Register at the login page. No apps are created automatically — you control what you track.' },
              { n: 2, title: 'Create an app', body: "Go to Apps → New App. Enter your app's name and package name (e.g. com.example.myapp). You'll receive an API key starting with fp_." },
              { n: 3, title: 'Add the SDK to your Android project', body: 'See the SDK Integration section for the Gradle dependency and initialization snippet.' },
              { n: 4, title: 'Run your app', body: 'The SDK automatically detects all interactive UI elements and starts sending interaction events to the backend. No manual tagging required.' },
              { n: 5, title: 'View your dashboard', body: "Open the Dashboard for your app. After events arrive and the first cron runs, you'll see feature counts and state classifications. You can trigger a cron run manually from the Dashboard." },
            ].map(({ n, title, body }) => (
              <li key={n} className="flex gap-4">
                <span
                  className="flex-shrink-0 flex items-center justify-center bg-indigo-600 text-white font-bold rounded-full"
                  style={{ width: 26, height: 26, fontSize: 12, marginTop: 1 }}
                >
                  {n}
                </span>
                <div>
                  <p className="text-slate-900 font-semibold mb-0.5" style={{ fontSize: 14 }}>{title}</p>
                  <p className="text-slate-500" style={{ fontSize: 13 }}>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="sdk-integration" title="SDK Integration">
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-slate-700 font-semibold mb-2" style={{ fontSize: 13 }}>1. Add the dependency</p>
              <Pre>{`// build.gradle.kts (app module)
dependencies {
    implementation("com.github.featurepulse:sdk:1.0.0")
}`}</Pre>
            </div>

            <div>
              <p className="text-slate-700 font-semibold mb-2" style={{ fontSize: 13 }}>2. Initialize in Application.kt</p>
              <Pre>{`class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FeaturePulse.init(
            this,
            PulseConfig.Builder()
                .setApiKey("fp_your_api_key_here")
                .setAppId("your_app_id_here")
                // Optional overrides:
                .setFlushIntervalMs(1_800_000)   // default: 30 min
                .setMaxBatchSize(500)             // default: 500 events
                .setMinImpressionMs(1_000)        // default: 1 second
                .setSamplingRate(1.0f)            // default: 100%
                .build()
        )
    }
}`}</Pre>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col gap-2">
              <p className="text-slate-900 font-semibold" style={{ fontSize: 13 }}>How touch interception works</p>
              <p className="text-slate-500" style={{ fontSize: 13 }}>
                The SDK wraps your Activity's <code className="bg-slate-200 px-1 rounded font-mono text-xs">Window.Callback</code> using the Proxy pattern. This intercepts every touch event without modifying your existing code or requiring any manual tagging.
              </p>
              <p className="text-slate-900 font-semibold mt-1" style={{ fontSize: 13 }}>How fingerprinting works</p>
              <p className="text-slate-500" style={{ fontSize: 13 }}>
                Each UI element is identified by <code className="bg-slate-200 px-1 rounded font-mono text-xs">SHA256(screenName + resourceName)</code> when a resource ID is available, falling back to <code className="bg-slate-200 px-1 rounded font-mono text-xs">SHA256(screenName + viewClass + hierarchyPath)</code> for dynamic views.
              </p>
              <p className="text-slate-900 font-semibold mt-1" style={{ fontSize: 13 }}>Batching and persistence</p>
              <p className="text-slate-500" style={{ fontSize: 13 }}>
                Events are buffered in a circular buffer (max 500). WorkManager flushes the buffer every 30 minutes. On <code className="bg-slate-200 px-1 rounded font-mono text-xs">onTrimMemory()</code> the buffer is persisted to SharedPreferences so events survive process death.
              </p>
            </div>
          </div>
        </Section>

        <Section id="api-reference" title="API Reference">
          <p className="text-slate-500 mb-4" style={{ fontSize: 13 }}>
            Base URL: <code className="bg-slate-100 px-1 rounded font-mono text-xs">http://localhost:3000/api/v1</code>
            &nbsp;· JWT auth: <code className="bg-slate-100 px-1 rounded font-mono text-xs">Authorization: Bearer &lt;token&gt;</code>
          </p>
          <div className="bg-white rounded-card border border-slate-200 overflow-hidden">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Method', 'Path', 'Auth', 'Description'].map(h => (
                    <th key={h} className="text-left text-slate-400 font-bold uppercase"
                      style={{ padding: '8px 16px', fontSize: 10, letterSpacing: '0.07em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-none hover:bg-slate-50 transition-colors">
                    <td style={{ padding: '10px 16px' }}>
                      <span
                        className={`inline-block font-bold border rounded px-1.5 py-px font-mono ${METHOD_COLORS[e.method]}`}
                        style={{ fontSize: 10 }}
                      >
                        {e.method}
                      </span>
                    </td>
                    <td className="font-mono text-slate-700" style={{ padding: '10px 16px', fontSize: 11.5 }}>
                      {e.path}
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span className={`text-xs font-semibold ${e.auth ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {e.auth ? 'JWT' : '—'}
                      </span>
                    </td>
                    <td className="text-slate-600" style={{ padding: '10px 16px', fontSize: 13 }}>
                      {e.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="how-classification-works" title="How Classification Works">
          <div className="flex flex-col gap-5">
            {/* State machine diagram */}
            <div className="bg-white rounded-card border border-slate-200 p-6">
              <p className="text-slate-700 font-semibold mb-4" style={{ fontSize: 13 }}>State Machine</p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {[
                  { label: 'THRIVING', color: '#16A34A', bg: '#DCFCE7' },
                  { label: 'DECLINING', color: '#CA8A04', bg: '#FEF9C3' },
                  { label: 'DORMANT', color: '#94A3B8', bg: '#F1F5F9' },
                  { label: 'DEAD', color: '#DC2626', bg: '#FEE2E2' },
                ].map((s, i, arr) => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span
                      className="rounded-full font-bold px-3 py-1"
                      style={{ background: s.bg, color: s.color, fontSize: 12 }}
                    >
                      {s.label}
                    </span>
                    {i < arr.length - 1 && (
                      <span className="text-slate-300 font-bold">→</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-slate-400 text-center mt-3" style={{ fontSize: 11.5 }}>
                Recovery to THRIVING is possible from any state when the interaction rate rises above 5%.
              </p>
            </div>

            {/* Rules */}
            <div className="flex flex-col gap-3">
              {[
                {
                  state: 'THRIVING', color: '#16A34A', bg: '#DCFCE7',
                  rule: 'Interaction rate > 5% and stable or growing.',
                  detail: 'This is the default state for newly detected features.',
                },
                {
                  state: 'DECLINING', color: '#CA8A04', bg: '#FEF9C3',
                  rule: 'Interaction rate dropped more than 20% week-over-week.',
                  detail: 'Compared to the previous 7-day window. Early warning sign.',
                },
                {
                  state: 'DORMANT', color: '#94A3B8', bg: '#F1F5F9',
                  rule: 'Interaction rate below 1% for 14+ consecutive days.',
                  detail: 'Threshold configurable in Settings. Sustained low usage.',
                },
                {
                  state: 'DEAD', color: '#DC2626', bg: '#FEE2E2',
                  rule: 'Zero interactions across all users for 30+ consecutive days.',
                  detail: 'Threshold configurable in Settings. Safe to remove from the app.',
                },
              ].map(({ state, color, bg, rule, detail }) => (
                <div key={state} className="bg-white rounded-card border border-slate-200 p-4 flex gap-4">
                  <span
                    className="flex-shrink-0 self-start rounded-full font-bold px-2.5 py-0.5"
                    style={{ background: bg, color, fontSize: 11 }}
                  >
                    {state}
                  </span>
                  <div>
                    <p className="text-slate-900 font-semibold" style={{ fontSize: 13 }}>{rule}</p>
                    <p className="text-slate-400 mt-0.5" style={{ fontSize: 12 }}>{detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Cron schedule */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-slate-900 font-semibold mb-1" style={{ fontSize: 13 }}>Cron Schedule</p>
              <p className="text-slate-500" style={{ fontSize: 13 }}>
                Classification runs nightly at <strong>02:00 UTC</strong>. It aggregates the previous day's raw events into daily summaries, re-classifies every non-ignored feature, and records a <code className="bg-slate-200 px-1 rounded font-mono text-xs">StateTransition</code> whenever a state changes. You can trigger it manually from the Dashboard or Features page using "Run Cron Now".
              </p>
            </div>

            {/* Interaction rate */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-slate-900 font-semibold mb-1" style={{ fontSize: 13 }}>What is "interaction rate"?</p>
              <p className="text-slate-500" style={{ fontSize: 13 }}>
                For a given day: <strong>interactions ÷ impressions</strong>, where an impression is any session in which the feature was visible, and an interaction is a tap or other engagement event. A rate of 0.05 means 5% of sessions where the feature appeared resulted in a user tapping it.
              </p>
            </div>

            {/* Ignored */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-slate-900 font-semibold mb-1" style={{ fontSize: 13 }}>Ignored features</p>
              <p className="text-slate-500" style={{ fontSize: 13 }}>
                Any feature can be marked as "ignored" from the Features list. Ignored features are excluded from the cron's classification loop and do not appear in the Dead Features count on the Dashboard. This is useful for system UI elements or features you have intentionally left in place.
              </p>
            </div>
          </div>
        </Section>

      </div>
    </div>
  )
}
