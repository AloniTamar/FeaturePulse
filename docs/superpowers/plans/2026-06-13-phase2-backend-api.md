# Phase 2: Backend API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build a fully tested Node.js/Express server that receives SDK events, runs nightly classification, and serves all data the React portal needs.

**Architecture:** Eight tasks in sequence — project setup → Prisma schema → auth middleware → event ingestion → classification state machine → nightly aggregation cron → portal API routes → integration tests. Every task produces working, testable code before the next begins.

**Tech Stack:** Node.js 20 + Express 4 + PostgreSQL 15 + Prisma 5 + Zod 3 + node-cron 3 + Jest 29 + Supertest 6 + TypeScript 5

**Phase 1 delivered (do not re-implement):**
- `sdk/` — all SDK core files are complete and tested (30 tests passing)
- `sdk/src/main/kotlin/com/featurepulse/internal/sync/ApiClient.kt` — stub only; will be replaced in Phase 3
- `sdk/src/main/kotlin/com/featurepulse/internal/sync/SyncWorker.kt` — stub only; will be replaced in Phase 3

---

## File Structure

```
server/
├── package.json
├── tsconfig.json
├── jest.config.ts
├── .env.example
├── prisma/
│   └── schema.prisma
└── src/
    ├── index.ts                    ← Express app + route mounting + cron wiring
    ├── db/
    │   └── client.ts               ← Prisma singleton
    ├── middleware/
    │   └── auth.ts                 ← apiKeyAuth (SDK) + jwtAuth (portal)
    ├── routes/
    │   ├── auth.ts                 ← POST /auth/register, POST /auth/login
    │   ├── apps.ts                 ← GET /apps, GET /apps/config, PUT /:appId/config
    │   ├── events.ts               ← POST /events/batch, POST /events/discover
    │   ├── features.ts             ← GET/PATCH feature endpoints + timeline + export
    │   └── dashboard.ts            ← GET dashboard stats, dead list, declining list
    ├── services/
    │   ├── ingestion.ts            ← batch parsing, upsert feature, timestamp guards
    │   ├── classification.ts       ← determineState(), classifyFeature() pure functions
    │   └── aggregation.ts          ← aggregateDay(), runNightlyAggregation()
    └── cron/
        └── nightly.ts              ← node-cron wiring at 02:00 UTC
tests/
├── classification.test.ts          ← unit tests for pure classification functions
├── ingestion.test.ts               ← integration tests against real test DB
└── routes.test.ts                  ← supertest end-to-end route tests
```

---

## Task 15: Server project setup

**Target day:** 8

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/jest.config.ts`
- Create: `server/.env.example`
- Create: `server/src/index.ts`

- [x] **Step 1: Create `server/package.json`**

```json
{
  "name": "featurepulse-server",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --runInBand --forceExit",
    "migrate": "prisma migrate deploy",
    "generate": "prisma generate",
    "studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.10.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "node-cron": "^3.0.3",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.11",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node": "^20.11.5",
    "@types/node-cron": "^3.0.11",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "prisma": "^5.10.0",
    "supertest": "^6.3.4",
    "ts-jest": "^29.1.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.3"
  }
}
```

- [x] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [x] **Step 3: Create `server/jest.config.ts`**

```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}
```

- [x] **Step 4: Create `server/.env.example`**

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/featurepulse
PORT=3000
NODE_ENV=development
JWT_SECRET=change_me_to_a_64_char_random_string
CORS_ORIGIN=http://localhost:5173
```

Copy to `.env` and fill in your local PostgreSQL credentials.

- [x] **Step 5: Create `server/src/index.ts`**

```typescript
// server/src/index.ts
import express from 'express'
import cors from 'cors'
import { eventsRouter } from './routes/events'
import { featuresRouter } from './routes/features'
import { dashboardRouter } from './routes/dashboard'
import { appsRouter } from './routes/apps'
import { authRouter } from './routes/auth'
import { startCronJobs } from './cron/nightly'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/v1/auth',     authRouter)
app.use('/api/v1/apps',     appsRouter)
app.use('/api/v1/events',   eventsRouter)
app.use('/api/v1/features', featuresRouter)
app.use('/api/v1',          dashboardRouter)

if (process.env.NODE_ENV !== 'test') {
  startCronJobs()
}

const PORT = parseInt(process.env.PORT ?? '3000')
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`FeaturePulse server running on :${PORT}`))
}

export { app }
```

- [x] **Step 6: Install dependencies**

```bash
cd server && npm install
```

- [x] **Step 7: Create `server/src/db/` and `server/tests/` directories**

```bash
mkdir -p server/src/db server/src/middleware server/src/routes server/src/services server/src/cron server/tests server/prisma
```

