# Landing Page, Cron Trigger & SDK Auto-Init Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "Run Cron Now" portal button, build a public landing/docs page accessible without login, and add ContentProvider-based auto-init to the Android SDK.

**Architecture:** Three independent tracks. Track 1 adds a JWT-authenticated `/api/v1/cron/trigger` endpoint to the server and updates the portal hook (the existing button calls a route that doesn't exist). Track 2 creates a standalone public page at `/` — the landing page IS the docs (like Google Maps SDK docs) — with auth-aware top nav, and redirects `/docs` there. Track 3 adds a `ContentProvider` to the SDK that auto-initializes from `AndroidManifest.xml` metadata so developers need zero Kotlin code to integrate.

**Tech Stack:** Node.js 20 / Express / TypeScript / Jest / Supertest (server), React 18 / Vite / Tailwind / React Router v6 / TypeScript (portal), Kotlin / Android ContentProvider API (SDK)

## Global Constraints

- Node.js >= 20
- TypeScript strict mode on — do not disable
- All server tests hit a real PostgreSQL database — no mocks; run with `cd server && npx jest --forceExit --runInBand`
- `beforeEach` in server tests deletes rows in dependency order (rawEvent → feature → app → user)
- Never expose `JWT_SECRET` or `CRON_SECRET` to the portal or SDK
- API key format: `fp_<hex>` — must stay compatible with the Android SDK
- JitPack dependency string: `com.github.TamarAloni:FeaturePulse:sdk-v1.0.0`
- Production server URL: `https://featurepulse-production-d81d.up.railway.app`

---

## Track 1: Cron Trigger Fix

### Task 1: Add JWT-protected `/api/v1/cron/trigger` and fix portal hook

The portal's `useCron.ts` calls `POST /api/v1/cron` with a JWT token, but that route doesn't exist on the server (only `/api/v1/cron/nightly` exists, protected by `CRON_SECRET`). Fix: add a new JWT-protected route and update the hook URL.

**Files:**
- Modify: `server/src/index.ts`
- Modify: `portal/src/hooks/useCron.ts`
- Modify: `server/tests/cron.test.ts`

**Interfaces:**
- Consumes: `jwtAuth` from `server/src/middleware/auth.ts` — `(req, res, next) => void`, reads `Authorization: Bearer <jwt>`
- Consumes: `runNightlyAggregation()` from `server/src/services/aggregation.ts` — already imported in `index.ts`
- Produces: `POST /api/v1/cron/trigger` — returns `200 { ok: true, message: string }` with valid JWT, `401` otherwise

- [ ] **Step 1: Write the failing tests**

Open `server/tests/cron.test.ts`. At the very end of the file (after the existing 3 tests), add:

```typescript
describe('POST /api/v1/cron/trigger', () => {
  beforeEach(async () => {
    await prisma.rawEvent.deleteMany()
    await prisma.feature.deleteMany()
    await prisma.app.deleteMany()
    await prisma.user.deleteMany()
  })

  async function getJwt(email: string): Promise<string> {
    await request(app).post('/api/v1/auth/register').send({ email, password: 'Password1!' })
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password1!' })
    return res.body.token as string
  }

  test('returns 401 with no token', async () => {
    const res = await request(app).post('/api/v1/cron/trigger')
    expect(res.status).toBe(401)
  })

  test('returns 401 with invalid token', async () => {
    const res = await request(app)
      .post('/api/v1/cron/trigger')
      .set('Authorization', 'Bearer not_a_real_jwt')
    expect(res.status).toBe(401)
  })

  test('returns 200 with valid JWT', async () => {
    const token = await getJwt('cron_trigger@test.com')
    const res = await request(app)
      .post('/api/v1/cron/trigger')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify the tests fail**

```bash
cd server && npx jest --forceExit --runInBand tests/cron.test.ts -t "cron/trigger"
```

Expected: FAIL — `POST /api/v1/cron/trigger` returns 404 (route doesn't exist yet).

- [ ] **Step 3: Add the route and import to index.ts**

In `server/src/index.ts`, add this import after the existing route imports (after line `import { runNightlyAggregation } from './services/aggregation'`):

```typescript
import { jwtAuth } from './middleware/auth'
```

Then add this route directly after the existing `/api/v1/cron/nightly` block (after the closing `}` on line 54, before `app.use('/api/v1/auth', authRouter)`):

```typescript
app.post('/api/v1/cron/trigger', jwtAuth, async (_req, res) => {
  try {
    await runNightlyAggregation()
    res.json({ ok: true, message: 'Aggregation complete' })
  } catch (err) {
    logger.error({ err }, 'Manual cron trigger failed')
    res.status(500).json({ error: 'Cron job failed' })
  }
})
```

- [ ] **Step 4: Run the cron tests**

```bash
cd server && npx jest --forceExit --runInBand tests/cron.test.ts
```

Expected: all 6 tests pass (3 existing + 3 new).

- [ ] **Step 5: Fix the portal hook URL**

In `portal/src/hooks/useCron.ts`, change line 21 from:
```typescript
      const res = await fetch(`${BASE}/api/v1/cron`, {
```
To:
```typescript
      const res = await fetch(`${BASE}/api/v1/cron/trigger`, {
```

- [ ] **Step 6: Run the full server suite**

```bash
cd server && npx jest --forceExit --runInBand
```

Expected: all tests pass.

- [ ] **Step 7: Manual smoke test**

```bash
cd server && npm run dev &
cd portal && npm run dev
```

Log in to the portal, go to Dashboard, click "Run Cron Now". It should show loading spinner then "✓ Done". Check server logs for "Nightly aggregation" output.

- [ ] **Step 8: Commit**

```bash
git add server/src/index.ts server/tests/cron.test.ts portal/src/hooks/useCron.ts
git commit -m "feat: add JWT-protected cron trigger endpoint, fix portal Run Cron Now button"
```

---

## Track 2: Public Landing Page + Rich Docs

### Task 2: Update routing to make `/` and `/docs` public

Currently every route (including `/docs`) is wrapped in `AuthLayout`, which redirects to `/login` when not logged in. This task moves `/` and `/docs` outside that guard.

**Files:**
- Modify: `portal/src/App.tsx`

**Interfaces:**
- Produces: `/` renders `LandingDocs` (no auth); `/docs` redirects to `/`; all `/apps`, `/account`, `/apps/:appId/*` routes remain behind `AuthLayout` unchanged

- [ ] **Step 1: Replace App.tsx**

Replace the entire content of `portal/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isLoggedIn } from './api/client'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Features from './pages/Features'
import FeatureDetail from './pages/FeatureDetail'
import Transitions from './pages/Transitions'
import Settings from './pages/Settings'
import Account from './pages/Account'
import Apps from './pages/Apps'
import LandingDocs from './pages/LandingDocs'
import Analytics from './pages/Analytics'
import PrivacyPolicy from './pages/PrivacyPolicy'

function AuthLayout() {
  return isLoggedIn() ? <Layout /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes — no login required */}
        <Route path="/" element={<LandingDocs />} />
        <Route path="/docs" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* Protected routes */}
        <Route element={<AuthLayout />}>
          <Route path="/apps" element={<Apps />} />
          <Route path="/account" element={<Account />} />
          <Route path="/apps/:appId">
            <Route path="dashboard"           element={<Dashboard />} />
            <Route path="features"            element={<Features />} />
            <Route path="features/:featureId" element={<FeatureDetail />} />
            <Route path="transitions"         element={<Transitions />} />
            <Route path="analytics"           element={<Analytics />} />
            <Route path="settings"            element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Update Login.tsx to support `?register=1` deep link**

In `portal/src/pages/Login.tsx`, replace line 7:
```typescript
  const [tab,      setTab]    = useState<'login' | 'register'>('login')
```
With:
```typescript
  const [tab,      setTab]    = useState<'login' | 'register'>(
    new URLSearchParams(window.location.search).get('register') === '1' ? 'register' : 'login'
  )
```

This makes the "Register" button from the landing page (`/login?register=1`) open the login page directly on the register tab.

- [ ] **Step 3: Commit**

```bash
git add portal/src/App.tsx portal/src/pages/Login.tsx
git commit -m "feat(portal): make / and /docs public routes, redirect /docs to /"
```

---

### Task 3: Build the LandingDocs page

A standalone full-page component with its own nav (no portal sidebar). Shows different nav links depending on whether the user is logged in. Sections: Overview, Getting Started, SDK Integration, Best-Fit Apps, How It Works, API Reference, Screenshots placeholder.

**Files:**
- Create: `portal/src/pages/LandingDocs.tsx`

**Interfaces:**
- Consumes: `isLoggedIn()` from `../api/client` — returns `boolean`
- Produces: standalone page component, no Layout/sidebar dependency

- [ ] **Step 1: Create portal/src/pages/LandingDocs.tsx**

```tsx
import { useState, useEffect, useRef } from 'react'
import { isLoggedIn } from '../api/client'

const SECTIONS = [
  { id: 'overview',        label: 'Overview'        },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'sdk-integration', label: 'SDK Integration' },
  { id: 'best-fit-apps',   label: 'Best-Fit Apps'   },
  { id: 'how-it-works',    label: 'How It Works'    },
  { id: 'api-reference',   label: 'API Reference'   },
  { id: 'screenshots',     label: 'Screenshots'     },
]

const ENDPOINTS = [
  { method: 'POST',   path: '/auth/register',                   auth: 'None',    desc: 'Create a new account' },
  { method: 'POST',   path: '/auth/login',                      auth: 'None',    desc: 'Login — returns JWT token + app list' },
  { method: 'PATCH',  path: '/auth/me/password',                auth: 'JWT',     desc: 'Change account password' },
  { method: 'DELETE', path: '/auth/me',                         auth: 'JWT',     desc: 'Delete account and all apps (cascade)' },
  { method: 'GET',    path: '/apps',                            auth: 'JWT',     desc: 'List all apps for authenticated user' },
  { method: 'POST',   path: '/apps',                            auth: 'JWT',     desc: 'Create a new app — returns apiKey' },
  { method: 'PATCH',  path: '/apps/:appId',                     auth: 'JWT',     desc: 'Update name, thresholds, retention, AI settings' },
  { method: 'DELETE', path: '/apps/:appId',                     auth: 'JWT',     desc: 'Delete app and all its data' },
  { method: 'GET',    path: '/apps/:appId/dashboard',           auth: 'JWT',     desc: 'Feature counts + 10 most recent state transitions' },
  { method: 'GET',    path: '/apps/:appId/features',            auth: 'JWT',     desc: 'Paginated feature list (filter by state, sort)' },
  { method: 'GET',    path: '/apps/:appId/features/:id',        auth: 'JWT',     desc: 'Single feature detail with history' },
  { method: 'PATCH',  path: '/apps/:appId/features/:id/ignore', auth: 'JWT',     desc: 'Mark feature as ignored (excluded from classification)' },
  { method: 'GET',    path: '/apps/:appId/transitions',         auth: 'JWT',     desc: 'Paginated state-transition log' },
  { method: 'GET',    path: '/apps/:appId/export',              auth: 'JWT',     desc: 'Export features as CSV or JSON' },
  { method: 'GET',    path: '/apps/:appId/trend',               auth: 'JWT',     desc: 'Daily interaction-rate trend (last N days)' },
  { method: 'POST',   path: '/cron/trigger',                    auth: 'JWT',     desc: 'Manually trigger nightly classification run' },
  { method: 'POST',   path: '/events/batch',                    auth: 'API Key', desc: 'SDK — ingest a batch of interaction events' },
  { method: 'POST',   path: '/events/discover',                 auth: 'API Key', desc: 'SDK — register newly discovered UI features' },
]

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-blue-50 text-blue-700 border-blue-200',
  POST:   'bg-green-50 text-green-700 border-green-200',
  PATCH:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  DELETE: 'bg-red-50 text-red-700 border-red-200',
}

const CATEGORIES = [
  {
    name: 'E-Commerce',
    color: '#6366F1', bg: '#EEF2FF',
    examples: 'Product filters, checkout steps, recommendation widgets, wish-list buttons',
    reason: 'Feature-rich product pages accumulate UI over years. FeaturePulse shows which filters and widgets users actually tap.',
  },
  {
    name: 'Social',
    color: '#0EA5E9', bg: '#E0F2FE',
    examples: 'Reaction types, share destinations, story features, privacy toggles',
    reason: 'Social apps ship new engagement features every sprint. Dead ones create clutter that hurts retention.',
  },
  {
    name: 'Fintech',
    color: '#10B981', bg: '#D1FAE5',
    examples: 'Account features, payment methods, report types, card management screens',
    reason: 'Regulatory requirements drive feature addition. FeaturePulse identifies which compliance screens users actually reach.',
  },
  {
    name: 'News & Media',
    color: '#F59E0B', bg: '#FEF3C7',
    examples: 'Content categories, playback controls, sharing options, bookmark types',
    reason: 'Media apps push users toward algorithmic feeds. Manual category browsing often dies silently.',
  },
  {
    name: 'Entertainment',
    color: '#EC4899', bg: '#FCE7F3',
    examples: 'Game modes, achievement screens, in-app purchase paths, difficulty settings',
    reason: 'Games add seasonal content that overstays its welcome. Dead features waste memory and bloat APK size.',
  },
  {
    name: 'Productivity',
    color: '#8B5CF6', bg: '#EDE9FE',
    examples: 'Organizational tools, template types, advanced settings, export formats',
    reason: 'Productivity apps accumulate power-user features. FeaturePulse shows which advanced tools the average user ignores.',
  },
]

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
    <section id={id} style={{ marginBottom: 64 }}>
      <h2 className="text-slate-900 font-extrabold mb-6" style={{ fontSize: 22, letterSpacing: '-0.4px' }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function LandingDocs() {
  const [activeId, setActiveId] = useState('overview')
  const containerRef = useRef<HTMLDivElement>(null)
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
        <div className="flex items-center justify-between h-full" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
          <div className="flex items-center gap-2.5">
            <div className="flex-shrink-0 overflow-hidden" style={{ width: 30, height: 30, borderRadius: 8 }}>
              <img src="/icon.png" alt="FeaturePulse" style={{ width: 30, height: 30, objectFit: 'cover' }} />
            </div>
            <span className="text-slate-900 font-extrabold" style={{ fontSize: 15, letterSpacing: '-0.3px' }}>
              FeaturePulse
            </span>
            <span className="ml-4 text-slate-400 hidden sm:inline" style={{ fontSize: 13 }}>SDK Docs</span>
          </div>
          <div className="flex items-center gap-3">
            {loggedIn ? (
              <a
                href="/apps"
                className="inline-flex items-center bg-indigo-600 text-white font-semibold rounded-lg px-4 py-1.5 hover:bg-indigo-700 transition-colors no-underline"
                style={{ fontSize: 13 }}
              >
                Go to Dashboard
              </a>
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

      {/* ── Hero ── */}
      <div className="border-b border-slate-100" style={{ background: 'linear-gradient(135deg, #F8FAFF 0%, #EEF2FF 100%)', padding: '56px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div className="inline-flex items-center bg-indigo-50 text-indigo-600 font-semibold rounded-full px-3 py-1 mb-4" style={{ fontSize: 12 }}>
            Android SDK
          </div>
          <h1 className="text-slate-900 font-extrabold mb-4" style={{ fontSize: 40, lineHeight: 1.15, letterSpacing: '-0.8px' }}>
            Stop shipping features<br />nobody uses
          </h1>
          <p className="text-slate-500 mb-8" style={{ fontSize: 17, lineHeight: 1.6, maxWidth: 560, margin: '0 auto 32px' }}>
            FeaturePulse automatically tracks which UI elements your users actually interact with — and which ones they ignore. No manual tagging. No code changes to your activities or fragments.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a href="#getting-started" className="inline-flex items-center bg-indigo-600 text-white font-semibold rounded-lg px-5 py-2.5 hover:bg-indigo-700 transition-colors no-underline" style={{ fontSize: 14 }}>
              Get Started
            </a>
            <a href="#sdk-integration" className="inline-flex items-center bg-white text-slate-700 font-semibold rounded-lg px-5 py-2.5 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors no-underline" style={{ fontSize: 14 }}>
              View Integration
            </a>
          </div>
        </div>
      </div>

      {/* ── How it works strip ── */}
      <div className="border-b border-slate-100" style={{ padding: '48px 24px', background: '#FAFAFA' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p className="text-center text-slate-400 font-bold uppercase mb-8" style={{ fontSize: 11, letterSpacing: '0.1em' }}>
            How it works
          </p>
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { n: '01', title: 'Add the SDK', body: 'One Gradle dependency and your API key in AndroidManifest.xml. No Application subclass changes required.' },
              { n: '02', title: 'Events flow in', body: 'Touch events are intercepted via Window.Callback proxy and batched every 30 minutes using WorkManager.' },
              { n: '03', title: 'See what\'s dead', body: 'Nightly classification scores every feature: THRIVING, DECLINING, DORMANT, or DEAD — visible on your dashboard.' },
            ].map(({ n, title, body }) => (
              <div key={n} className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="text-indigo-600 font-extrabold mb-3" style={{ fontSize: 11, letterSpacing: '0.08em' }}>{n}</div>
                <p className="text-slate-900 font-bold mb-2" style={{ fontSize: 15 }}>{title}</p>
                <p className="text-slate-500" style={{ fontSize: 13, lineHeight: 1.6 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main docs area ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
        <div className="flex gap-12">

          {/* Sticky TOC sidebar */}
          <aside className="flex-shrink-0 sticky hidden lg:block" style={{ width: 190, top: 76, height: 'fit-content' }}>
            <p className="text-slate-400 font-bold uppercase mb-3" style={{ fontSize: 10, letterSpacing: '0.09em' }}>
              Contents
            </p>
            <nav className="flex flex-col gap-0.5">
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

            <Section id="best-fit-apps" title="Best-Fit App Categories">
              <p className="text-slate-500 mb-6" style={{ fontSize: 14, lineHeight: 1.6 }}>
                FeaturePulse delivers the most value to apps with many UI features accumulated over multiple release cycles — the kind where dead buttons and screens have been piling up for years.
              </p>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {CATEGORIES.map(({ name, color, bg, examples, reason }) => (
                  <div key={name} className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="mb-3">
                      <span className="rounded-full font-bold px-3 py-0.5" style={{ background: bg, color, fontSize: 12 }}>
                        {name}
                      </span>
                    </div>
                    <p className="text-slate-700 font-semibold mb-1" style={{ fontSize: 13 }}>Why it matters</p>
                    <p className="text-slate-500 mb-3" style={{ fontSize: 12.5, lineHeight: 1.6 }}>{reason}</p>
                    <p className="text-slate-400 font-semibold mb-1" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Example features tracked
                    </p>
                    <p className="text-slate-500" style={{ fontSize: 12 }}>{examples}</p>
                  </div>
                ))}
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

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 bg-slate-50" style={{ padding: '24px' }}>
        <div className="flex items-center justify-between flex-wrap gap-3" style={{ maxWidth: 1100, margin: '0 auto', fontSize: 12 }}>
          <span className="text-slate-400">FeaturePulse — Cellular Seminar Project</span>
          <div className="flex gap-4">
            <a href="/privacy" className="text-slate-400 hover:text-slate-600 no-underline">Privacy Policy</a>
            {!loggedIn && <a href="/login" className="text-slate-400 hover:text-slate-600 no-underline">Sign In</a>}
          </div>
        </div>
      </footer>
    </div>
  )
}
```

- [ ] **Step 2: Run portal type check**

```bash
cd portal && npx tsc --noEmit
```

Expected: no TypeScript errors.

- [ ] **Step 3: Start the portal and verify**

```bash
cd portal && npm run dev
```

Open `http://localhost:5173/` (not logged in). Verify:
- Top nav shows "Sign In" and "Register" buttons
- Hero, 3-step strip, and all 7 doc sections render
- Sticky TOC sidebar highlights the active section as you scroll
- Clicking "Sign In" goes to `/login`
- Clicking "Register" goes to `/login?register=1` which opens the register tab

Navigate to `http://localhost:5173/docs` — confirm it redirects to `/`.

Then log in and return to `http://localhost:5173/`. Verify:
- Nav shows "Go to Dashboard" button instead
- Clicking it goes to `/apps`

- [ ] **Step 4: Commit**

```bash
git add portal/src/pages/LandingDocs.tsx
git commit -m "feat(portal): public landing + rich SDK docs page at /"
```

---

## Track 3: SDK Auto-Init via ContentProvider

### Task 4: ContentProvider zero-code initialization

Add a `ContentProvider` to the SDK that Android boots automatically before `Application.onCreate()`. It reads `com.featurepulse.sdk.API_KEY` and `com.featurepulse.sdk.APP_ID` from the host app's manifest metadata and calls `FeaturePulse.init()` internally. Backwards compatible: explicit `FeaturePulse.init()` still works (the `if (initialized) return` guard is already in place).

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/FeaturePulseInitProvider.kt`
- Modify: `sdk/src/main/AndroidManifest.xml`

**Interfaces:**
- Consumes: `FeaturePulse.init(application: Application, config: PulseConfig)` from `com.featurepulse.FeaturePulse` — already has `if (initialized) return` guard
- Consumes: `PulseConfig.Builder` from `com.featurepulse.PulseConfig`
- Produces: SDK auto-initializes when `com.featurepulse.sdk.API_KEY` meta-data is present; `com.featurepulse.sdk.APP_ID` is optional (defaults to `context.packageName`)

- [ ] **Step 1: Create FeaturePulseInitProvider.kt**

Create `sdk/src/main/kotlin/com/featurepulse/internal/FeaturePulseInitProvider.kt`:

```kotlin
package com.featurepulse.internal

import android.content.ContentProvider
import android.content.ContentValues
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import com.featurepulse.FeaturePulse
import com.featurepulse.PulseConfig

class FeaturePulseInitProvider : ContentProvider() {

    override fun onCreate(): Boolean {
        val ctx = context?.applicationContext ?: return false
        val application = ctx as? android.app.Application ?: return false

        val appInfo = try {
            ctx.packageManager.getApplicationInfo(ctx.packageName, PackageManager.GET_META_DATA)
        } catch (_: PackageManager.NameNotFoundException) {
            return false
        }

        val apiKey = appInfo.metaData?.getString("com.featurepulse.sdk.API_KEY")
        if (apiKey.isNullOrBlank()) return false

        val appId = appInfo.metaData?.getString("com.featurepulse.sdk.APP_ID") ?: ctx.packageName

        FeaturePulse.init(
            application,
            PulseConfig.Builder()
                .setApiKey(apiKey)
                .setAppId(appId)
                .build()
        )
        return true
    }

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
    override fun getType(uri: Uri): String? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
```

- [ ] **Step 2: Register the provider in the SDK's AndroidManifest.xml**

Replace the entire content of `sdk/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application>
        <!--
            ContentProvider that auto-initializes FeaturePulse before Application.onCreate().
            ${applicationId} is replaced with the consuming app's package name by manifest merger.
            initOrder=100 ensures FeaturePulse starts before other ContentProviders.
        -->
        <provider
            android:name="com.featurepulse.internal.FeaturePulseInitProvider"
            android:authorities="${applicationId}.featurepulse_init_provider"
            android:exported="false"
            android:initOrder="100" />
    </application>
</manifest>
```

- [ ] **Step 3: Verify the SDK compiles**

```bash
cd sdk && ./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL` with no errors.

- [ ] **Step 4: Smoke test in the demo app**

Open `demo-app/src/main/AndroidManifest.xml`. Inside the `<application>` tag, add:

```xml
<meta-data
    android:name="com.featurepulse.sdk.API_KEY"
    android:value="fp_your_actual_api_key" />

<meta-data
    android:name="com.featurepulse.sdk.APP_ID"
    android:value="your_actual_app_uuid" />
```

If the demo app already calls `FeaturePulse.init()` explicitly in an Application class, comment that call out temporarily for the test. Run the demo app. Events should still flow to the backend (confirming the ContentProvider auto-init works). Re-enable the explicit call afterward if desired — both approaches are safe together due to the `if (initialized) return` guard.

- [ ] **Step 5: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/FeaturePulseInitProvider.kt
git add sdk/src/main/AndroidManifest.xml
git commit -m "feat(sdk): ContentProvider auto-init — zero-code setup via AndroidManifest.xml"
```
