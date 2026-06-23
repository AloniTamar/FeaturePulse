import { useState, useEffect } from 'react'
import { isLoggedIn, clearToken } from '../api/client'

const SECTIONS = [
  { id: 'overview',        label: 'Overview'        },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'sdk-integration', label: 'SDK Integration' },
  { id: 'how-it-works',    label: 'How It Works'    },
  { id: 'analytics',       label: 'Analytics'       },
  { id: 'api-reference',   label: 'API Reference'   },
  { id: 'screenshots',     label: 'Screenshots'     },
]

const ENDPOINTS = [
  // Auth
  { method: 'POST',   path: '/auth/register',                        auth: 'None',    desc: 'Create account' },
  { method: 'POST',   path: '/auth/login',                           auth: 'None',    desc: 'Login — returns JWT + app list' },
  { method: 'PATCH',  path: '/auth/me/password',                     auth: 'JWT',     desc: 'Change password' },
  { method: 'DELETE', path: '/auth/me',                              auth: 'JWT',     desc: 'Delete account and all apps (cascade)' },
  // Apps
  { method: 'GET',    path: '/apps',                                 auth: 'JWT',     desc: 'List apps for authenticated user' },
  { method: 'POST',   path: '/apps',                                 auth: 'JWT',     desc: 'Create app — returns apiKey' },
  { method: 'PATCH',  path: '/apps/:appId',                          auth: 'JWT',     desc: 'Update name, thresholds, retention, AI settings' },
  { method: 'DELETE', path: '/apps/:appId',                          auth: 'JWT',     desc: 'Delete app and all its data' },
  { method: 'POST',   path: '/apps/:appId/rotate-key',               auth: 'JWT',     desc: 'Rotate API key — old key invalidated immediately' },
  { method: 'GET',    path: '/apps/config?appId=<id>',               auth: 'None',    desc: 'SDK — fetch remote config (sync interval, sampling rate)' },
  { method: 'PUT',    path: '/apps/:appId/config',                   auth: 'JWT',     desc: 'Update remote SDK config (sync interval, sampling rate)' },
  // Dashboard
  { method: 'GET',    path: '/apps/:appId/dashboard',                auth: 'JWT',     desc: 'Feature counts + 10 most recent state transitions' },
  { method: 'GET',    path: '/apps/:appId/dead',                     auth: 'JWT',     desc: 'List all DEAD features' },
  { method: 'GET',    path: '/apps/:appId/declining',                auth: 'JWT',     desc: 'List all DECLINING features' },
  { method: 'GET',    path: '/apps/:appId/transitions',              auth: 'JWT',     desc: 'Paginated state-transition log' },
  { method: 'GET',    path: '/apps/:appId/trend',                    auth: 'JWT',     desc: 'Daily interaction-rate trend (last N days)' },
  // Analytics & insights
  { method: 'GET',    path: '/apps/:appId/analytics',                auth: 'JWT',     desc: 'Per-screen stats, declining features, reach percentages' },
  { method: 'GET',    path: '/apps/:appId/insights',                 auth: 'JWT',     desc: 'AI health summary + action bullets (requires AI Insights enabled)' },
  // Features
  { method: 'GET',    path: '/apps/:appId/features',                 auth: 'JWT',     desc: 'Paginated feature list (filter by state, sort)' },
  { method: 'GET',    path: '/apps/:appId/export',                   auth: 'JWT',     desc: 'Export features as CSV or JSON' },
  { method: 'GET',    path: '/features/:featureId',                  auth: 'JWT',     desc: 'Feature detail' },
  { method: 'GET',    path: '/features/:featureId/timeline',         auth: 'JWT',     desc: 'Feature state-change timeline' },
  { method: 'PATCH',  path: '/features/:featureId/ignore',           auth: 'JWT',     desc: 'Mark feature as ignored (excluded from classification)' },
  // Cron & SDK
  { method: 'POST',   path: '/cron/trigger',                         auth: 'JWT',     desc: 'Manually trigger nightly classification run' },
  { method: 'POST',   path: '/events/batch',                         auth: 'API Key', desc: 'SDK — ingest a batch of interaction events' },
  { method: 'POST',   path: '/events/discover',                      auth: 'API Key', desc: 'SDK — register newly discovered UI features' },
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
    <section id={id} style={{ marginBottom: 64, scrollMarginTop: 76 }}>
      <h2 className="text-slate-900 font-extrabold mb-6" style={{ fontSize: 22, letterSpacing: '-0.4px' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

const ANALYTICS_METRICS = [
  {
    name: 'Interaction Rate',
    badge: 'Per feature · daily',
    desc: 'interactions ÷ impressions for a given day. The core signal used for classification.',
    detail: 'A rate of 0.05 means 5% of sessions where the feature was visible resulted in a tap. Values below 0.01 sustained for 14+ days trigger a DORMANT classification.',
  },
  {
    name: 'Week-over-Week Change',
    badge: 'Per feature · weekly',
    desc: 'Percentage change in interaction rate vs. the previous 7-day window.',
    detail: 'Used to detect DECLINING features before they go DORMANT. A −30% WoW change over two consecutive weeks is a strong DECLINING signal. Computed from WeeklyAggregate, not raw events.',
  },
  {
    name: 'Reach %',
    badge: 'Per feature · daily',
    desc: 'Unique users who interacted with the feature ÷ DAU.',
    detail: 'Shows how broadly a feature is used across your user base, not just total tap count. A feature tapped 1000 times by 10 power users has very different health than one tapped 1000 times by 1000 users.',
  },
  {
    name: 'Per-Screen Stats',
    badge: 'Per screen · daily',
    desc: 'Impressions, interactions, and average interaction rate grouped by screen name.',
    detail: 'Identifies which screens drive engagement vs. which are visited but ignored. Useful for prioritizing which screens to audit for dead features.',
  },
  {
    name: 'Daily Active Users (DAU)',
    badge: 'Per app · daily',
    desc: 'Unique session count per day.',
    detail: 'Used as the denominator for Reach % and as context for interpreting raw interaction counts. Stored in AppDailyStats — one row per app per day.',
  },
  {
    name: 'Daily Trend',
    badge: 'Per app · last N days',
    desc: 'Average interaction rate across all features per day.',
    detail: 'Shows overall engagement health over time. A drop in the trend line often precedes a wave of DORMANT/DEAD classifications. Available via GET /apps/:appId/trend.',
  },
  {
    name: 'AI Insights',
    badge: 'Per app · optional',
    desc: 'Natural-language health summary and 3–5 action bullets powered by Gemma via OpenRouter.',
    detail: 'Available in two modes: nightly (pre-computed by cron, instant load) or on-demand (fresh on each Analytics page visit). Requires OPENROUTER_API_KEY on the server — never exposed to the portal.',
  },
]

export default function LandingDocs() {
  const [activeId, setActiveId] = useState('overview')
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)
  const loggedIn = isLoggedIn()

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
    <div className="min-h-screen bg-white font-sans">

      {/* ── Top nav ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200" style={{ height: 56 }}>
        <div className="flex items-center justify-between h-full" style={{ padding: '0 32px' }}>
          <div className="flex items-center gap-2">
            <div className="flex-shrink-0 overflow-hidden" style={{ width: 26, height: 26, borderRadius: 7 }}>
              <img src="/icon.png" alt="FeaturePulse" style={{ width: 26, height: 26, objectFit: 'cover' }} />
            </div>
            <span className="text-slate-900 font-extrabold" style={{ fontSize: 14, letterSpacing: '-0.3px' }}>SDK Docs</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-slate-500 font-medium hover:text-slate-800 no-underline transition-colors" style={{ fontSize: 13 }}>
              ← Home
            </a>
            {loggedIn ? (
              <>
                <a href="/apps" className="inline-flex items-center bg-indigo-600 text-white font-semibold rounded-lg px-4 py-1.5 hover:bg-indigo-700 transition-colors no-underline" style={{ fontSize: 13 }}>
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
                <a href="/login" className="text-slate-600 font-medium hover:text-slate-900 transition-colors no-underline" style={{ fontSize: 13 }}>Sign In</a>
                <a href="/login?register=1" className="inline-flex items-center bg-indigo-600 text-white font-semibold rounded-lg px-4 py-1.5 hover:bg-indigo-700 transition-colors no-underline" style={{ fontSize: 13 }}>
                  Register
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── Main docs area ── */}
      <div style={{ padding: '32px 0 80px 0' }}>
        <div style={{ display: 'flex', gap: 0 }}>

          {/* Spacer — matches fixed sidebar left + width + gap to content */}
          <div className="hidden lg:block flex-shrink-0" style={{ width: 340 }} />

          {/* Fixed TOC sidebar — left-border accent pattern */}
          <aside
            className="hidden lg:block"
            style={{
              position: 'fixed',
              top: 96,
              left: 60,
              width: 250,
              height: 'calc(100vh - 96px - 160px)',
              overflowY: 'auto',
              zIndex: 10,
              borderLeft: '2px solid #E2E8F0',
              paddingLeft: 0,
            }}
          >
            <p className="text-slate-400 font-bold uppercase mb-4" style={{ fontSize: 10, letterSpacing: '0.09em', paddingLeft: 16 }}>
              Contents
            </p>
            <nav className="flex flex-col">
              {SECTIONS.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`no-underline transition-colors font-medium py-1.5 ${
                    activeId === s.id
                      ? 'text-indigo-600'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                  style={{
                    fontSize: 13,
                    paddingLeft: 14,
                    borderLeft: activeId === s.id ? '2px solid #6366F1' : '2px solid transparent',
                    marginLeft: -2,
                  }}
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Content — left-anchored with padding for breathing room */}
          <div style={{ flex: 1, minWidth: 0, paddingRight: 60, paddingLeft: 200 }}>
          <div style={{ width: '100%', maxWidth: 860 }}>

            <Section id="overview" title="Overview">
              <div className="flex flex-col gap-4">
                <p className="text-slate-600" style={{ fontSize: 14, lineHeight: 1.7 }}>
                  FeaturePulse is an Android SDK that automatically detects every interactive UI element in your app, tracks how often users interact with it, and classifies each feature as <strong>THRIVING</strong>, <strong>DECLINING</strong>, <strong>DORMANT</strong>, or <strong>DEAD</strong> — with no changes to your activities or fragments.
                </p>
                <p className="text-slate-600" style={{ fontSize: 14, lineHeight: 1.7 }}>
                  The system has three components: the <strong>Android SDK</strong> (event collection), the <strong>backend API</strong> (aggregation and classification), and the <strong>web portal</strong> (analytics dashboard). You interact with the SDK and the portal — the backend is fully managed.
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  {[
                    { label: 'Touch interception', value: 'Window.Callback proxy — zero Activity changes' },
                    { label: 'Fingerprinting', value: 'SHA256(screen + resourceId) with hierarchy fallback' },
                    { label: 'Event batching', value: 'Circular buffer (500 events), flushed every 30 min via WorkManager' },
                    { label: 'Classification', value: 'Nightly at 02:00 UTC — or trigger manually from dashboard' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-slate-500 font-semibold mb-0.5" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
                      <p className="text-slate-800" style={{ fontSize: 13 }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <Section id="getting-started" title="Getting Started">
              <ol className="flex flex-col gap-5">
                {[
                  { n: 1, title: 'Create an account', body: 'Register at the portal. No apps are created automatically — you control what you track.' },
                  { n: 2, title: 'Create an app', body: "Go to Apps → New App. Enter your app's name and package name (e.g. com.example.myapp). You'll receive an API key starting with fp_ and an App ID. Copy both — the API key is shown only once." },
                  { n: 3, title: 'Add the SDK', body: 'Add the JitPack repository and the FeaturePulse dependency to your Gradle build files. See SDK Integration below.' },
                  { n: 4, title: 'Add your API key to AndroidManifest.xml', body: 'Add two <meta-data> entries inside your <application> tag with your API key and App ID. The SDK initializes itself automatically — no Application class changes needed.' },
                  { n: 5, title: 'Run your app', body: 'The SDK auto-detects all interactive UI elements and starts sending interaction events. No manual tagging required.' },
                  { n: 6, title: 'View your dashboard', body: "Open the portal. After events arrive and the first classification runs, you'll see feature counts and states. Trigger classification manually anytime using the \"Run Cron Now\" button on Dashboard or Features." },
                ].map(({ n, title, body }) => (
                  <li key={n} className="flex gap-4">
                    <span
                      className="flex-shrink-0 flex items-center justify-center bg-indigo-600 text-white font-bold rounded-full"
                      style={{ width: 28, height: 28, fontSize: 12, marginTop: 2 }}
                    >
                      {n}
                    </span>
                    <div>
                      <p className="text-slate-900 font-semibold mb-1" style={{ fontSize: 14 }}>{title}</p>
                      <p className="text-slate-500" style={{ fontSize: 13, lineHeight: 1.6 }}>{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Section>

            <Section id="sdk-integration" title="SDK Integration">
              <div className="flex flex-col gap-6">

                <div>
                  <p className="text-slate-700 font-semibold mb-2" style={{ fontSize: 13 }}>1. Add JitPack to your repository list</p>
                  <p className="text-slate-500 mb-2" style={{ fontSize: 12 }}>In <code className="bg-slate-100 px-1 rounded font-mono text-xs">settings.gradle.kts</code></p>
                  <Pre>{`dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}`}</Pre>
                </div>

                <div>
                  <p className="text-slate-700 font-semibold mb-2" style={{ fontSize: 13 }}>2. Add the dependency</p>
                  <p className="text-slate-500 mb-2" style={{ fontSize: 12 }}>In <code className="bg-slate-100 px-1 rounded font-mono text-xs">app/build.gradle.kts</code></p>
                  <Pre>{`dependencies {
    implementation("com.github.TamarAloni:FeaturePulse:sdk-v1.0.0")
}`}</Pre>
                </div>

                <div>
                  <p className="text-slate-700 font-semibold mb-2" style={{ fontSize: 13 }}>3. Add your keys to AndroidManifest.xml</p>
                  <p className="text-slate-500 mb-2" style={{ fontSize: 12 }}>
                    Inside the <code className="bg-slate-100 px-1 rounded font-mono text-xs">{`<application>`}</code> tag. The SDK reads these at startup — no code changes needed:
                  </p>
                  <Pre>{`<application ...>

    <!-- FeaturePulse: auto-initializes on app start -->
    <meta-data
        android:name="com.featurepulse.sdk.API_KEY"
        android:value="fp_your_api_key_here" />

    <meta-data
        android:name="com.featurepulse.sdk.APP_ID"
        android:value="your_app_uuid_here" />

</application>`}</Pre>
                </div>

                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3">
                  <div className="flex-shrink-0 text-indigo-600 font-bold" style={{ fontSize: 13 }}>i</div>
                  <p className="text-indigo-700" style={{ fontSize: 13, lineHeight: 1.6 }}>
                    That's it. The SDK registers a <code className="bg-indigo-100 px-1 rounded font-mono text-xs">ContentProvider</code> that Android boots automatically before your <code className="bg-indigo-100 px-1 rounded font-mono text-xs">Application.onCreate()</code> — the same technique used by Firebase and WorkManager.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                  <p className="text-slate-900 font-semibold mb-2" style={{ fontSize: 13 }}>Alternative: explicit initialization</p>
                  <p className="text-slate-500 mb-3" style={{ fontSize: 12 }}>
                    To initialize from code (e.g. read the key from <code className="bg-slate-200 px-1 rounded font-mono text-xs">BuildConfig</code>), skip the meta-data entries and call <code className="bg-slate-200 px-1 rounded font-mono text-xs">FeaturePulse.init()</code> in your Application class instead:
                  </p>
                  <Pre>{`class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FeaturePulse.init(
            this,
            PulseConfig.Builder()
                .setApiKey(BuildConfig.FP_API_KEY)
                .setAppId("your_app_uuid_here")
                .build()
        )
    }
}`}</Pre>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
                  <div>
                    <p className="text-slate-900 font-semibold mb-1" style={{ fontSize: 13 }}>Touch interception</p>
                    <p className="text-slate-500" style={{ fontSize: 13 }}>
                      The SDK wraps your Activity's <code className="bg-slate-200 px-1 rounded font-mono text-xs">Window.Callback</code> using the Proxy pattern — every touch event is intercepted without modifying your existing Activity or Fragment code.
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-900 font-semibold mb-1" style={{ fontSize: 13 }}>UI fingerprinting</p>
                    <p className="text-slate-500" style={{ fontSize: 13 }}>
                      Each element is identified by <code className="bg-slate-200 px-1 rounded font-mono text-xs">SHA256(screenName + resourceName)</code> when a resource ID exists, falling back to <code className="bg-slate-200 px-1 rounded font-mono text-xs">SHA256(screenName + viewClass + hierarchyPath)</code> for dynamic views.
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-900 font-semibold mb-1" style={{ fontSize: 13 }}>Batching and persistence</p>
                    <p className="text-slate-500" style={{ fontSize: 13 }}>
                      Events buffer in a circular buffer (max 500). WorkManager flushes every 30 minutes. On <code className="bg-slate-200 px-1 rounded font-mono text-xs">onTrimMemory()</code> the buffer is persisted to SharedPreferences to survive process death.
                    </p>
                  </div>
                </div>
              </div>
            </Section>

            <Section id="how-it-works" title="How Classification Works">
              <div className="flex flex-col gap-5">

                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <p className="text-slate-700 font-semibold mb-4" style={{ fontSize: 13 }}>State Machine</p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {[
                      { label: 'THRIVING',  color: '#16A34A', bg: '#DCFCE7' },
                      { label: 'DECLINING', color: '#CA8A04', bg: '#FEF9C3' },
                      { label: 'DORMANT',   color: '#94A3B8', bg: '#F1F5F9' },
                      { label: 'DEAD',      color: '#DC2626', bg: '#FEE2E2' },
                    ].map((s, i, arr) => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="rounded-full font-bold px-3 py-1" style={{ background: s.bg, color: s.color, fontSize: 12 }}>
                          {s.label}
                        </span>
                        {i < arr.length - 1 && <span className="text-slate-300 font-bold">→</span>}
                      </div>
                    ))}
                  </div>
                  <p className="text-slate-400 text-center mt-3" style={{ fontSize: 11.5 }}>
                    Recovery to THRIVING is possible from any state when the interaction rate rises above 5%.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {[
                    { state: 'THRIVING',  color: '#16A34A', bg: '#DCFCE7', rule: 'Interaction rate > 5% and stable or growing.',                          detail: 'Default state for newly discovered features.' },
                    { state: 'DECLINING', color: '#CA8A04', bg: '#FEF9C3', rule: 'Interaction rate dropped more than 20% week-over-week.',                  detail: 'Early warning — compared to the previous 7-day window.' },
                    { state: 'DORMANT',   color: '#94A3B8', bg: '#F1F5F9', rule: 'Interaction rate below 1% for 14+ consecutive days.',                    detail: 'Threshold configurable in Settings. Sustained low usage.' },
                    { state: 'DEAD',      color: '#DC2626', bg: '#FEE2E2', rule: 'Zero interactions across all users for 30+ consecutive days.',           detail: 'Threshold configurable in Settings. Safe to remove from the app.' },
                  ].map(({ state, color, bg, rule, detail }) => (
                    <div key={state} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4">
                      <span className="flex-shrink-0 self-start rounded-full font-bold px-2.5 py-0.5" style={{ background: bg, color, fontSize: 11 }}>
                        {state}
                      </span>
                      <div>
                        <p className="text-slate-900 font-semibold" style={{ fontSize: 13 }}>{rule}</p>
                        <p className="text-slate-400 mt-0.5" style={{ fontSize: 12 }}>{detail}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
                  <div>
                    <p className="text-slate-900 font-semibold mb-1" style={{ fontSize: 13 }}>What is "interaction rate"?</p>
                    <p className="text-slate-500" style={{ fontSize: 13 }}>
                      <strong>interactions ÷ impressions</strong> for a given day. An impression is any session where the feature was visible; an interaction is a tap or engagement event. A rate of 0.05 means 5% of sessions resulted in a tap.
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-900 font-semibold mb-1" style={{ fontSize: 13 }}>Schedule</p>
                    <p className="text-slate-500" style={{ fontSize: 13 }}>
                      Classification runs nightly at <strong>02:00 UTC</strong> via GitHub Actions. Trigger it manually anytime from Dashboard or Features — "Run Cron Now".
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-900 font-semibold mb-1" style={{ fontSize: 13 }}>Ignored features</p>
                    <p className="text-slate-500" style={{ fontSize: 13 }}>
                      Mark any feature as "ignored" from the Features list to exclude it from classification. Useful for system UI elements or features you intentionally keep.
                    </p>
                  </div>
                </div>
              </div>
            </Section>

            <Section id="analytics" title="Analytics">
              <p className="text-slate-600 mb-5" style={{ fontSize: 14, lineHeight: 1.7 }}>
                The Analytics page aggregates all collected data into actionable metrics. Available via <code className="bg-slate-100 px-1 rounded font-mono text-xs">GET /apps/:appId/analytics</code>.
              </p>
              <div className="flex flex-col gap-2">
                {ANALYTICS_METRICS.map(({ name, badge, detail }) => {
                  const open = expandedMetric === name
                  return (
                    <div
                      key={name}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-shadow hover:shadow-sm"
                    >
                      {/* Always-visible header — click to expand screenshot */}
                      <button
                        onClick={() => setExpandedMetric(open ? null : name)}
                        className="w-full text-left flex items-start justify-between gap-3 p-4"
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        <div className="flex flex-col gap-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-slate-900 font-semibold" style={{ fontSize: 13 }}>{name}</p>
                            <span className="bg-slate-100 text-slate-400 rounded px-2 py-px font-mono flex-shrink-0" style={{ fontSize: 10 }}>{badge}</span>
                          </div>
                          <p className="text-slate-500 text-left" style={{ fontSize: 13, lineHeight: 1.6 }}>{detail}</p>
                        </div>
                        <span className="text-slate-400 flex-shrink-0 mt-0.5 transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: 18, lineHeight: 1 }}>⌄</span>
                      </button>
                      {/* Expandable screenshot */}
                      <div style={{ maxHeight: open ? 200 : 0, overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                        <div className="px-4 pb-4">
                          <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg flex items-center justify-center" style={{ height: 120 }}>
                            <p className="text-slate-300 font-medium" style={{ fontSize: 12 }}>Screenshot coming soon</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Section>

            <Section id="api-reference" title="API Reference">
              <p className="text-slate-500 mb-2" style={{ fontSize: 13 }}>
                Base URL: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">https://featurepulse-production-d81d.up.railway.app/api/v1</code>
              </p>
              <p className="text-slate-500 mb-5" style={{ fontSize: 13 }}>
                JWT auth: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">Authorization: Bearer &lt;token&gt;</code>
                &nbsp;·&nbsp;
                API key auth: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">X-API-Key: fp_&lt;key&gt;</code>
              </p>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Method', 'Path', 'Auth', 'Description'].map(h => (
                        <th key={h} className="text-left text-slate-400 font-bold uppercase" style={{ padding: '8px 16px', fontSize: 10, letterSpacing: '0.07em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ENDPOINTS.map((e, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-none hover:bg-slate-50 transition-colors">
                        <td style={{ padding: '10px 16px' }}>
                          <span className={`inline-block font-bold border rounded px-1.5 py-px font-mono ${METHOD_COLORS[e.method]}`} style={{ fontSize: 10 }}>
                            {e.method}
                          </span>
                        </td>
                        <td className="font-mono text-slate-700" style={{ padding: '10px 16px', fontSize: 11.5 }}>
                          {e.path}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <span className={`text-xs font-semibold ${
                            e.auth === 'JWT'     ? 'text-indigo-600' :
                            e.auth === 'API Key' ? 'text-emerald-600' : 'text-slate-400'
                          }`}>
                            {e.auth}
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

            <Section id="screenshots" title="Screenshots">
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-16 text-center">
                <p className="text-slate-400 font-semibold" style={{ fontSize: 14 }}>Screenshots coming soon</p>
                <p className="text-slate-300 mt-1" style={{ fontSize: 12 }}>Dashboard, Features list, Analytics, and SDK demo app</p>
              </div>
            </Section>

          </div>
          </div>
        </div>
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
            <a href="/privacy" className="text-slate-400 hover:text-slate-600 no-underline">Privacy Policy</a>
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