- [x] **Step 8: Commit**

```bash
git add server/
git commit -m "chore(server): initialize Node.js/Express/TypeScript project with Jest config"
```

---

## Task 16: Prisma schema + database

**Target day:** 8

**Files:**
- Create: `server/prisma/schema.prisma`
- Create: `server/src/db/client.ts`

- [x] **Step 1: Create `server/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model App {
  id           String   @id @default(uuid())
  name         String
  packageName  String
  apiKey       String   @unique
  apiKeyHash   String
  ownerEmail   String
  createdAt    DateTime @default(now())
  config       Json     @default("{}")
  features     Feature[]
  rawEvents    RawEvent[]
}

model Feature {
  id               String    @id
  appId            String
  app              App       @relation(fields: [appId], references: [id])
  elementType      String
  resourceName     String?
  screenName       String
  hierarchyPath    String?
  firstSeen        DateTime  @default(now())
  lastInteraction  DateTime?
  state            String    @default("THRIVING")
  isIgnored        Boolean   @default(false)
  metadata         Json      @default("{}")
  dailyAggregates  DailyAggregate[]
  stateTransitions StateTransition[]

  @@index([appId, state])
  @@index([appId, screenName])
}

model RawEvent {
  id        String   @id
  featureId String
  appId     String
  app       App      @relation(fields: [appId], references: [id])
  eventType String
  timestamp DateTime
  sessionId String?
  deviceId  String?

  @@index([featureId, timestamp])
  @@index([appId, timestamp])
}

model DailyAggregate {
  featureId       String
  date            DateTime @db.Date
  impressions     Int      @default(0)
  interactions    Int      @default(0)
  uniqueUsers     Int      @default(0)
  interactionRate Float    @default(0.0)
  feature         Feature  @relation(fields: [featureId], references: [id])

  @@id([featureId, date])
  @@index([date])
}

model StateTransition {
  id        Int      @id @default(autoincrement())
  featureId String
  feature   Feature  @relation(fields: [featureId], references: [id])
  oldState  String?
  newState  String
  changedAt DateTime @default(now())
  reason    String?
}
```

- [x] **Step 2: Create `server/src/db/client.ts`**

```typescript
// server/src/db/client.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [x] **Step 3: Generate Prisma client**

```bash
cd server && npx prisma generate
```

Expected: `Prisma Client generated successfully`

- [x] **Step 4: Run migration against local PostgreSQL**

Ensure PostgreSQL is running and `DATABASE_URL` in `.env` is correct, then:

```bash
cd server && npx prisma migrate dev --name init
```

Expected: `Your database is now in sync with your schema.`

- [x] **Step 5: Commit**

```bash
git add server/prisma/ server/src/db/
git commit -m "feat(server): add Prisma schema — App, Feature, RawEvent, DailyAggregate, StateTransition"
```

---

## Task 17: Auth middleware + app registration

**Target day:** 9

**Files:**
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/routes/auth.ts`
- Create: `server/src/routes/apps.ts`

- [x] **Step 1: Create `server/src/middleware/auth.ts`**

```typescript
// server/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../db/client'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  appId?: string
  userId?: string
}

/** SDK endpoints: validates X-API-Key header against the App table */
export async function apiKeyAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string | undefined
  if (!key) return res.status(401).json({ error: 'Missing X-API-Key header' })

  const app = await prisma.app.findUnique({ where: { apiKey: key } })
  if (!app) return res.status(401).json({ error: 'Invalid API key' })

  req.appId = app.id
  next()
}

/** Portal endpoints: validates Authorization: Bearer <jwt> */
export function jwtAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' })
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
```

- [x] **Step 2: Create `server/src/routes/auth.ts`**

```typescript
// server/src/routes/auth.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import crypto from 'crypto'

export const authRouter = Router()

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  appName: z.string().min(1),
  packageName: z.string().min(1),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

// In-memory user store for demo; replace with User model in production
const users = new Map<string, { passwordHash: string; id: string }>()

authRouter.post('/register', async (req, res) => {
  const result = RegisterSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { email, password, appName, packageName } = result.data
  if (users.has(email)) return res.status(409).json({ error: 'Email already registered' })

  const userId = crypto.randomUUID()
  const passwordHash = await bcrypt.hash(password, 10)
  users.set(email, { passwordHash, id: userId })

  const apiKey = 'fp_' + crypto.randomBytes(24).toString('hex')
  const app = await prisma.app.create({
    data: { name: appName, packageName, apiKey, apiKeyHash: apiKey, ownerEmail: email },
  })

  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.status(201).json({ token, apiKey: app.apiKey, appId: app.id })
})

authRouter.post('/login', async (req, res) => {
  const result = LoginSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { email, password } = result.data
  const user = users.get(email)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.json({ token })
})
```

