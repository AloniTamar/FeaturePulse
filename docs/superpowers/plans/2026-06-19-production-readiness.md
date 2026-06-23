# Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the FeaturePulse backend, infrastructure, and SDK for real-traffic production deployment beyond the university course.

---

## Live Deployment Status (as of 2026-06-20)

| Component | URL | Status |
|-----------|-----|--------|
| Server (Railway) | https://featurepulse-production-d81d.up.railway.app | ✅ Active |
| Portal (Vercel) | https://feature-pulse-theta.vercel.app | ✅ Live |
| Nightly Cron | GitHub Actions `.github/workflows/nightly-cron.yml` | ✅ Scheduled 02:00 UTC |

**Smoke-tested flows:** register, login, create app (API key visible), dashboard, features, analytics, settings, account delete/login.

**Infrastructure notes:**
- `server/railway.json` uses `startCommand: "node dist/index.js"` — migrations are **not** run automatically on deploy. Future schema changes must be applied manually via Railway shell: `npx prisma migrate deploy`.
- Nightly cron fires via GitHub Actions (`schedule: cron: '0 2 * * *'`) and POSTs `Authorization: Bearer ${{ secrets.CRON_SECRET }}` to `/api/v1/cron/nightly`. Add `CRON_SECRET` as a GitHub Actions secret to enable it.
- `SENTRY_DSN` is optional — Sentry init is guarded so the server starts cleanly without it.

**Pending items (non-blocking):**
- "Run Cron Now" portal button currently fails — needs a JWT-protected `/api/v1/cron/trigger` endpoint the portal calls with the user's JWT (instead of `CRON_SECRET`).
- Add `CRON_SECRET` as a GitHub Actions repo secret to activate the nightly schedule.

**Architecture:** Six independent tracks (A–F) ordered by priority. Each track is independently deployable — start with Track A before going live with real traffic. Tracks B, C, D, E, F can be executed in parallel by different engineers once Track A is done.

**Tech Stack:** Node.js 20 / Express / TypeScript / Prisma / PostgreSQL (server), React 18 / Vite / Tailwind (portal), Kotlin / Android (SDK), Railway (hosting), Vercel (portal hosting), GitHub Actions (CI), pino (structured logging), Sentry (error tracking), express-rate-limit (rate limiting)

## Global Constraints

- Node.js >= 20 (matches `FROM node:20-slim` in `server/Dockerfile`)
- TypeScript strict mode is on — do not disable it
- All server tests hit a real PostgreSQL database — no mocks; run with `cd server && npx jest --forceExit --runInBand`
- Test setup pattern: `beforeEach` deletes all rows in dependency order (see `server/tests/ingestion.test.ts:3-10`); follow this exactly
- Prisma schema changes need `npx prisma generate` and `npx prisma migrate dev --name <name>`
- API key format: `fp_<hex>` — must stay compatible with the Android SDK
- Never expose `OPENROUTER_API_KEY`, `JWT_SECRET`, or `CRON_SECRET` to the portal or SDK

---

## Track A: Security & Reliability (Do This First)

### Task A1: Rate Limiting per API Key

**Files:**
- Create: `server/src/middleware/rateLimit.ts`
- Modify: `server/src/routes/events.ts`
- Test: `server/tests/rateLimit.test.ts`

**Interfaces:**
- Produces: `apiKeyRateLimit` Express middleware — `(req, res, next) => void`, keyed on `X-API-Key` header

- [ ] **Step 1: Install express-rate-limit**

```bash
cd server && npm install express-rate-limit
```

Expected: `express-rate-limit` appears in `server/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `server/tests/rateLimit.test.ts`:

```typescript
import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'