- [x] **Step 3: Create `server/src/routes/apps.ts`**

```typescript
// server/src/routes/apps.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth } from '../middleware/auth'

export const appsRouter = Router()

// SDK fetches remote config via this (no auth required — public config only)
appsRouter.get('/config', async (req, res) => {
  const appId = req.query.appId as string
  if (!appId) return res.status(400).json({ error: 'appId required' })
  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) return res.status(404).json({ error: 'App not found' })
  res.json({
    enabled: true,
    syncIntervalMs: 1800000,
    batchSize: 500,
    minImpressionMs: 1000,
    excludeScreens: [],
    samplingRate: 1.0,
    sdkMinVersion: '1.0.0',
    ...(app.config as object),
  })
})

appsRouter.get('/', jwtAuth, async (_req, res) => {
  const apps = await prisma.app.findMany()
  res.json(apps.map(a => ({ id: a.id, name: a.name, packageName: a.packageName, createdAt: a.createdAt })))
})

appsRouter.put('/:appId/config', jwtAuth, async (req, res) => {
  const app = await prisma.app.update({
    where: { id: req.params.appId },
    data: { config: req.body },
  })
  res.json(app)
})
```

- [x] **Step 4: Verify TypeScript compiles (route stubs for missing files needed first)**

Create placeholder files so the compiler is satisfied:

```bash
cat > server/src/routes/events.ts << 'EOF'
import { Router } from 'express'
export const eventsRouter = Router()
EOF

cat > server/src/routes/features.ts << 'EOF'
import { Router } from 'express'
export const featuresRouter = Router()
EOF

cat > server/src/routes/dashboard.ts << 'EOF'
import { Router } from 'express'
export const dashboardRouter = Router()
EOF

cat > server/src/cron/nightly.ts << 'EOF'
export function startCronJobs() {}
EOF
```

Then compile:

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [x] **Step 5: Commit**

```bash
git add server/src/middleware/ server/src/routes/auth.ts server/src/routes/apps.ts \
        server/src/routes/events.ts server/src/routes/features.ts \
        server/src/routes/dashboard.ts server/src/cron/nightly.ts
git commit -m "feat(server): add auth middleware, register/login endpoints, app config routes"
```

---

## Task 18: Event ingestion endpoint

**Target day:** 9

**Files:**
- Create: `server/src/services/ingestion.ts`
- Modify: `server/src/routes/events.ts`

- [x] **Step 1: Create `server/src/services/ingestion.ts`**

```typescript
// server/src/services/ingestion.ts
import { prisma } from '../db/client'
import { z } from 'zod'

export const RawEventSchema = z.object({
  eventId:   z.string().uuid(),
  featureId: z.string().min(1).max(64),
  eventType: z.enum(['TAP', 'LONG_PRESS', 'SWIPE', 'IMPRESSION']),
  timestamp: z.number().int().positive(),
  sessionId: z.string().optional(),
  deviceId:  z.string().optional(),
})

export const BatchPayloadSchema = z.object({
  appId:      z.string().uuid(),
  deviceId:   z.string().optional(),
  sdkVersion: z.string().optional(),
  events:     z.array(RawEventSchema).min(1).max(500),
})

export type BatchPayload = z.infer<typeof BatchPayloadSchema>

export interface IngestResult {
  accepted: number
  rejected: number
  errors: string[]
}

export async function ingestBatch(appId: string, payload: BatchPayload): Promise<IngestResult> {
  const errors: string[] = []
  let accepted = 0

  for (const event of payload.events) {
    const parsed = RawEventSchema.safeParse(event)
    if (!parsed.success) {
      errors.push(`${event.eventId}: ${parsed.error.message}`)
      continue
    }

    const now = Date.now()
    const ts = parsed.data.timestamp
    if (ts < now - 7 * 24 * 60 * 60 * 1000 || ts > now + 60_000) {
      errors.push(`${event.eventId}: timestamp out of range`)
      continue
    }

    try {
      await prisma.rawEvent.upsert({
        where: { id: event.eventId },
        update: {},
        create: {
          id:        event.eventId,
          featureId: event.featureId,
          appId,
          eventType: event.eventType,
          timestamp: new Date(event.timestamp),
          sessionId: event.sessionId,
          deviceId:  event.deviceId,
        },
      })
      accepted++
    } catch {
      errors.push(`${event.eventId}: database error`)
    }
  }

  return { accepted, rejected: errors.length, errors }
}

export async function upsertFeature(
  appId: string,
  featureId: string,
  elementType: string,
  resourceName: string | null,
  screenName: string,
  hierarchyPath: string | null
): Promise<void> {
  await prisma.feature.upsert({
    where: { id: featureId },
    update: {},
    create: { id: featureId, appId, elementType, resourceName, screenName, hierarchyPath, state: 'THRIVING' },
  })
}
```

- [x] **Step 2: Replace `server/src/routes/events.ts` placeholder with full implementation**

```typescript
// server/src/routes/events.ts
import { Router } from 'express'
import { apiKeyAuth, AuthRequest } from '../middleware/auth'
import { ingestBatch, upsertFeature, BatchPayloadSchema } from '../services/ingestion'
import { z } from 'zod'

export const eventsRouter = Router()

const DiscoverSchema = z.object({
  features: z.array(z.object({
    featureId:     z.string(),
    elementType:   z.string(),
    resourceName:  z.string().nullable(),
    screenName:    z.string(),
    hierarchyPath: z.string().nullable(),
  })),
})

eventsRouter.post('/batch', apiKeyAuth, async (req: AuthRequest, res) => {
  const result = BatchPayloadSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const ingested = await ingestBatch(req.appId!, result.data)
  res.json(ingested)
})

eventsRouter.post('/discover', apiKeyAuth, async (req: AuthRequest, res) => {
  const result = DiscoverSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  for (const f of result.data.features) {
    await upsertFeature(req.appId!, f.featureId, f.elementType, f.resourceName, f.screenName, f.hierarchyPath)
  }
  res.json({ registered: result.data.features.length })
})
```

- [x] **Step 3: Build**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [x] **Step 4: Commit**

```bash
git add server/src/services/ingestion.ts server/src/routes/events.ts
git commit -m "feat(server): add event ingestion service and POST /events/batch endpoint"
```

---

## Task 19: Classification service + unit tests

**Target day:** 10

**Files:**
- Create: `server/src/services/classification.ts`
- Create: `server/tests/classification.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
// server/tests/classification.test.ts
import { determineState, calculateDecayRate } from '../src/services/classification'

describe('determineState', () => {
  test('DEAD when 30+ days no interactions', () => {
    expect(determineState(0, [], 30)).toBe('DEAD')
    expect(determineState(0, [], 60)).toBe('DEAD')
  })

  test('not DEAD at 29 days', () => {
    expect(determineState(0.01, [{ week: 1, rate: 0.01 }], 29)).not.toBe('DEAD')
  })

  test('DORMANT when rate < 1% for 2+ weeks', () => {
    const rates = [{ week: 1, rate: 0.005 }, { week: 2, rate: 0.004 }]
    expect(determineState(0.004, rates, 20)).toBe('DORMANT')
  })

  test('DECLINING when rate drops >20% WoW', () => {
    const rates = [{ week: 1, rate: 0.10 }, { week: 2, rate: 0.07 }]
    // (0.10 - 0.07) / 0.10 = 0.30 > 0.20
    expect(determineState(0.07, rates, 5)).toBe('DECLINING')
  })

  test('THRIVING when rate is healthy and stable', () => {
    const rates = [{ week: 1, rate: 0.10 }, { week: 2, rate: 0.11 }]
    expect(determineState(0.11, rates, 1)).toBe('THRIVING')
  })

  test('daysSinceLastInteraction null does not trigger DEAD', () => {
    expect(determineState(0, [], null)).toBe('THRIVING')
  })

  test('DORMANT takes priority over DECLINING when rate is extremely low', () => {
    const rates = [{ week: 1, rate: 0.002 }, { week: 2, rate: 0.001 }]
    expect(determineState(0.001, rates, 20)).toBe('DORMANT')
  })
})

describe('calculateDecayRate', () => {
  test('returns 0 with < 2 data points', () => {
    expect(calculateDecayRate([])).toBe(0)
    expect(calculateDecayRate([0.1])).toBe(0)
  })

  test('correct decay: 0.10 → 0.07 = 30%', () => {
    expect(calculateDecayRate([0.1, 0.07])).toBeCloseTo(0.3)
  })

  test('returns 0 when prev rate is 0', () => {
    expect(calculateDecayRate([0, 0.05])).toBe(0)
  })
})
```

- [x] **Step 2: Run to confirm failure**

```bash
cd server && npx jest tests/classification.test.ts
```

Expected: FAIL — `classification` module not found

- [x] **Step 3: Create `server/src/services/classification.ts`**