beforeEach(async () => {
  await prisma.rawEvent.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

async function createRateLimitTestApp() {
  const user = await prisma.user.create({
    data: { email: 'ratelimit@test.com', passwordHash: 'x' },
  })
  return prisma.app.create({
    data: {
      name: 'RateTest', packageName: 'com.test.rate',
      apiKey: 'fp_ratelimit_unique_key', apiKeyHash: 'fp_ratelimit_unique_key',
      userId: user.id,
    },
  })
}

test('returns 429 after exceeding 100 requests per 15 minutes per API key', async () => {
  const testApp = await createRateLimitTestApp()
  let lastStatus = 200
  for (let i = 0; i <= 100; i++) {
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('X-API-Key', 'fp_ratelimit_unique_key')
      .send({
        appId: testApp.id,
        events: [{
          eventId: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
          featureId: 'f1', eventType: 'TAP', timestamp: Date.now(),
        }],
      })
    lastStatus = res.status
  }
  expect(lastStatus).toBe(429)
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd server && npx jest --forceExit --runInBand tests/rateLimit.test.ts
```

Expected: FAIL — last status is 200, not 429.

- [ ] **Step 4: Create the rate limit middleware**

Create `server/src/middleware/rateLimit.ts`:

```typescript
import rateLimit from 'express-rate-limit'

// 100 requests per 15-minute window, keyed on API key
export const apiKeyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  keyGenerator: (req) => (req.headers['x-api-key'] as string) ?? req.ip ?? 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
})
```

- [ ] **Step 5: Apply rate limit to both event routes**

In `server/src/routes/events.ts`, add the import at the top:

```typescript
import { apiKeyRateLimit } from '../middleware/rateLimit'
```

Change the `/batch` route signature from:
```typescript
eventsRouter.post('/batch', apiKeyAuth, async (req: AuthRequest, res) => {
```
To:
```typescript
eventsRouter.post('/batch', apiKeyRateLimit, apiKeyAuth, async (req: AuthRequest, res) => {
```

Change the `/discover` route signature from:
```typescript
eventsRouter.post('/discover', apiKeyAuth, async (req: AuthRequest, res) => {
```
To:
```typescript
eventsRouter.post('/discover', apiKeyRateLimit, apiKeyAuth, async (req: AuthRequest, res) => {
```

- [ ] **Step 6: Run the rate limit test**

```bash
cd server && npx jest --forceExit --runInBand tests/rateLimit.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run full suite to check for regressions**

```bash
cd server && npx jest --forceExit --runInBand
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add server/src/middleware/rateLimit.ts server/src/routes/events.ts server/tests/rateLimit.test.ts server/package.json server/package-lock.json
git commit -m "feat(security): add per-API-key rate limiting on event ingestion"
```

---

### Task A2: CORS Hardening

**Files:**
- Modify: `server/src/index.ts`
- Modify: `server/.env.example`

**Interfaces:**
- Produces: server exits with a fatal error at startup if `NODE_ENV=production` and `CORS_ORIGIN` is not set

- [ ] **Step 1: Replace the permissive CORS default in index.ts**

In `server/src/index.ts`, replace:
```typescript
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
```
With:
```typescript
const corsOrigin = process.env.CORS_ORIGIN
if (!corsOrigin && process.env.NODE_ENV === 'production') {
  console.error('FATAL: CORS_ORIGIN must be set in production')
  process.exit(1)
}
app.use(cors({ origin: corsOrigin ?? '*' }))
```

- [ ] **Step 2: Update .env.example with a production note**

In `server/.env.example`, change the CORS line to:
```
# Required in production — set to your portal domain e.g. https://your-portal.vercel.app
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 3: Run full suite to verify tests still pass**

```bash
cd server && npx jest --forceExit --runInBand
```

Expected: all pass (NODE_ENV is `test` in Jest, so the guard never fires).

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts server/.env.example
git commit -m "fix(security): fail fast if CORS_ORIGIN is unset in production"
```

---

### Task A3: Replace In-Process Cron with External Trigger ✅ DONE

`node-cron` removed. `/api/v1/cron/nightly` is live, secured by `CRON_SECRET`. GitHub Actions workflow fires it at 02:00 UTC. See [Live Deployment Status](#live-deployment-status-as-of-2026-06-20) above.

**Files:**
- Modify: `server/src/cron/nightly.ts`
- Modify: `server/src/index.ts`
- Modify: `server/.env.example`
- Test: `server/tests/cron.test.ts`

**Interfaces:**
- Produces: `POST /api/v1/cron/nightly` secured by `Authorization: Bearer <CRON_SECRET>`

- [x] **Step 1: Write the failing test**

Create `server/tests/cron.test.ts`:

```typescript
import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'

afterAll(async () => { await prisma.$disconnect() })

beforeEach(() => {
  process.env.CRON_SECRET = 'test_cron_secret_12345'
})

test('POST /api/v1/cron/nightly rejects missing auth with 401', async () => {
  const res = await request(app).post('/api/v1/cron/nightly')
  expect(res.status).toBe(401)
})

test('POST /api/v1/cron/nightly rejects wrong secret with 401', async () => {
  const res = await request(app)
    .post('/api/v1/cron/nightly')
    .set('Authorization', 'Bearer wrong_secret')
  expect(res.status).toBe(401)
})

test('POST /api/v1/cron/nightly accepts correct CRON_SECRET', async () => {
  const res = await request(app)
    .post('/api/v1/cron/nightly')
    .set('Authorization', 'Bearer test_cron_secret_12345')
  expect(res.status).toBe(200)
  expect(res.body.ok).toBe(true)
})
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd server && npx jest --forceExit --runInBand tests/cron.test.ts
```

Expected: FAIL — the existing `/api/v1/cron` endpoint uses JWT auth, not CRON_SECRET, and is at the wrong path.

- [x] **Step 3: Remove node-cron from nightly.ts**

Replace the entire content of `server/src/cron/nightly.ts` with:

```typescript
// Aggregation is triggered externally via POST /api/v1/cron/nightly.
// Configure Railway cron (or GitHub Actions schedule) to call that endpoint with Bearer <CRON_SECRET>.
export function startCronJobs(): void {
  console.log('[Cron] Running in external-trigger mode — schedule POST /api/v1/cron/nightly')
}
```

- [x] **Step 4: Update the cron route in index.ts**

In `server/src/index.ts`, replace:
```typescript
app.post('/api/v1/cron', jwtAuth, async (_req, res) => {
  try {
    await runNightlyAggregation()
    res.json({ ok: true, message: 'Aggregation complete' })
  } catch (err) {
    res.status(500).json({ error: 'Cron job failed' })
  }
})
```
With:
```typescript
app.post('/api/v1/cron/nightly', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    await runNightlyAggregation()
    res.json({ ok: true, message: 'Aggregation complete' })
  } catch {
    res.status(500).json({ error: 'Cron job failed' })
  }
})
```

- [x] **Step 5: Uninstall node-cron**

```bash
cd server && npm uninstall node-cron
```

- [x] **Step 6: Update .env.example**

- [x] **Step 7: Run cron tests**

- [x] **Step 8: Run full suite**

- [x] **Step 9: Commit**

---

### Task A4: API Key Rotation Endpoint

**Files:**
- Modify: `server/src/routes/apps.ts`
- Test: `server/tests/apps.test.ts`

**Interfaces:**
- Consumes: `requireOwnership(req, res, appId)` at `server/src/routes/apps.ts:10-14`
- Produces: `POST /apps/:appId/rotate-key` → `200 { apiKey: string }` with a new `fp_<hex>` key; old key immediately invalidated

- [ ] **Step 1: Write the failing tests**

Open `server/tests/apps.test.ts` and add at the end of the file:

```typescript
describe('POST /apps/:appId/rotate-key', () => {
  async function setupUserAndApp(email: string) {
    await request(app).post('/api/v1/auth/register').send({ email, password: 'Password1!' })
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password1!' })
    const token = loginRes.body.token
    const createRes = await request(app)
      .post('/api/v1/apps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'TestApp', packageName: `com.${email.split('@')[0]}.test` })
    return { token, appId: createRes.body.id, originalKey: createRes.body.apiKey }
  }

  test('returns a new fp_-prefixed API key different from the original', async () => {
    const { token, appId, originalKey } = await setupUserAndApp('rotate1@test.com')
    const res = await request(app)
      .post(`/api/v1/apps/${appId}/rotate-key`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.apiKey).toMatch(/^fp_/)
    expect(res.body.apiKey).not.toBe(originalKey)
  })

  test('old key returns 401 after rotation', async () => {
    const { token, appId, originalKey } = await setupUserAndApp('rotate2@test.com')
    await request(app).post(`/api/v1/apps/${appId}/rotate-key`).set('Authorization', `Bearer ${token}`)
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('X-API-Key', originalKey)
      .send({ appId, events: [] })
    expect(res.status).toBe(401)
  })

  test('non-owner gets 403', async () => {
    const { appId } = await setupUserAndApp('rotate3@test.com')
    await request(app).post('/api/v1/auth/register').send({ email: 'attacker@test.com', password: 'Password1!' })
    const attackerLogin = await request(app).post('/api/v1/auth/login').send({ email: 'attacker@test.com', password: 'Password1!' })
    const res = await request(app)
      .post(`/api/v1/apps/${appId}/rotate-key`)
      .set('Authorization', `Bearer ${attackerLogin.body.token}`)
    expect(res.status).toBe(403)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx jest --forceExit --runInBand tests/apps.test.ts -t "rotate-key"
```

Expected: FAIL — 404 (route doesn't exist yet).

- [ ] **Step 3: Add the rotate-key route to apps.ts**

At the end of `server/src/routes/apps.ts`, add:

```typescript
// POST /api/v1/apps/:appId/rotate-key — invalidate current API key and issue a new one
appsRouter.post('/:appId/rotate-key', jwtAuth, async (req: AuthRequest, res) => {
  try {
    const owned = await requireOwnership(req, res, req.params.appId)
    if (!owned) return
    const newKey = 'fp_' + crypto.randomBytes(24).toString('hex')
    const updated = await prisma.app.update({
      where: { id: req.params.appId },
      data: { apiKey: newKey, apiKeyHash: newKey },
    })
    res.json({ apiKey: updated.apiKey })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

- [ ] **Step 4: Run rotate-key tests**

```bash
cd server && npx jest --forceExit --runInBand tests/apps.test.ts -t "rotate-key"
```

Expected: all 3 pass.

- [ ] **Step 5: Run full suite**

```bash
cd server && npx jest --forceExit --runInBand
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/apps.ts server/tests/apps.test.ts
git commit -m "feat(security): add API key rotation endpoint"
```

---

### Task A5: Batch Upsert on /discover

The `/discover` handler writes features one-by-one in a sequential loop. 200 features = 200 DB round-trips. Replace with a single `createMany`.

**Files:**
- Modify: `server/src/services/ingestion.ts`
- Modify: `server/src/routes/events.ts`
- Test: `server/tests/ingestion.test.ts`

**Interfaces:**
- Produces: `upsertFeatures(appId: string, features: FeatureInput[]) => Promise<{ registered: number }>` — exported from `ingestion.ts`
- `FeatureInput`: `{ featureId: string; elementType: string; resourceName: string | null; screenName: string; hierarchyPath: string | null }`

- [ ] **Step 1: Write the failing test**

In `server/tests/ingestion.test.ts`, add the import at the top:
```typescript
import { ingestBatch, upsertFeatures, BatchPayload } from '../src/services/ingestion'
```

Then add this test:

```typescript
test('upsertFeatures registers multiple features and deduplicates', async () => {
  const app = await createTestApp()
  const result = await upsertFeatures(app.id, [
    { featureId: 'batch_f1', elementType: 'Button', resourceName: 'btn_ok', screenName: 'Main', hierarchyPath: null },
    { featureId: 'batch_f2', elementType: 'TextView', resourceName: null, screenName: 'Main', hierarchyPath: '/root/text' },
    { featureId: 'batch_f1', elementType: 'Button', resourceName: 'btn_ok', screenName: 'Main', hierarchyPath: null },
  ])
  expect(result.registered).toBe(2)
  const count = await prisma.feature.count({ where: { appId: app.id } })
  expect(count).toBe(2)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx jest --forceExit --runInBand tests/ingestion.test.ts -t "upsertFeatures"
```

Expected: FAIL — `upsertFeatures` is not exported.

- [ ] **Step 3: Add upsertFeatures to ingestion.ts**

In `server/src/services/ingestion.ts`, add after the `upsertFeature` function:

```typescript
export interface FeatureInput {
  featureId: string
  elementType: string
  resourceName: string | null
  screenName: string
  hierarchyPath: string | null
}

export async function upsertFeatures(appId: string, features: FeatureInput[]): Promise<{ registered: number }> {
  const unique = [...new Map(features.map(f => [f.featureId, f])).values()]
  const result = await prisma.feature.createMany({
    data: unique.map(f => ({
      id: f.featureId,
      appId,
      elementType: f.elementType,
      resourceName: f.resourceName,
      screenName: f.screenName,
      hierarchyPath: f.hierarchyPath,
      state: 'THRIVING',
    })),
    skipDuplicates: true,
  })
  return { registered: result.count }
}
```

- [ ] **Step 4: Update /discover in events.ts to use upsertFeatures**

In `server/src/routes/events.ts`, change the import to:
```typescript
import { ingestBatch, upsertFeatures, BatchPayloadSchema } from '../services/ingestion'
```

Replace the entire `/discover` handler:

```typescript
eventsRouter.post('/discover', apiKeyRateLimit, apiKeyAuth, async (req: AuthRequest, res) => {
  const result = DiscoverSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })
  try {
    const { registered } = await upsertFeatures(req.appId!, result.data.features)
    res.json({ registered, errors: [] })
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})
```

Note: `DiscoverSchema` parses to `features[]` with fields that match `FeatureInput` exactly — `featureId`, `elementType`, `resourceName`, `screenName`, `hierarchyPath` — so no mapping is needed.

- [ ] **Step 5: Run ingestion tests**

```bash
cd server && npx jest --forceExit --runInBand tests/ingestion.test.ts
```

Expected: all pass.

- [ ] **Step 6: Run full suite**

```bash
cd server && npx jest --forceExit --runInBand
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/ingestion.ts server/src/routes/events.ts server/tests/ingestion.test.ts
git commit -m "perf: replace sequential /discover loop with batch upsert"
```

---

## Track B: Observability

### Task B1: Structured Logging with pino ✅ DONE

`pino`, `pino-http`, and `pino-pretty` installed. `server/src/lib/logger.ts` created. Request logging middleware active in index.ts (skipped in test mode). All routes use `logger` instead of `console`.

**Files:**
- Create: `server/src/lib/logger.ts`
- Modify: `server/src/index.ts`
- Modify: `server/src/cron/nightly.ts`

**Interfaces:**
- Produces: `logger` — a `pino.Logger` instance. Import with `import { logger } from '../lib/logger'` (adjust relative path per file location)

- [x] **Step 1: Install pino and pino-http**

```bash
cd server && npm install pino pino-http pino-pretty
```

Expected: three packages added to `package.json` dependencies.

- [x] **Step 2: Create logger.ts**

Create `server/src/lib/logger.ts`:

```typescript
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
})
```

- [x] **Step 3: Add request logging middleware to index.ts**

In `server/src/index.ts`, add imports:
```typescript
import pinoHttp from 'pino-http'
import { logger } from './lib/logger'
```

After `app.use(express.json(...))`, add:
```typescript
if (process.env.NODE_ENV !== 'test') {
  app.use(pinoHttp({ logger }))
}
```

- [x] **Step 4: Replace console.log in nightly.ts with logger**

In `server/src/cron/nightly.ts`, replace the file content with:

```typescript
import { logger } from '../lib/logger'

export function startCronJobs(): void {
  logger.info('Running in external-trigger mode — schedule POST /api/v1/cron/nightly')
}
```

- [x] **Step 5: Run full suite to verify no regressions**

- [x] **Step 6: Commit**

---

### Task B2: Sentry Error Tracking ✅ DONE

`@sentry/node` installed. Sentry init guarded by `if (process.env.SENTRY_DSN)` — server starts cleanly without it. `setupExpressErrorHandler` also guarded. Add `SENTRY_DSN` to Railway Variables to enable.

**Files:**
- Modify: `server/src/index.ts`
- Modify: `server/.env.example`

**Interfaces:**
- Consumes: `SENTRY_DSN` env var (optional — Sentry does not init if unset)
- Produces: unhandled exceptions and Express errors captured and sent to Sentry

- [ ] **Step 1: Create a Sentry project**

Go to sentry.io → New Project → Node.js. Copy the DSN (`https://<key>@<org>.ingest.sentry.io/<id>`).

- [x] **Step 2: Install Sentry**

```bash
cd server && npm install @sentry/node
```

- [x] **Step 3: Initialize Sentry at the top of index.ts**

At the very top of `server/src/index.ts`, before any other imports, add:

```typescript
import * as Sentry from '@sentry/node'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  })
}
```

After all routes are registered (at the bottom, before `app.listen`), add the Sentry error handler — it must be the last middleware:

```typescript
Sentry.setupExpressErrorHandler(app)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error')
  res.status(500).json({ error: 'Internal server error' })
})
```

- [x] **Step 4: Add SENTRY_DSN to .env.example**

- [x] **Step 5: Run full suite to verify no regressions**

- [x] **Step 6: Commit**

---

### Task B3: AI Insights Graceful Degradation + Per-App API Key

The current insights service crashes the cron if OpenRouter is down and exposes a 503 to the portal. This task makes failures silent on the server side and friendly on the portal side. It also lets app owners supply their own OpenRouter key to unlock better models.

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/services/insights.ts`
- Modify: `server/src/routes/insights.ts`
- Modify: `server/src/routes/apps.ts`
- Modify: `portal/src/pages/Analytics.tsx` (wherever AI insights are rendered)
- Modify: `portal/src/pages/Settings.tsx`
- Test: `server/tests/insights.test.ts`

**Interfaces:**
- `generateAndSaveInsights(appId)` now returns `Promise<{ summary, bullets, generatedAt } | null>` — `null` means the AI call failed silently
- `GET /apps/:appId/insights` returns `{ unavailable: true, reason: string }` (200, not 503/404) when insights can't be generated, so the portal can show a friendly message
- `PATCH /apps/:appId` now accepts `{ openRouterApiKey: string | null }` — `null` clears it
- `GET /apps` includes `hasCustomApiKey: boolean` — never exposes the raw key to the portal

- [ ] **Step 1: Add openRouterApiKey to App schema**

In `server/prisma/schema.prisma`, inside `model App`, after `aiInsightsMode`, add:

```prisma
openRouterApiKey    String?
```

Run the migration:

```bash
cd server && npx prisma migrate dev --name add_app_openrouter_key
```

Expected: migration created, Prisma client regenerated.

- [ ] **Step 2: Write the failing tests**

Create `server/tests/insights.test.ts`:

```typescript
import { generateAndSaveInsights } from '../src/services/insights'
import { prisma } from '../src/db/client'

beforeEach(async () => {
  await prisma.appInsight.deleteMany()
  await prisma.appDailyStats.deleteMany()
  await prisma.weeklyAggregate.deleteMany()
  await prisma.stateTransition.deleteMany()
  await prisma.dailyAggregate.deleteMany()
  await prisma.rawEvent.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

async function createInsightTestApp(overrides: Record<string, unknown> = {}) {
  const user = await prisma.user.create({ data: { email: 'insights@test.com', passwordHash: 'x' } })
  return prisma.app.create({
    data: {
      name: 'InsightApp', packageName: 'com.insight.test',
      apiKey: 'fp_insight_key', apiKeyHash: 'fp_insight_key',
      userId: user.id, aiInsightsEnabled: true,
      ...overrides,
    },
  })
}

test('returns null when no OpenRouter API key is configured', async () => {
  const savedKey = process.env.OPENROUTER_API_KEY
  delete process.env.OPENROUTER_API_KEY
  const app = await createInsightTestApp()
  const result = await generateAndSaveInsights(app.id)
  expect(result).toBeNull()
  process.env.OPENROUTER_API_KEY = savedKey
})

test('returns null and does not throw when OpenRouter call fails', async () => {
  // Set an invalid key so the API call fails
  process.env.OPENROUTER_API_KEY = 'sk_invalid_key_that_will_fail'
  const app = await createInsightTestApp()
  const result = await generateAndSaveInsights(app.id)
  // Must not throw — must return null
  expect(result).toBeNull()
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd server && npx jest --forceExit --runInBand tests/insights.test.ts
```

Expected: FAIL — current `generateAndSaveInsights` throws on API failure instead of returning null.

- [ ] **Step 4: Rewrite insights.ts service**

Replace the entire content of `server/src/services/insights.ts`:

```typescript
import OpenAI from 'openai'
import { prisma } from '../db/client'
import { logger } from '../lib/logger'

export type InsightResult = {
  summary: string
  bullets: string[]
  generatedAt: string
} | null

export async function generateAndSaveInsights(appId: string): Promise<InsightResult> {
  const [app, stateCounts, dauRow, topDead, topDeclining] = await Promise.all([
    prisma.app.findUnique({
      where: { id: appId },
      select: { name: true, openRouterApiKey: true },
    }),
    prisma.feature.groupBy({ by: ['state'], where: { appId }, _count: true }),
    prisma.appDailyStats.findFirst({ where: { appId }, orderBy: { date: 'desc' } }),
    prisma.feature.findMany({
      where: { appId, state: 'DEAD', isIgnored: false },
      orderBy: { lastInteraction: 'asc' },
      take: 3,
      select: { resourceName: true, screenName: true, lastInteraction: true },
    }),
    prisma.feature.findMany({
      where: { appId, state: 'DECLINING' },
      take: 3,
      select: { resourceName: true, screenName: true },
    }),
  ])

  const apiKey = app?.openRouterApiKey ?? process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    logger.warn({ appId }, 'No OpenRouter API key available — skipping AI insights')
    return null
  }

  const openai = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' })

  const counts: Record<string, number> = {}
  for (const g of stateCounts) counts[g.state] = g._count

  const dataContext = [
    `App: ${app?.name ?? appId}`,
    `Feature counts: ${JSON.stringify(counts)}`,
    `Daily active users (latest): ${dauRow?.dailyActiveUsers ?? 'no data'}`,
    `Dead features: ${topDead.map(f => `${f.resourceName ?? f.screenName} (last used: ${f.lastInteraction?.toISOString().slice(0, 10) ?? 'never'})`).join(', ') || 'none'}`,
    `Declining features: ${topDeclining.map(f => f.resourceName ?? f.screenName).join(', ') || 'none'}`,
  ].join('\n')

  try {
    const response = await openai.chat.completions.create({
      model: 'google/gemma-4-31b-it:free',
      max_tokens: 512,
      messages: [
        {
          role: 'system',
          content: `You are a mobile app analytics assistant. Given feature usage data, respond ONLY with valid JSON matching this shape exactly:
{"summary":"2-3 sentence health overview","bullets":["actionable item 1","actionable item 2","actionable item 3"]}
Use specific feature names from the data. No markdown, no extra text.`,
        },
        { role: 'user', content: dataContext },
      ],
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? '{}'
    const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { summary?: string; bullets?: string[] }

    const summary = json.summary ?? 'Unable to generate summary.'
    const bullets = Array.isArray(json.bullets)
      ? (json.bullets as unknown[]).filter((b): b is string => typeof b === 'string')
      : []

    await prisma.appInsight.upsert({
      where: { appId },
      update: { summary, bullets, generatedAt: new Date() },
      create: { appId, summary, bullets },
    })

    return { summary, bullets, generatedAt: new Date().toISOString() }
  } catch (err) {
    logger.warn({ appId, err }, 'AI insights generation failed — skipping, existing insight preserved')
    return null
  }
}
```

- [ ] **Step 5: Update insights route to return friendly unavailable response**

Replace the entire content of `server/src/routes/insights.ts`:

```typescript
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth, type AuthRequest } from '../middleware/auth'
import { generateAndSaveInsights } from '../services/insights'

export const insightsRouter = Router()

insightsRouter.get('/apps/:appId/insights', jwtAuth, async (req: AuthRequest, res) => {
  const { appId } = req.params
  try {
    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app) return res.status(404).json({ error: 'App not found' })
    if (app.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' })
    if (!app.aiInsightsEnabled) return res.status(404).json({ error: 'AI insights not enabled' })

    if (app.aiInsightsMode === 'on_demand') {
      const result = await generateAndSaveInsights(appId)
      if (!result) {
        return res.json({ unavailable: true, reason: 'AI model temporarily unreachable. Please try again later.' })
      }
      return res.json(result)
    }

    // nightly mode: return stored insight
    const stored = await prisma.appInsight.findUnique({ where: { appId } })
    if (!stored) {
      return res.json({ unavailable: true, reason: 'No insights generated yet — check back after 02:00 UTC.' })
    }
    res.json({
      summary: stored.summary,
      bullets: stored.bullets as string[],
      generatedAt: stored.generatedAt.toISOString(),
    })
  } catch (e) {
    res.status(503).json({ error: 'Service unavailable' })
  }
})
```

- [ ] **Step 6: Add openRouterApiKey to PATCH /apps/:appId and GET /apps**

In `server/src/routes/apps.ts`, find the `PATCH /apps/:appId` handler (look for `UpdateAppSchema`). Add `openRouterApiKey: z.string().nullable().optional()` to its Zod schema and `openRouterApiKey: ...` to its `data` object.

In the `GET /apps` response map, add:
```typescript
hasCustomApiKey: a.openRouterApiKey !== null,
```

Do NOT include the raw `openRouterApiKey` value in any response — only the boolean.

- [ ] **Step 7: Add OpenRouter key field in portal Settings**

In `portal/src/pages/Settings.tsx`, find where PATCH /apps/:appId is called and add an "AI Insights API Key" section:

```tsx
{/* OpenRouter API Key — only show when AI insights is enabled */}
{app.aiInsightsEnabled && (
  <div className="mt-6">
    <label className="block text-sm font-medium text-gray-700">
      OpenRouter API Key
      <span className="ml-1 text-xs text-gray-400">(optional — improves AI insights quality)</span>
    </label>
    <div className="mt-1 flex gap-2">
      <input
        type="password"
        placeholder={app.hasCustomApiKey ? '••••••••••••••••' : 'sk-or-... (uses shared free tier if empty)'}
        value={customApiKey}
        onChange={e => setCustomApiKey(e.target.value)}
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {app.hasCustomApiKey && (
        <button
          onClick={() => handleClearApiKey()}
          className="text-xs text-red-500 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
    <p className="mt-1 text-xs text-gray-500">
      Get a free key at openrouter.ai. Using your own key enables premium models.
    </p>
  </div>
)}
```

Add `customApiKey` state (`useState('')`) and wire `handleClearApiKey` to call `PATCH /apps/:appId` with `{ openRouterApiKey: null }`.

- [ ] **Step 8: Show unavailable message in portal Analytics**

In `portal/src/pages/Analytics.tsx`, find where the AI insights response is rendered. Add a check for `unavailable: true`:

```tsx
{insight?.unavailable ? (
  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
    <strong>AI Insights Unavailable</strong>
    <p className="mt-1">{insight.reason}</p>
    <p className="mt-1 text-xs">Raw analytics data above is unaffected.</p>
  </div>
) : insight ? (
  // existing insight render
) : null}
```

- [ ] **Step 9: Run insights tests**

```bash
cd server && npx jest --forceExit --runInBand tests/insights.test.ts
```

Expected: both tests pass.

- [ ] **Step 10: Run full suite**

```bash
cd server && npx jest --forceExit --runInBand
```

Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/ \
        server/src/services/insights.ts server/src/routes/insights.ts \
        server/src/routes/apps.ts server/tests/insights.test.ts \
        portal/src/pages/Analytics.tsx portal/src/pages/Settings.tsx
git commit -m "feat(insights): graceful degradation + per-app OpenRouter key"
```

---

## Track C: Per-Tenant Event Quotas

### Task C1: Add Quota Fields to App Schema

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `App.monthlyEventQuota Int @default(0)` (0 = unlimited), `App.currentMonthEvents Int @default(0)`, `App.quotaResetMonth String @default("")` (stores `"YYYY-MM"`)

- [ ] **Step 1: Add three fields to the App model in schema.prisma**

In `server/prisma/schema.prisma`, inside the `model App` block, after the `aiInsightsMode` line, add:

```prisma
monthlyEventQuota   Int    @default(0)
currentMonthEvents  Int    @default(0)
quotaResetMonth     String @default("")
```

- [ ] **Step 2: Generate migration and regenerate client**

```bash
cd server && npx prisma migrate dev --name add_monthly_event_quota
```

Expected: creates `server/prisma/migrations/..._add_monthly_event_quota/migration.sql` and outputs "Your database is now in sync."

- [ ] **Step 3: Run full suite to verify no regressions**

```bash
cd server && npx jest --forceExit --runInBand
```

Expected: all pass (new fields have defaults, existing test data is unaffected).

- [ ] **Step 4: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(quotas): add monthly event quota fields to App"
```

---

### Task C2: Enforce Quota in Ingestion

**Files:**
- Modify: `server/src/services/ingestion.ts`
- Test: `server/tests/ingestion.test.ts`

**Interfaces:**
- Consumes: `App.monthlyEventQuota`, `App.currentMonthEvents`, `App.quotaResetMonth` (from Task C1)
- Produces: `IngestResult` gains `quotaExceeded: boolean`; `ingestBatch` rejects all events when quota is reached

- [ ] **Step 1: Write the failing tests**

In `server/tests/ingestion.test.ts`, add:

```typescript
test('rejects all events when monthly quota is already at limit', async () => {
  const user = await prisma.user.create({ data: { email: 'quota1@test.com', passwordHash: 'x' } })
  const limitedApp = await prisma.app.create({
    data: {
      name: 'LimitedApp', packageName: 'com.limited', apiKey: 'fp_limited_key',
      apiKeyHash: 'fp_limited_key', userId: user.id,
      monthlyEventQuota: 5,
      currentMonthEvents: 5,
      quotaResetMonth: new Date().toISOString().slice(0, 7),
    },
  })
  const result = await ingestBatch(limitedApp.id, validPayload(limitedApp.id))
  expect(result.accepted).toBe(0)
  expect(result.quotaExceeded).toBe(true)
})

test('resets counter and accepts events when quotaResetMonth is an old month', async () => {
  const user = await prisma.user.create({ data: { email: 'quota2@test.com', passwordHash: 'x' } })
  const oldMonthApp = await prisma.app.create({
    data: {
      name: 'OldMonthApp', packageName: 'com.oldmonth', apiKey: 'fp_oldmonth_key',
      apiKeyHash: 'fp_oldmonth_key', userId: user.id,
      monthlyEventQuota: 5,
      currentMonthEvents: 5,
      quotaResetMonth: '2020-01',
    },
  })
  const result = await ingestBatch(oldMonthApp.id, validPayload(oldMonthApp.id))
  expect(result.accepted).toBe(2)
  expect(result.quotaExceeded).toBe(false)
})

test('unlimited quota (0) always accepts events', async () => {
  const app = await createTestApp()
  const result = await ingestBatch(app.id, validPayload(app.id))
  expect(result.quotaExceeded).toBe(false)
  expect(result.accepted).toBe(2)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx jest --forceExit --runInBand tests/ingestion.test.ts -t "quota"
```

Expected: FAIL — `quotaExceeded` is `undefined`.

- [ ] **Step 3: Update IngestResult interface**

In `server/src/services/ingestion.ts`, change:
```typescript
export interface IngestResult {
  accepted: number
  rejected: number
  errors: string[]
}
```
To:
```typescript
export interface IngestResult {
  accepted: number
  rejected: number
  errors: string[]
  quotaExceeded: boolean
}
```

- [ ] **Step 4: Add quota check at the start of ingestBatch**

Replace the beginning of `ingestBatch` (from `export async function ingestBatch` through `let accepted = 0`) with:

```typescript
export async function ingestBatch(appId: string, payload: BatchPayload): Promise<IngestResult> {
  const currentMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

  const appRecord = await prisma.app.findUnique({
    where: { id: appId },
    select: { monthlyEventQuota: true, currentMonthEvents: true, quotaResetMonth: true },
  })
  if (!appRecord) {
    return { accepted: 0, rejected: payload.events.length, errors: ['App not found'], quotaExceeded: false }
  }

  let currentCount = appRecord.currentMonthEvents
  if (appRecord.quotaResetMonth !== currentMonth) {
    await prisma.app.update({ where: { id: appId }, data: { currentMonthEvents: 0, quotaResetMonth: currentMonth } })
    currentCount = 0
  }

  if (appRecord.monthlyEventQuota > 0 && currentCount >= appRecord.monthlyEventQuota) {
    return { accepted: 0, rejected: payload.events.length, errors: ['Monthly event quota exceeded'], quotaExceeded: true }
  }

  const errors: string[] = []
  let accepted = 0
```

- [ ] **Step 5: Increment counter and update return statement**

At the end of `ingestBatch`, just before `return`, replace:
```typescript
  return { accepted, rejected: errors.length, errors }
```
With:
```typescript
  if (accepted > 0) {
    await prisma.app.update({ where: { id: appId }, data: { currentMonthEvents: { increment: accepted } } })
  }
  return { accepted, rejected: errors.length, errors, quotaExceeded: false }
```

- [ ] **Step 6: Run ingestion tests**

```bash
cd server && npx jest --forceExit --runInBand tests/ingestion.test.ts
```

Expected: all pass.

- [ ] **Step 7: Run full suite**

```bash
cd server && npx jest --forceExit --runInBand
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add server/src/services/ingestion.ts server/tests/ingestion.test.ts
git commit -m "feat(quotas): enforce monthly event quota on batch ingestion"
```

---

### Task C3: Show Usage in Portal Settings

**Files:**
- Modify: `server/src/routes/apps.ts`
- Modify: `portal/src/pages/Settings.tsx`

**Interfaces:**
- Consumes: `monthlyEventQuota` and `currentMonthEvents` added to `App` in Task C1
- Produces: `GET /apps` response includes `monthlyEventQuota` and `currentMonthEvents`; Settings page shows usage bar when quota > 0

- [ ] **Step 1: Add quota fields to the GET /apps response**

In `server/src/routes/apps.ts`, inside the `res.json(apps.map(...))` call, add after `aiInsightsMode`:

```typescript
monthlyEventQuota:  a.monthlyEventQuota,
currentMonthEvents: a.currentMonthEvents,
```

- [ ] **Step 2: Add usage bar to Settings.tsx**

Open `portal/src/pages/Settings.tsx`. Find where app settings fields are displayed (look for `deadThresholdDays` or `dormantThresholdDays` usage). After the last settings section, add:

```tsx
{app.monthlyEventQuota > 0 && (
  <div className="mt-6">
    <p className="text-sm font-medium text-gray-700">Monthly Event Usage</p>
    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all ${
          app.currentMonthEvents / app.monthlyEventQuota > 0.9 ? 'bg-red-500' : 'bg-indigo-500'
        }`}
        style={{ width: `${Math.min(100, (app.currentMonthEvents / app.monthlyEventQuota) * 100)}%` }}
      />
    </div>
    <p className="mt-1 text-xs text-gray-500">
      {app.currentMonthEvents.toLocaleString()} / {app.monthlyEventQuota.toLocaleString()} events this month
    </p>
  </div>
)}
```

The `app` type in Settings.tsx should already match — if it doesn't yet have `monthlyEventQuota` and `currentMonthEvents`, add them to the type or interface used for app data in that file.

- [ ] **Step 3: Verify manually**

```bash
cd server && npm run dev &
cd portal && npm run dev
```

Navigate to an app's Settings page. With `monthlyEventQuota = 0` (the default for all existing apps), the bar is hidden — correct. To test the bar: update a record directly via `npx prisma studio`, set `monthlyEventQuota=1000` and `currentMonthEvents=750`, reload Settings.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/apps.ts portal/src/pages/Settings.tsx
git commit -m "feat(quotas): expose monthly usage in API and portal settings"
```

---

## Track D: CI/CD & Infrastructure

### Task D1: GitHub Actions CI ✅ DONE

`.github/workflows/ci.yml` live — runs server tests (against real PostgreSQL) and portal type-check + build on every push/PR to `main`. Commit: b2ef1b9.

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: CI pipeline that runs server tests + portal type-check + portal build on every push/PR to `main`

- [x] **Step 1: Create the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  server-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: featurepulse_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: server/package-lock.json

      - name: Install dependencies
        run: cd server && npm ci

      - name: Generate Prisma client
        run: cd server && npx prisma generate

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/featurepulse_test
        run: cd server && npx prisma migrate deploy

      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/featurepulse_test
          JWT_SECRET: ci_jwt_secret_32_chars_minimum_ok
          NODE_ENV: test
          CRON_SECRET: ci_cron_secret_for_testing_only
        run: cd server && npx jest --forceExit --runInBand

  portal-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: portal/package-lock.json

      - name: Install dependencies
        run: cd portal && npm ci

      - name: Type check
        run: cd portal && npx tsc --noEmit

      - name: Build
        env:
          VITE_API_URL: https://placeholder.example.com
        run: cd portal && npm run build
```

- [x] **Step 2: Commit and push**

- [x] **Step 3: Verify in GitHub**

---

### Task D2: Staging Environment

This task is infrastructure configuration — no code changes.

- [ ] **Step 1: Create a staging Railway project**

In Railway dashboard: New Project → Deploy from GitHub → select this repo. Name it `featurepulse-staging`.

- [ ] **Step 2: Add PostgreSQL to staging**

Inside the staging project: New → Database → PostgreSQL. Railway auto-links `DATABASE_URL` to the server service.

- [ ] **Step 3: Set staging environment variables**

In the Railway staging server service environment settings, set all variables from `server/.env.example` with staging-specific values:

```
NODE_ENV=production
JWT_SECRET=<generate: openssl rand -hex 32>
CRON_SECRET=<generate: openssl rand -hex 32>
CORS_ORIGIN=https://featurepulse-portal-staging.vercel.app
SENTRY_DSN=<same or separate Sentry project>
OPENROUTER_API_KEY=<same key or omit if AI insights not needed in staging>
```

- [ ] **Step 4: Deploy portal to Vercel staging**

In Vercel: New Project → import repo → set `VITE_API_URL` to the Railway staging server URL. Name it `featurepulse-portal-staging`.

- [ ] **Step 5: Smoke test staging end-to-end**

Register a user, create an app, send a test batch:

```bash
curl -X POST https://<staging-server-url>/api/v1/events/batch \
  -H "X-API-Key: fp_<your-test-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "<app-id>",
    "events": [{
      "eventId": "00000000-0000-0000-0000-000000000001",
      "featureId": "f1",
      "eventType": "TAP",
      "timestamp": '"$(date +%s)"'000
    }]
  }'
```

Expected response: `{"accepted":1,"rejected":0,"errors":[],"quotaExceeded":false}`

---

## Track E: SDK Distribution (JitPack)

> **Decision:** Using JitPack instead of Maven Central — simpler setup, no Sonatype registration or GPG keys required, and recommended by the course instructor.

### Task E1: Gradle Publishing + ProGuard Rules + Release CI ✅ DONE

**Files updated:**
- `sdk/build.gradle.kts` — `maven-publish` plugin, `com.github.TamarAloni` groupId, no signing
- `sdk/consumer-rules.pro` — ProGuard rules for SDK consumers
- `.github/workflows/release-sdk.yml` — lightweight tag workflow (JitPack builds automatically)

**How to publish a release:**

- [x] **Step 1: Push a tag** — JitPack builds automatically on any GitHub tag

```bash
git tag sdk-v1.0.0
git push origin sdk-v1.0.0
```

- [ ] **Step 2: Trigger the first build on JitPack**

Go to **https://jitpack.io/#TamarAloni/FeaturePulse** and click **"Get it"** next to `sdk-v1.0.0`. JitPack will build the SDK (takes ~2 minutes).

- [ ] **Step 3: Verify the build passes** on the JitPack page (green checkmark).

**SDK consumers add this to their project:**

```kotlin
// settings.gradle.kts
dependencyResolutionManagement {
    repositories {
        maven { url = uri("https://jitpack.io") }
    }
}

// app/build.gradle.kts
dependencies {
    implementation("com.github.TamarAloni:FeaturePulse:sdk-v1.0.0")
}
```

---

## Track F: Legal & Privacy (Mostly Non-Code)

### Task F1: Privacy Policy ✅ DONE

`docs/PRIVACY_POLICY.md` created. Portal `/privacy` route and page live. Commit: d0d4ff1.

- [x] **Step 1: Create the privacy policy document**

Create `docs/PRIVACY_POLICY.md` with the following content (customize the jurisdiction and contact):

```markdown
# FeaturePulse Privacy Policy

Last updated: 2026-06-19

## What data we collect

The FeaturePulse SDK collects the following data from end-users of apps that integrate it:

| Data | Description |
|------|-------------|
| UI interaction events | Element type, screen name, event type (tap/impression), timestamp |
| Session ID | Random UUID generated per app session — not linked to any user account |
| Device ID | Random UUID generated on first SDK init — not a hardware identifier |

The FeaturePulse web portal collects: email address and password hash (bcrypt) for account authentication.

## What we do NOT collect

- Real names, phone numbers, or government IDs
- Hardware device identifiers (IMEI, MAC address, advertising ID)
- Location data
- Photos, contacts, or files
- Any data about end-users' identities

## How data is used

Raw interaction events are used solely to compute aggregated UI health metrics (interaction rate, feature state). Raw events are automatically deleted after the configured retention period (default: 7 days). Aggregated statistics are retained until the app developer deletes their account.

## Who we share data with

| Provider | Purpose | DPA |
|----------|---------|-----|
| Railway | Server hosting + PostgreSQL database | railway.app/legal/privacy |
| OpenRouter | AI insights (only if enabled per-app) | openrouter.ai/privacy |

## Your rights

- **Right to erasure:** Delete your account via the portal (Settings → Delete Account). This permanently deletes all apps, features, events, and aggregates.
- **Data portability:** Export your feature data as CSV from the portal Features page.
- **Contact:** tamaraloni11@gmail.com

## Jurisdiction

This policy is governed by the laws of Israel.
```

- [x] **Step 2: Add a Privacy Policy route to the portal**

- [x] **Step 3: Add a footer link**

- [x] **Step 4: Commit**

---

### Task F2: SDK Data Safety Disclosure for Google Play ✅ DONE

`docs/SDK_DATA_DISCLOSURE.md` created. Commit: 9f3c855.

- [x] **Step 1: Create the data safety disclosure document**

Create `docs/SDK_DATA_DISCLOSURE.md`:

```markdown
# FeaturePulse SDK — Google Play Data Safety Disclosure

Use this to fill out the Data Safety section in Google Play Console for apps that integrate FeaturePulse.

## Data collected

| Data type (Play category) | Collected? | Shared with 3rd parties? | Encrypted in transit? | User can request deletion? | Purpose |
|--------------------------|-----------|--------------------------|----------------------|---------------------------|---------|
| App interactions | Yes | No | Yes (HTTPS/TLS) | Yes | Analytics |
| App info and performance (crash logs) | No | — | — | — | — |
| Device or other IDs | Yes (random UUID only, not hardware ID) | No | Yes | Yes | Analytics |

## Data NOT collected by FeaturePulse

Location, contacts, personal info (name, email, address), financial info, health info, photos, files, audio, video.

## Data retention

- Raw interaction events: deleted after the retention period set by the app developer (default 7 days, minimum 1 day)
- Aggregated statistics: retained until the app developer deletes their FeaturePulse account

## User consent responsibilities

App developers integrating FeaturePulse are responsible for:
1. Disclosing FeaturePulse data collection in their own app's privacy policy
2. Complying with applicable privacy laws (GDPR, CCPA, etc.) for their user base
3. Providing a mechanism for users to request data deletion (FeaturePulse supports this via account deletion)
```

- [x] **Step 2: Commit**

---

## Execution Order Recommendation

| Status | Track / Task | Notes |
|--------|-------------|-------|
| ✅ Done | A3 — External cron trigger | Live on Railway; GitHub Actions fires at 02:00 UTC |
| ✅ Done | B1 — pino structured logging | All routes use `logger` |
| ✅ Done | B2 — Sentry error tracking | Guarded; add `SENTRY_DSN` in Railway to enable |
| ✅ Done | D1 — GitHub Actions CI | Runs server tests + portal build on push |
| ✅ Done | E1 — JitPack SDK publishing | Tag `sdk-v1.0.0` pushed; trigger first build at jitpack.io |
| ✅ Done | F1 — Privacy policy | `/privacy` route live in portal |
| ✅ Done | F2 — SDK data safety disclosure | `docs/SDK_DATA_DISCLOSURE.md` created |
| ⏳ Next | A1 — Rate limiting per API key | Must do before real traffic |
| ⏳ Next | A2 — CORS hardening | `CORS_ORIGIN` already set in Railway; add fail-fast guard |
| ⏳ Next | A4 — API key rotation endpoint | Security hardening |
| ⏳ Next | A5 — Batch upsert on /discover | Performance: N DB calls → 1 |
| ⏳ Next | B3 — AI insights graceful degradation | Cron-safe; portal friendly error |
| 🔲 Later | C1–C3 — Per-tenant event quotas | Not needed until multi-tenant growth |
| 🔲 Later | D2 — Staging environment | Useful before A/B testing or breaking changes |