```typescript
// server/src/services/classification.ts
import { prisma } from '../db/client'

export type FeatureState = 'THRIVING' | 'DECLINING' | 'DORMANT' | 'DEAD'

export interface WeeklyRate {
  week: number
  rate: number
}

/** Pure function — testable without database */
export function determineState(
  currentRate: number,
  weeklyRates: WeeklyRate[],
  daysSinceLastInteraction: number | null
): FeatureState {
  // DEAD: zero interactions for 30+ consecutive days
  if (daysSinceLastInteraction !== null && daysSinceLastInteraction >= 30) return 'DEAD'

  // DORMANT: rate < 1% sustained across last 2 weekly buckets (14+ days)
  if (weeklyRates.length >= 2 && weeklyRates.slice(-2).every(w => w.rate < 0.01)) return 'DORMANT'

  // DECLINING: rate dropped >20% week-over-week
  if (weeklyRates.length >= 2) {
    const prev = weeklyRates[weeklyRates.length - 2].rate
    const curr = weeklyRates[weeklyRates.length - 1].rate
    if (prev > 0 && (prev - curr) / prev > 0.2) return 'DECLINING'
  }

  return 'THRIVING'
}

/** Pure function — testable without database */
export function calculateDecayRate(weeklyRates: number[]): number {
  if (weeklyRates.length < 2) return 0
  const prev = weeklyRates[weeklyRates.length - 2]
  const curr = weeklyRates[weeklyRates.length - 1]
  if (prev === 0) return 0
  return (prev - curr) / prev
}

/** Database-bound — reads 14 days of aggregates and classifies one feature */
export async function classifyFeature(featureId: string): Promise<FeatureState> {
  const agg = await prisma.dailyAggregate.findMany({
    where: { featureId },
    orderBy: { date: 'desc' },
    take: 14,
  })

  if (agg.length === 0) return 'THRIVING'

  const feature = await prisma.feature.findUnique({ where: { id: featureId } })
  const daysSince = feature?.lastInteraction
    ? Math.floor((Date.now() - feature.lastInteraction.getTime()) / 86_400_000)
    : null

  // Group into 7-day weekly buckets
  const byWeek = new Map<number, number[]>()
  agg.forEach((row, i) => {
    const week = Math.floor(i / 7)
    if (!byWeek.has(week)) byWeek.set(week, [])
    byWeek.get(week)!.push(row.interactionRate)
  })
  const weeklyRates: WeeklyRate[] = Array.from(byWeek.entries())
    .sort(([a], [b]) => b - a)
    .map(([week, rates]) => ({ week, rate: rates.reduce((s, r) => s + r, 0) / rates.length }))
    .reverse()

  return determineState(agg[0]?.interactionRate ?? 0, weeklyRates, daysSince)
}
```

- [x] **Step 4: Run tests**

```bash
cd server && npx jest tests/classification.test.ts
```

Expected: `10 tests passed`

- [x] **Step 5: Commit**

```bash
git add server/src/services/classification.ts server/tests/classification.test.ts
git commit -m "feat(server): add classification service — THRIVING/DECLINING/DORMANT/DEAD state machine + tests"
```

---

## Task 20: Aggregation service + nightly cron

**Target day:** 10

**Files:**
- Create: `server/src/services/aggregation.ts`
- Modify: `server/src/cron/nightly.ts`

- [x] **Step 1: Create `server/src/services/aggregation.ts`**

```typescript
// server/src/services/aggregation.ts
import { prisma } from '../db/client'
import { classifyFeature } from './classification'

export async function aggregateDay(appId: string, date: Date): Promise<void> {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay)
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

  const featureGroups = await prisma.rawEvent.groupBy({
    by: ['featureId'],
    where: { appId, timestamp: { gte: startOfDay, lt: endOfDay } },
  })

  for (const { featureId } of featureGroups) {
    const events = await prisma.rawEvent.findMany({
      where: { featureId, appId, timestamp: { gte: startOfDay, lt: endOfDay } },
    })

    const interactions = events.filter(e => e.eventType !== 'IMPRESSION').length
    const impressions  = events.filter(e => e.eventType === 'IMPRESSION').length
    const uniqueUsers  = new Set(events.map(e => e.deviceId).filter(Boolean)).size
    const interactionRate = impressions > 0 ? interactions / impressions : 0

    await prisma.dailyAggregate.upsert({
      where: { featureId_date: { featureId, date: startOfDay } },
      update: { interactions, impressions, uniqueUsers, interactionRate },
      create: { featureId, date: startOfDay, interactions, impressions, uniqueUsers, interactionRate },
    })
  }
}

export async function runNightlyAggregation(): Promise<void> {
  console.log('[Cron] Starting nightly aggregation…')
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)

  const apps = await prisma.app.findMany({ select: { id: true } })

  for (const app of apps) {
    await aggregateDay(app.id, yesterday)
    await classifyAllFeatures(app.id)
  }

  // Raw events TTL: delete anything older than 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const deleted = await prisma.rawEvent.deleteMany({ where: { timestamp: { lt: cutoff } } })
  console.log(`[Cron] Done. Deleted ${deleted.count} expired raw events.`)
}

async function classifyAllFeatures(appId: string): Promise<void> {
  const features = await prisma.feature.findMany({ where: { appId, isIgnored: false } })

  for (const feature of features) {
    const newState = await classifyFeature(feature.id)
    if (newState !== feature.state) {
      await prisma.feature.update({ where: { id: feature.id }, data: { state: newState } })
      await prisma.stateTransition.create({
        data: {
          featureId: feature.id,
          oldState: feature.state,
          newState,
          reason: `Automated classification on ${new Date().toISOString().slice(0, 10)}`,
        },
      })
    }
  }
}
```

- [x] **Step 2: Replace `server/src/cron/nightly.ts` placeholder with full implementation**

```typescript
// server/src/cron/nightly.ts
import cron from 'node-cron'
import { runNightlyAggregation } from '../services/aggregation'

export function startCronJobs(): void {
  // 02:00 AM UTC every day
  cron.schedule('0 2 * * *', async () => {
    try {
      await runNightlyAggregation()
    } catch (err) {
      console.error('[Cron] Nightly aggregation failed:', err)
    }
  }, { timezone: 'UTC' })

  console.log('[Cron] Nightly aggregation scheduled for 02:00 UTC')
}
```

- [x] **Step 3: Build**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [x] **Step 4: Commit**

```bash
git add server/src/services/aggregation.ts server/src/cron/nightly.ts
git commit -m "feat(server): add nightly aggregation service and 02:00 UTC cron job"
```

---

## Task 21: Portal API routes (features, dashboard)

**Target day:** 11

**Files:**
- Modify: `server/src/routes/features.ts`
- Modify: `server/src/routes/dashboard.ts`

- [x] **Step 1: Replace `server/src/routes/features.ts` placeholder with full implementation**

```typescript
// server/src/routes/features.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth } from '../middleware/auth'

export const featuresRouter = Router()

// GET /api/v1/apps/:appId/features?state=DEAD&screen=HomeActivity&page=1&limit=20
featuresRouter.get('/apps/:appId/features', jwtAuth, async (req, res) => {
  const { appId } = req.params
  const { state, screen, page = '1', limit = '20' } = req.query

  const where: Record<string, unknown> = { appId }
  if (state)  where.state = state
  if (screen) where.screenName = screen

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
  const [features, total] = await Promise.all([
    prisma.feature.findMany({ where, skip, take: parseInt(limit as string), orderBy: { lastInteraction: 'desc' } }),
    prisma.feature.count({ where }),
  ])

  res.json({
    data: features.map(f => ({
      ...f,
      daysSinceLastUse: f.lastInteraction
        ? Math.floor((Date.now() - f.lastInteraction.getTime()) / 86_400_000)
        : null,
    })),
    pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total },
  })
})

// GET /api/v1/features/:featureId
featuresRouter.get('/:featureId', jwtAuth, async (req, res) => {
  const feature = await prisma.feature.findUnique({ where: { id: req.params.featureId } })
  if (!feature) return res.status(404).json({ error: 'Feature not found' })
  res.json(feature)
})

// GET /api/v1/features/:featureId/timeline?days=30
featuresRouter.get('/:featureId/timeline', jwtAuth, async (req, res) => {
  const days = parseInt((req.query.days as string) ?? '30')
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.dailyAggregate.findMany({
    where: { featureId: req.params.featureId, date: { gte: since } },
    orderBy: { date: 'asc' },
  })
  res.json(rows)
})

// PATCH /api/v1/features/:featureId/ignore
featuresRouter.patch('/:featureId/ignore', jwtAuth, async (req, res) => {
  const { ignore } = req.body as { ignore: boolean }
  const feature = await prisma.feature.update({
    where: { id: req.params.featureId },
    data: { isIgnored: ignore },
  })
  res.json(feature)
})

// GET /api/v1/apps/:appId/export?format=json|csv
featuresRouter.get('/apps/:appId/export', jwtAuth, async (req, res) => {
  const features = await prisma.feature.findMany({ where: { appId: req.params.appId } })
  if ((req.query.format as string) === 'csv') {
    const header = 'featureId,elementType,resourceName,screenName,state,lastInteraction\n'
    const rows = features.map(f =>
      `${f.id},${f.elementType},${f.resourceName ?? ''},${f.screenName},${f.state},${f.lastInteraction?.toISOString() ?? ''}`
    ).join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="features.csv"')
    return res.send(header + rows)
  }
  res.json(features)
})
```

- [x] **Step 2: Replace `server/src/routes/dashboard.ts` placeholder with full implementation**

```typescript
// server/src/routes/dashboard.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth } from '../middleware/auth'

export const dashboardRouter = Router()

// GET /api/v1/apps/:appId/dashboard — summary counts + 10 most recent state changes
dashboardRouter.get('/apps/:appId/dashboard', jwtAuth, async (req, res) => {
  const { appId } = req.params

  const [stateCounts, recentTransitions] = await Promise.all([
    prisma.feature.groupBy({ by: ['state'], where: { appId }, _count: true }),
    prisma.stateTransition.findMany({
      where: { feature: { appId } },
      orderBy: { changedAt: 'desc' },
      take: 10,
      include: { feature: { select: { resourceName: true, screenName: true } } },
    }),
  ])

  const counts = { TOTAL: 0, THRIVING: 0, DECLINING: 0, DORMANT: 0, DEAD: 0 }
  for (const { state, _count } of stateCounts) {
    counts[state as keyof typeof counts] = _count
    counts.TOTAL += _count
  }

  res.json({ counts, recentTransitions })
})

// GET /api/v1/apps/:appId/dead — dead features ordered by oldest last-use first
dashboardRouter.get('/apps/:appId/dead', jwtAuth, async (req, res) => {
  const features = await prisma.feature.findMany({
    where: { appId: req.params.appId, state: 'DEAD', isIgnored: false },
    orderBy: { lastInteraction: 'asc' },
  })
  res.json(features)
})

// GET /api/v1/apps/:appId/declining
dashboardRouter.get('/apps/:appId/declining', jwtAuth, async (req, res) => {
  const features = await prisma.feature.findMany({
    where: { appId: req.params.appId, state: 'DECLINING', isIgnored: false },
    orderBy: { lastInteraction: 'desc' },
  })
  res.json(features)
})
```

- [x] **Step 3: Build**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [x] **Step 4: Smoke test — start server and verify `/health`**

```bash
cd server && npm run dev &
sleep 3
curl http://localhost:3000/health
kill %1
```

Expected: `{"status":"ok"}`

- [x] **Step 5: Commit**

```bash
git add server/src/routes/features.ts server/src/routes/dashboard.ts
git commit -m "feat(server): add portal API routes — features list, timeline, dashboard stats, dead/declining"
```

---

## Task 22: Integration tests (ingestion + routes)

**Target day:** 12–13

**Files:**
- Create: `server/tests/ingestion.test.ts`
- Create: `server/tests/routes.test.ts`

> **Note:** These tests hit a real PostgreSQL database. Ensure `.env` points to the test database (or the dev DB is clean). Tests use `beforeEach` to delete rows — they do not use a separate test database by default. If you want isolation, set `DATABASE_URL` in your test environment to a separate `featurepulse_test` database.

- [x] **Step 1: Write failing ingestion tests**

```typescript
// server/tests/ingestion.test.ts
import { ingestBatch, BatchPayload } from '../src/services/ingestion'
import { prisma } from '../src/db/client'

beforeEach(async () => {
  await prisma.rawEvent.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

async function createTestApp() {
  return prisma.app.create({
    data: {
      name: 'Test', packageName: 'com.test', apiKey: 'fp_test_key',
      apiKeyHash: 'fp_test_key', ownerEmail: 'test@test.com',
    },
  })
}

function validPayload(appId: string): BatchPayload {
  return {
    appId,
    deviceId: 'dev_abc',
    sdkVersion: '1.0.0',
    events: [
      { eventId: '00000000-0000-0000-0000-000000000001', featureId: 'feat_001', eventType: 'TAP',        timestamp: Date.now(), sessionId: 'sess_x', deviceId: 'dev_abc' },
      { eventId: '00000000-0000-0000-0000-000000000002', featureId: 'feat_002', eventType: 'IMPRESSION', timestamp: Date.now(), sessionId: 'sess_x', deviceId: 'dev_abc' },
    ],
  }
}

test('accepts valid batch and returns correct counts', async () => {
  const app = await createTestApp()
  const result = await ingestBatch(app.id, validPayload(app.id))
  expect(result.accepted).toBe(2)
  expect(result.rejected).toBe(0)
  expect(result.errors).toHaveLength(0)
})

test('duplicate eventId is idempotent (upsert no-op)', async () => {
  const app = await createTestApp()
  const payload = validPayload(app.id)
  await ingestBatch(app.id, payload)
  const result2 = await ingestBatch(app.id, payload)
  expect(result2.accepted).toBe(2)
  expect(result2.rejected).toBe(0)
})

test('rejects event with invalid eventType', async () => {
  const app = await createTestApp()
  const payload: BatchPayload = {
    ...validPayload(app.id),
    events: [{ eventId: '00000000-0000-0000-0000-000000000099', featureId: 'feat_x', eventType: 'CLICK' as never, timestamp: Date.now() }],
  }
  const result = await ingestBatch(app.id, payload)
  expect(result.rejected).toBe(1)
})

test('rejects event with timestamp older than 7 days', async () => {
  const app = await createTestApp()
  const oldTs = Date.now() - 8 * 24 * 60 * 60 * 1000
  const payload: BatchPayload = {
    ...validPayload(app.id),
    events: [{ eventId: '00000000-0000-0000-0000-000000000010', featureId: 'feat_x', eventType: 'TAP', timestamp: oldTs }],
  }
  const result = await ingestBatch(app.id, payload)
  expect(result.rejected).toBe(1)
})
```

- [x] **Step 2: Run to confirm failure**

```bash
cd server && npx jest tests/ingestion.test.ts
```

Expected: FAIL — either connection error (if DB not running) or missing route stubs. Fix DB connectivity first if needed.

- [x] **Step 3: Write failing route tests**

```typescript
// server/tests/routes.test.ts
import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'

let testApiKey: string
let testAppId: string

beforeAll(async () => {
  await prisma.rawEvent.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
  const testApp = await prisma.app.create({
    data: {
      name: 'RouteTest', packageName: 'com.routetest',
      apiKey: 'fp_route_key', apiKeyHash: 'fp_route_key', ownerEmail: 'route@test.com',
    },
  })
  testApiKey = testApp.apiKey
  testAppId  = testApp.id
})

afterAll(async () => { await prisma.$disconnect() })

describe('GET /health', () => {
  test('returns ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('POST /api/v1/events/batch', () => {
  test('returns 200 with valid payload', async () => {
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('x-api-key', testApiKey)
      .send({
        appId: testAppId,
        deviceId: 'dev_1',
        sdkVersion: '1.0.0',
        events: [{ eventId: '00000000-0000-0000-0000-000000000101', featureId: 'feat_1', eventType: 'TAP', timestamp: Date.now() }],
      })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toBe(1)
  })

  test('returns 401 with missing API key', async () => {
    const res = await request(app).post('/api/v1/events/batch').send({})
    expect(res.status).toBe(401)
  })

  test('returns 401 with invalid API key', async () => {
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('x-api-key', 'fp_wrong_key')
      .send({ appId: testAppId, events: [] })
    expect(res.status).toBe(401)
  })

  test('returns 400 with empty events array', async () => {
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('x-api-key', testApiKey)
      .send({ appId: testAppId, events: [] })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/v1/auth/register', () => {
  test('returns 201 with token and apiKey', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: `test_${Date.now()}@example.com`,
      password: 'password123',
      appName: 'MyApp',
      packageName: 'com.myapp',
    })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
    expect(res.body.apiKey).toMatch(/^fp_/)
  })
})
```

- [x] **Step 4: Run all server tests**

```bash
cd server && npm test
```

Expected:
```
classification.test.ts: 10 passed
ingestion.test.ts:      4 passed
routes.test.ts:         6 passed
```

- [x] **Step 5: Commit**

```bash
git add server/tests/
git commit -m "test(server): add ingestion, classification, and route integration tests — all green"
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| POST /api/v1/events/batch, API key auth | Task 18 + Task 17 |
| Batch validation: eventType enum, timestamp 7d TTL | Task 18 `ingestion.ts` |
| Idempotent ingest (upsert on eventId) | Task 18 |
| THRIVING→DECLINING→DORMANT→DEAD state machine | Task 19 |
| DEAD = 30+ days no interactions | Task 19 `determineState` |
| DORMANT = rate < 1% for 14+ days | Task 19 |
| DECLINING = rate drops >20% WoW | Task 19 |
| Nightly aggregation at 02:00 UTC | Task 20 |
| Raw events TTL 7 days (delete on cron) | Task 20 `runNightlyAggregation` |
| daily_aggregates table, interactionRate, uniqueUsers | Task 16 schema + Task 20 |
| GET dead feature list indexed by (app_id, state) | Task 16 `@@index([appId, state])` + Task 21 |
| Feature timeline endpoint (30 days) | Task 21 `features/:id/timeline` |
| Dashboard summary counts + recent transitions | Task 21 `dashboard.ts` |
| CSV export | Task 21 |
| JWT auth for portal endpoints | Task 17 |
| App registration, API key generation | Task 17 |
| Remote config endpoint for SDK | Task 17 `apps/config` |

All spec requirements are covered. No placeholders in task steps.

---

*Phase 2 complete. Server runs, endpoints respond, 20+ tests pass. Phase 3 is SDK Sync completion (RetryPolicy, full ApiClient, SyncWorker) + React portal.*
