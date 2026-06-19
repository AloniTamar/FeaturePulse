# Analytics, AI Insights & DB Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DB/query optimizations (batch SQL, denormalized indexes, precomputed weekly rates) and a new Analytics page with screen health, declining features, user distribution metrics, and AI-generated insights.

**Architecture:** Three layers — schema changes unlock efficient queries; a refactored cron computes `AppDailyStats` and `WeeklyAggregate` in O(1) DB calls per app; a new `/analytics` API endpoint and React page surface all metrics plus an AI insights card backed by Claude.

**Tech Stack:** Prisma + PostgreSQL (raw SQL via `$queryRaw`), Node.js/Express, React 18 + TypeScript + Tailwind, Anthropic SDK (`@anthropic-ai/sdk`), SVG-based charts (no chart library — follow existing pattern).

## Global Constraints

- All DB queries go through `prisma` client or `prisma.$queryRaw` — no raw `pg` driver
- `$queryRaw` returns `bigint` for `COUNT(*)` — always wrap with `Number()`
- New chart components use inline SVG — no external chart library
- Follow existing file patterns exactly: named exports, inline Tailwind, `style={{}}` for pixel values
- `ANTHROPIC_API_KEY` in `server/.env` — never exposed to portal
- Model: `claude-haiku-4-5-20251001` for insights (cheap + fast)
- Never add Co-Authored-By to commits

---

### Task 1: Schema migration

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: `prisma.appDailyStats`, `prisma.weeklyAggregate`, `prisma.appInsight`, `App.aiInsightsEnabled`, `App.aiInsightsMode`, `DailyAggregate.appId`

- [ ] **Step 1: Update schema.prisma**

Replace the `DailyAggregate` model and add four new models. Open `server/prisma/schema.prisma` and apply these changes:

Add to `App` model (after `eventRetentionDays`):
```prisma
  aiInsightsEnabled    Boolean  @default(false)
  aiInsightsMode       String   @default("nightly")
  appDailyStats        AppDailyStats[]
  appInsight           AppInsight?
```

Replace `DailyAggregate` model entirely:
```prisma
model DailyAggregate {
  featureId       String
  appId           String
  date            DateTime @db.Date
  impressions     Int      @default(0)
  interactions    Int      @default(0)
  uniqueUsers     Int      @default(0)
  interactionRate Float    @default(0.0)
  feature         Feature  @relation(fields: [featureId], references: [id], onDelete: Cascade)
  app             App      @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@id([featureId, date])
  @@index([date])
  @@index([appId, date])
}
```

Add `weeklyAggregates WeeklyAggregate[]` to the `Feature` model relations.

Append new models after `StateTransition`:
```prisma
model AppDailyStats {
  appId             String
  date              DateTime @db.Date
  dailyActiveUsers  Int      @default(0)
  totalImpressions  Int      @default(0)
  totalInteractions Int      @default(0)
  app               App      @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@id([appId, date])
  @@index([appId, date])
}

model WeeklyAggregate {
  featureId          String
  weekStart          DateTime
  avgInteractionRate Float    @default(0.0)
  totalInteractions  Int      @default(0)
  totalImpressions   Int      @default(0)
  uniqueUsers        Int      @default(0)
  feature            Feature  @relation(fields: [featureId], references: [id], onDelete: Cascade)

  @@id([featureId, weekStart])
  @@index([featureId, weekStart])
}

model AppInsight {
  appId       String   @id
  summary     String
  bullets     Json
  generatedAt DateTime @default(now())
  app         App      @relation(fields: [appId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Reset DB and regenerate client**

`DailyAggregate.appId` is non-nullable and has no default — Prisma can't auto-migrate without a backfill. For this dev environment, reset is cleanest:

```bash
cd server
npx prisma migrate reset --force
npx prisma generate
```

Expected output ends with: `✔ Generated Prisma Client`

- [ ] **Step 3: Verify client compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors. If you see `Property 'appDailyStats' does not exist on type 'PrismaClient'`, the generate step didn't complete — re-run it.

- [ ] **Step 4: Re-seed demo data**

```bash
cd server && npx ts-node prisma/seed.ts
```

Expected: seed script completes without errors.

- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma server/prisma/migrations/
git commit -m "feat(schema): add WeeklyAggregate, AppDailyStats, AppInsight; denormalize appId onto DailyAggregate"
```

---

### Task 2: Batch aggregation + AppDailyStats + WeeklyAggregate

**Files:**
- Modify: `server/src/services/aggregation.ts`
- Test: `server/src/__tests__/aggregation.test.ts`

**Interfaces:**
- Consumes: `prisma.dailyAggregate`, `prisma.appDailyStats`, `prisma.weeklyAggregate`, `prisma.$queryRaw`
- Produces: `aggregateDay(appId, date)` — same signature, new internals; `runNightlyAggregation()` — unchanged signature

- [ ] **Step 1: Write the failing test**

Create `server/src/__tests__/aggregation.test.ts`:

```typescript
import { getISOWeekStart } from '../services/aggregation'

describe('getISOWeekStart', () => {
  test('returns Monday for a Wednesday', () => {
    const wed = new Date('2026-06-17T12:00:00Z') // Wednesday
    const result = getISOWeekStart(wed)
    expect(result.toISOString().slice(0, 10)).toBe('2026-06-15') // Monday
  })

  test('returns same day for a Monday', () => {
    const mon = new Date('2026-06-15T00:00:00Z')
    const result = getISOWeekStart(mon)
    expect(result.toISOString().slice(0, 10)).toBe('2026-06-15')
  })

  test('returns previous Monday for a Sunday', () => {
    const sun = new Date('2026-06-21T00:00:00Z')
    const result = getISOWeekStart(sun)
    expect(result.toISOString().slice(0, 10)).toBe('2026-06-15')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx jest --forceExit --runInBand aggregation.test
```

Expected: FAIL — `getISOWeekStart is not a function`

- [ ] **Step 3: Replace aggregation.ts**

```typescript
import { prisma } from '../db/client'
import { classifyAllFeatures } from './classification'

export function getISOWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

export async function aggregateDay(appId: string, date: Date): Promise<void> {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay)
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

  // Single query replaces the old N+1 loop
  const featureStats = await prisma.$queryRaw<{
    featureId: string
    impressions: bigint
    interactions: bigint
    uniqueUsers: bigint
  }[]>`
    SELECT
      "featureId",
      COUNT(*) FILTER (WHERE "eventType" = 'IMPRESSION')  AS impressions,
      COUNT(*) FILTER (WHERE "eventType" != 'IMPRESSION') AS interactions,
      COUNT(DISTINCT "deviceId")                           AS "uniqueUsers"
    FROM "RawEvent"
    WHERE "appId" = ${appId}
      AND "timestamp" >= ${startOfDay}
      AND "timestamp" < ${endOfDay}
    GROUP BY "featureId"
  `

  if (featureStats.length > 0) {
    await Promise.all(
      featureStats.map(row => {
        const impressions     = Number(row.impressions)
        const interactions    = Number(row.interactions)
        const uniqueUsers     = Number(row.uniqueUsers)
        const interactionRate = impressions > 0 ? interactions / impressions : 0
        return prisma.dailyAggregate.upsert({
          where: { featureId_date: { featureId: row.featureId, date: startOfDay } },
          update: { impressions, interactions, uniqueUsers, interactionRate, appId },
          create: { featureId: row.featureId, appId, date: startOfDay, impressions, interactions, uniqueUsers, interactionRate },
        })
      })
    )
  }

  // App-level DAU — one query, not a sum of per-feature uniqueUsers (avoids double-counting)
  const [appStats] = await prisma.$queryRaw<{
    uniqueUsers: bigint
    totalImpressions: bigint
    totalInteractions: bigint
  }[]>`
    SELECT
      COUNT(DISTINCT "deviceId")                           AS "uniqueUsers",
      COUNT(*) FILTER (WHERE "eventType" = 'IMPRESSION')  AS "totalImpressions",
      COUNT(*) FILTER (WHERE "eventType" != 'IMPRESSION') AS "totalInteractions"
    FROM "RawEvent"
    WHERE "appId" = ${appId}
      AND "timestamp" >= ${startOfDay}
      AND "timestamp" < ${endOfDay}
  `

  await prisma.appDailyStats.upsert({
    where: { appId_date: { appId, date: startOfDay } },
    update: {
      dailyActiveUsers:  Number(appStats?.uniqueUsers ?? 0),
      totalImpressions:  Number(appStats?.totalImpressions ?? 0),
      totalInteractions: Number(appStats?.totalInteractions ?? 0),
    },
    create: {
      appId, date: startOfDay,
      dailyActiveUsers:  Number(appStats?.uniqueUsers ?? 0),
      totalImpressions:  Number(appStats?.totalImpressions ?? 0),
      totalInteractions: Number(appStats?.totalInteractions ?? 0),
    },
  })

  await updateWeeklyAggregates(appId, date)
}

async function updateWeeklyAggregates(appId: string, date: Date): Promise<void> {
  const weekStart = getISOWeekStart(date)
  const weekEnd   = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  // Recompute week totals from DailyAggregate (uses the new appId index — no join needed)
  const rows = await prisma.$queryRaw<{
    featureId: string
    avgRate: number
    totalInteractions: bigint
    totalImpressions: bigint
    maxUniqueUsers: bigint
  }[]>`
    SELECT
      "featureId",
      AVG("interactionRate")::float AS "avgRate",
      SUM("interactions")           AS "totalInteractions",
      SUM("impressions")            AS "totalImpressions",
      MAX("uniqueUsers")            AS "maxUniqueUsers"
    FROM "DailyAggregate"
    WHERE "appId" = ${appId}
      AND "date" >= ${weekStart}
      AND "date" < ${weekEnd}
    GROUP BY "featureId"
  `

  await Promise.all(
    rows.map(row =>
      prisma.weeklyAggregate.upsert({
        where: { featureId_weekStart: { featureId: row.featureId, weekStart } },
        update: {
          avgInteractionRate: row.avgRate,
          totalInteractions:  Number(row.totalInteractions),
          totalImpressions:   Number(row.totalImpressions),
          uniqueUsers:        Number(row.maxUniqueUsers),
        },
        create: {
          featureId: row.featureId,
          weekStart,
          avgInteractionRate: row.avgRate,
          totalInteractions:  Number(row.totalInteractions),
          totalImpressions:   Number(row.totalImpressions),
          uniqueUsers:        Number(row.maxUniqueUsers),
        },
      })
    )
  )
}

export async function runNightlyAggregation(): Promise<void> {
  console.log('[Cron] Starting nightly aggregation…')
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)

  const apps = await prisma.app.findMany({
    select: { id: true, eventRetentionDays: true },
  })

  for (const app of apps) {
    await aggregateDay(app.id, yesterday)
    await classifyAllFeatures(app.id)

    const cutoff = new Date(Date.now() - (app.eventRetentionDays ?? 7) * 86_400_000)
    await prisma.rawEvent.deleteMany({ where: { appId: app.id, timestamp: { lt: cutoff } } })
  }

  console.log('[Cron] Done.')
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd server && npx jest --forceExit --runInBand aggregation.test
```

Expected: PASS (3 tests)

- [ ] **Step 5: Compile check**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add server/src/services/aggregation.ts server/src/__tests__/aggregation.test.ts
git commit -m "perf(aggregation): replace N+1 loop with single raw SQL; add AppDailyStats and WeeklyAggregate upserts"
```

---

### Task 3: Classification refactor — batch reads from WeeklyAggregate

**Files:**
- Modify: `server/src/services/classification.ts`
- Test: `server/src/__tests__/classification.test.ts`

**Interfaces:**
- Consumes: `prisma.weeklyAggregate`, `determineState()` (pure, unchanged), `prisma.$transaction`
- Produces: `classifyAllFeatures(appId)` — same signature, O(3) DB calls instead of O(n*2)
- Removes: `classifyFeature()` — was only called from `classifyAllFeatures`, no longer needed

- [ ] **Step 1: Write failing tests**

Create `server/src/__tests__/classification.test.ts`:

```typescript
import { determineState, calculateDecayRate } from '../services/classification'

describe('determineState', () => {
  const thresholds = { deadDays: 30, dormantWeeks: 2 }

  test('DEAD when daysSinceLastInteraction >= deadDays', () => {
    expect(determineState(0, [], 30, thresholds)).toBe('DEAD')
    expect(determineState(0, [], 45, thresholds)).toBe('DEAD')
  })

  test('THRIVING when no history and not dead', () => {
    expect(determineState(0, [], null, thresholds)).toBe('THRIVING')
  })

  test('DORMANT when rate < 1% for both weeks', () => {
    const rates = [{ week: 1, rate: 0.005 }, { week: 2, rate: 0.003 }]
    expect(determineState(0.003, rates, 5, thresholds)).toBe('DORMANT')
  })

  test('DECLINING when WoW drop > 20%', () => {
    const rates = [{ week: 1, rate: 0.5 }, { week: 2, rate: 0.35 }]
    expect(determineState(0.35, rates, 3, thresholds)).toBe('DECLINING')
  })

  test('THRIVING when rate is stable and healthy', () => {
    const rates = [{ week: 1, rate: 0.4 }, { week: 2, rate: 0.42 }]
    expect(determineState(0.42, rates, 3, thresholds)).toBe('THRIVING')
  })
})

describe('calculateDecayRate', () => {
  test('returns 0 with fewer than 2 data points', () => {
    expect(calculateDecayRate([])).toBe(0)
    expect(calculateDecayRate([0.5])).toBe(0)
  })

  test('returns 0 when previous rate is 0', () => {
    expect(calculateDecayRate([0, 0.3])).toBe(0)
  })

  test('calculates correct decay', () => {
    expect(calculateDecayRate([0.5, 0.4])).toBeCloseTo(0.2)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
cd server && npx jest --forceExit --runInBand classification.test
```

Expected: FAIL — pure function tests should actually PASS since `determineState` already exists. If they pass, move to Step 3.

- [ ] **Step 3: Replace classification.ts**

```typescript
import { prisma } from '../db/client'

export type FeatureState = 'THRIVING' | 'DECLINING' | 'DORMANT' | 'DEAD'

export interface WeeklyRate {
  week: number
  rate: number
}

export function determineState(
  currentRate: number,
  weeklyRates: WeeklyRate[],
  daysSinceLastInteraction: number | null,
  thresholds: { deadDays: number; dormantWeeks: number } = { deadDays: 30, dormantWeeks: 2 }
): FeatureState {
  if (daysSinceLastInteraction !== null && daysSinceLastInteraction >= thresholds.deadDays) return 'DEAD'
  if (
    weeklyRates.length >= thresholds.dormantWeeks &&
    weeklyRates.slice(-thresholds.dormantWeeks).every(w => w.rate < 0.01)
  ) return 'DORMANT'
  if (weeklyRates.length >= 2) {
    const prev = weeklyRates[weeklyRates.length - 2].rate
    const curr = weeklyRates[weeklyRates.length - 1].rate
    if (prev > 0 && (prev - curr) / prev > 0.2) return 'DECLINING'
  }
  return 'THRIVING'
}

export function calculateDecayRate(weeklyRates: number[]): number {
  if (weeklyRates.length < 2) return 0
  const prev = weeklyRates[weeklyRates.length - 2]
  const curr = weeklyRates[weeklyRates.length - 1]
  if (prev === 0) return 0
  return (prev - curr) / prev
}

// Exported so aggregation.ts can call it; reads WeeklyAggregate instead of DailyAggregate
export async function classifyAllFeatures(appId: string): Promise<void> {
  const app = await prisma.app.findUnique({ where: { id: appId } })
  const thresholds = {
    deadDays:     app?.deadThresholdDays    ?? 30,
    dormantWeeks: Math.ceil((app?.dormantThresholdDays ?? 14) / 7),
  }
  const bucketCount = Math.max(2, thresholds.dormantWeeks)

  // Query 1: all non-ignored features
  const features = await prisma.feature.findMany({ where: { appId, isIgnored: false } })
  if (features.length === 0) return

  // Query 2: all weekly rates for those features (last N weeks)
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - bucketCount * 7)
  const weeklyRows = await prisma.weeklyAggregate.findMany({
    where: { featureId: { in: features.map(f => f.id) }, weekStart: { gte: cutoff } },
    orderBy: { weekStart: 'asc' },
  })

  // Group weekly rows by featureId in memory
  const weeklyByFeature = new Map<string, WeeklyRate[]>()
  for (const row of weeklyRows) {
    const list = weeklyByFeature.get(row.featureId) ?? []
    list.push({ week: list.length + 1, rate: row.avgInteractionRate })
    weeklyByFeature.set(row.featureId, list)
  }

  // Classify in memory — no DB calls
  const stateChanges: { featureId: string; oldState: string; newState: string }[] = []
  for (const feature of features) {
    const rates = weeklyByFeature.get(feature.id) ?? []
    const daysSince = feature.lastInteraction
      ? Math.floor((Date.now() - feature.lastInteraction.getTime()) / 86_400_000)
      : null
    const currentRate = rates.length > 0 ? rates[rates.length - 1].rate : 0
    const newState = determineState(currentRate, rates, daysSince, thresholds)
    if (newState !== feature.state) {
      stateChanges.push({ featureId: feature.id, oldState: feature.state, newState })
    }
  }

  if (stateChanges.length === 0) return

  // Query 3: one transaction for all updates
  const today = new Date().toISOString().slice(0, 10)
  await prisma.$transaction([
    ...stateChanges.map(({ featureId, newState }) =>
      prisma.feature.update({ where: { id: featureId }, data: { state: newState } })
    ),
    ...stateChanges.map(({ featureId, oldState, newState }) =>
      prisma.stateTransition.create({
        data: { featureId, oldState, newState, reason: `Automated classification on ${today}` },
      })
    ),
  ])
}
```

- [ ] **Step 4: Run tests**

```bash
cd server && npx jest --forceExit --runInBand classification.test
```

Expected: all PASS

- [ ] **Step 5: Compile check**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add server/src/services/classification.ts server/src/__tests__/classification.test.ts
git commit -m "perf(classification): batch WeeklyAggregate reads; classify all features in 3 DB calls"
```

---

### Task 4: Analytics API endpoint

**Files:**
- Create: `server/src/routes/analytics.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Produces: `GET /api/v1/apps/:appId/analytics` → `AnalyticsResponse`

- [ ] **Step 1: Create server/src/routes/analytics.ts**

```typescript
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth, type AuthRequest } from '../middleware/auth'

export const analyticsRouter = Router()

analyticsRouter.get('/apps/:appId/analytics', jwtAuth, async (req: AuthRequest, res) => {
  const { appId } = req.params
  try {
    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app) return res.status(404).json({ error: 'App not found' })
    if (app.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' })

    const since30 = new Date(Date.now() - 30 * 86_400_000)

    const [features, dauRows, recentAggregates] = await Promise.all([
      prisma.feature.findMany({
        where: { appId },
        select: { id: true, screenName: true, state: true, resourceName: true, lastInteraction: true },
      }),
      prisma.appDailyStats.findMany({
        where: { appId, date: { gte: since30 } },
        orderBy: { date: 'asc' },
        select: { date: true, dailyActiveUsers: true },
      }),
      // Latest interactionRate + uniqueUsers per feature — uses (appId, date) index
      prisma.$queryRaw<{ featureId: string; interactionRate: number; uniqueUsers: number }[]>`
        SELECT DISTINCT ON ("featureId") "featureId", "interactionRate", "uniqueUsers"
        FROM "DailyAggregate"
        WHERE "appId" = ${appId}
        ORDER BY "featureId", "date" DESC
      `,
    ])

    // ── Screen breakdown ────────────────────────────────────────────────────
    const screenMap = new Map<string, { total: number; thriving: number; declining: number; dormant: number; dead: number }>()
    for (const f of features) {
      if (!screenMap.has(f.screenName)) {
        screenMap.set(f.screenName, { total: 0, thriving: 0, declining: 0, dormant: 0, dead: 0 })
      }
      const s = screenMap.get(f.screenName)!
      s.total++
      s[f.state.toLowerCase() as keyof Omit<typeof s, 'total'>]++
    }
    const screenBreakdown = [...screenMap.entries()]
      .map(([screenName, c]) => ({
        screenName, ...c,
        healthPct: Math.round((c.thriving / c.total) * 100),
      }))
      .sort((a, b) => a.healthPct - b.healthPct)

    // ── Top declining features ──────────────────────────────────────────────
    const decliningIds = features.filter(f => f.state === 'DECLINING').map(f => f.id)
    const wowRows = decliningIds.length > 0
      ? await prisma.weeklyAggregate.findMany({
          where: { featureId: { in: decliningIds } },
          orderBy: { weekStart: 'desc' },
        })
      : []

    const wowByFeature = new Map<string, { curr: number; prev: number }>()
    for (const row of wowRows) {
      const e = wowByFeature.get(row.featureId)
      if (!e) wowByFeature.set(row.featureId, { curr: row.avgInteractionRate, prev: 0 })
      else if (e.prev === 0) e.prev = row.avgInteractionRate
    }

    const featureById = new Map(features.map(f => [f.id, f]))
    const topDeclining = decliningIds
      .map(id => {
        const f   = featureById.get(id)!
        const wow = wowByFeature.get(id) ?? { curr: 0, prev: 0 }
        return {
          id: f.id,
          resourceName: f.resourceName,
          screenName: f.screenName,
          state: f.state,
          wowChangePct: wow.prev > 0 ? Math.round(((wow.prev - wow.curr) / wow.prev) * 100) : 0,
          lastInteraction: f.lastInteraction?.toISOString() ?? null,
        }
      })
      .sort((a, b) => b.wowChangePct - a.wowChangePct)
      .slice(0, 10)

    // ── DAU trend ───────────────────────────────────────────────────────────
    const dauTrend = dauRows.map(r => ({
      date: r.date.toISOString().slice(0, 10),
      dailyActiveUsers: r.dailyActiveUsers,
    }))

    // ── Rate histogram ──────────────────────────────────────────────────────
    const buckets: Record<string, number> = { '0-10%': 0, '10-30%': 0, '30-60%': 0, '60-100%': 0 }
    for (const agg of recentAggregates) {
      const pct = agg.interactionRate * 100
      if (pct < 10) buckets['0-10%']++
      else if (pct < 30) buckets['10-30%']++
      else if (pct < 60) buckets['30-60%']++
      else buckets['60-100%']++
    }
    const rateHistogram = Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }))

    // ── Feature reach ───────────────────────────────────────────────────────
    const latestDAU = dauRows.at(-1)?.dailyActiveUsers ?? 1
    const aggByFeature = new Map(recentAggregates.map(r => [r.featureId, r]))
    const featureReach = features
      .map(f => ({
        featureId: f.id,
        resourceName: f.resourceName,
        screenName: f.screenName,
        reachPct: Math.round(((aggByFeature.get(f.id)?.uniqueUsers ?? 0) / latestDAU) * 100),
      }))
      .sort((a, b) => b.reachPct - a.reachPct)
      .slice(0, 10)

    res.json({ screenBreakdown, topDeclining, dauTrend, rateHistogram, featureReach })
  } catch (e) {
    console.error(e)
    res.status(503).json({ error: 'Service unavailable' })
  }
})
```

- [ ] **Step 2: Mount the router in index.ts**

In `server/src/index.ts`, add after the existing imports:
```typescript
import { analyticsRouter } from './routes/analytics'
```

Add after `app.use('/api/v1', dashboardRouter)`:
```typescript
app.use('/api/v1', analyticsRouter)
```

- [ ] **Step 3: Compile check**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 4: Smoke test**

Start the server (`npm run dev`) and run the cron once, then:
```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/apps/<appId>/analytics | jq .
```
Expected: JSON with `screenBreakdown`, `topDeclining`, `dauTrend`, `rateHistogram`, `featureReach` keys.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/analytics.ts server/src/index.ts
git commit -m "feat(api): add GET /apps/:appId/analytics endpoint"
```

---

### Task 5: AI Insights service + endpoint

**Files:**
- Create: `server/src/services/insights.ts`
- Create: `server/src/routes/insights.ts`
- Modify: `server/src/index.ts`
- Modify: `server/src/routes/apps.ts`

**Interfaces:**
- Produces: `GET /api/v1/apps/:appId/insights` → `{ summary, bullets, generatedAt }`
- Consumes: `ANTHROPIC_API_KEY` from env

- [ ] **Step 1: Install Anthropic SDK**

```bash
cd server && npm install @anthropic-ai/sdk
```

Add to `server/.env`:
```
ANTHROPIC_API_KEY=your_key_here
```

- [ ] **Step 2: Create server/src/services/insights.ts**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../db/client'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function generateAndSaveInsights(appId: string): Promise<{
  summary: string
  bullets: string[]
  generatedAt: string
}> {
  const [app, stateCounts, dauRow, topDead, topDeclining] = await Promise.all([
    prisma.app.findUnique({ where: { id: appId }, select: { name: true } }),
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

  const counts: Record<string, number> = {}
  for (const g of stateCounts) counts[g.state] = g._count

  const dataContext = [
    `App: ${app?.name ?? appId}`,
    `Feature counts: ${JSON.stringify(counts)}`,
    `Daily active users (latest): ${dauRow?.dailyActiveUsers ?? 'no data'}`,
    `Dead features: ${topDead.map(f => `${f.resourceName ?? f.screenName} (last used: ${f.lastInteraction?.toISOString().slice(0, 10) ?? 'never'})`).join(', ') || 'none'}`,
    `Declining features: ${topDeclining.map(f => f.resourceName ?? f.screenName).join(', ') || 'none'}`,
  ].join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You are a mobile app analytics assistant. Given feature usage data, respond ONLY with valid JSON matching this shape exactly:
{"summary":"2-3 sentence health overview","bullets":["actionable item 1","actionable item 2","actionable item 3"]}
Use specific feature names from the data. No markdown, no extra text.`,
    messages: [{ role: 'user', content: dataContext }],
  })

  const raw  = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { summary?: string; bullets?: string[] }

  const summary = json.summary ?? 'Unable to generate summary.'
  const bullets = Array.isArray(json.bullets) ? json.bullets : []

  await prisma.appInsight.upsert({
    where: { appId },
    update: { summary, bullets, generatedAt: new Date() },
    create: { appId, summary, bullets },
  })

  return { summary, bullets, generatedAt: new Date().toISOString() }
}
```

- [ ] **Step 3: Create server/src/routes/insights.ts**

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
      return res.json(result)
    }

    // nightly: return stored insight
    const stored = await prisma.appInsight.findUnique({ where: { appId } })
    if (!stored) return res.status(404).json({ error: 'No insights yet — run cron first' })
    res.json({
      summary: stored.summary,
      bullets: stored.bullets as string[],
      generatedAt: stored.generatedAt.toISOString(),
    })
  } catch (e) {
    console.error(e)
    res.status(503).json({ error: 'Service unavailable' })
  }
})
```

- [ ] **Step 4: Mount insights router in index.ts**

Add import:
```typescript
import { insightsRouter } from './routes/insights'
```

Add after `app.use('/api/v1', analyticsRouter)`:
```typescript
app.use('/api/v1', insightsRouter)
```

- [ ] **Step 5: Extend UpdateAppSchema in apps.ts**

In `server/src/routes/apps.ts`, replace `UpdateAppSchema`:
```typescript
const UpdateAppSchema = z.object({
  name:                 z.string().min(1).optional(),
  deadThresholdDays:    z.number().int().min(1).max(365).optional(),
  dormantThresholdDays: z.number().int().min(1).max(365).optional(),
  eventRetentionDays:   z.number().int().min(1).max(365).optional(),
  aiInsightsEnabled:    z.boolean().optional(),
  aiInsightsMode:       z.enum(['nightly', 'on_demand']).optional(),
})
```

Also update the `PATCH` response to include the new fields:
```typescript
res.json({
  id: updated.id, name: updated.name, packageName: updated.packageName,
  apiKey: updated.apiKey, createdAt: updated.createdAt, featureCount: updated._count.features,
  deadThresholdDays:    updated.deadThresholdDays,
  dormantThresholdDays: updated.dormantThresholdDays,
  eventRetentionDays:   updated.eventRetentionDays,
  aiInsightsEnabled:    updated.aiInsightsEnabled,
  aiInsightsMode:       updated.aiInsightsMode,
})
```

- [ ] **Step 6: Add nightly AI insights to cron**

In `server/src/services/aggregation.ts`, update the `runNightlyAggregation` import block and loop:

Add import at top:
```typescript
import { generateAndSaveInsights } from './insights'
```

At the end of the `for (const app of apps)` loop in `runNightlyAggregation`, after the `deleteMany` call:
```typescript
    // Re-fetch to get AI fields (findMany above only selects id + eventRetentionDays)
    const fullApp = await prisma.app.findUnique({
      where: { id: app.id },
      select: { aiInsightsEnabled: true, aiInsightsMode: true },
    })
    if (fullApp?.aiInsightsEnabled && fullApp.aiInsightsMode === 'nightly') {
      await generateAndSaveInsights(app.id).catch(e =>
        console.error(`[Cron] AI insights failed for ${app.id}:`, e)
      )
    }
```

- [ ] **Step 7: Update findMany in runNightlyAggregation to select AI fields directly**

To avoid the extra `findUnique`, replace the `findMany` select:
```typescript
  const apps = await prisma.app.findMany({
    select: { id: true, eventRetentionDays: true, aiInsightsEnabled: true, aiInsightsMode: true },
  })
```

Then in the loop, remove the `fullApp` lookup and replace with:
```typescript
    if (app.aiInsightsEnabled && app.aiInsightsMode === 'nightly') {
      await generateAndSaveInsights(app.id).catch(e =>
        console.error(`[Cron] AI insights failed for ${app.id}:`, e)
      )
    }
```

- [ ] **Step 8: Compile check**

```bash
cd server && npx tsc --noEmit
```

- [ ] **Step 9: Commit**

```bash
git add server/src/services/insights.ts server/src/routes/insights.ts server/src/index.ts server/src/routes/apps.ts server/src/services/aggregation.ts
git commit -m "feat(insights): add AI insights service, endpoint, and nightly cron integration"
```

---

### Task 6: Portal — new chart components

**Files:**
- Create: `portal/src/components/StackedBarChart.tsx`
- Create: `portal/src/components/Histogram.tsx`
- Create: `portal/src/components/ReachBarChart.tsx`
- Create: `portal/src/components/InsightsCard.tsx`

**Interfaces:**
- Produces: four components consumed by Analytics.tsx in Task 7

- [ ] **Step 1: Create StackedBarChart.tsx**

```typescript
interface ScreenRow {
  screenName: string
  thriving: number
  declining: number
  dormant: number
  dead: number
  healthPct: number
}

export default function StackedBarChart({ data }: { data: ScreenRow[] }) {
  const BAR_H  = 22
  const GAP    = 10
  const LABEL_W = 120
  const BAR_W  = 240
  const height = data.length * (BAR_H + GAP) + GAP

  if (data.length === 0) {
    return <p className="text-slate-400 text-center py-6" style={{ fontSize: 13 }}>No screen data yet</p>
  }

  return (
    <svg width={LABEL_W + BAR_W + 44} height={height}>
      {data.map((row, i) => {
        const y     = i * (BAR_H + GAP) + GAP
        const total = row.thriving + row.declining + row.dormant + row.dead || 1
        const thrivW = (row.thriving / total) * BAR_W
        const declW  = ((row.declining + row.dormant) / total) * BAR_W
        const deadW  = (row.dead / total) * BAR_W
        const label  = row.screenName.length > 16 ? row.screenName.slice(0, 15) + '…' : row.screenName
        return (
          <g key={row.screenName}>
            <text x={LABEL_W - 8} y={y + 15} textAnchor="end" fontSize={11} fill="#64748B">{label}</text>
            <rect x={LABEL_W}                    y={y} width={BAR_W} height={BAR_H} rx={3} fill="#F1F5F9" />
            <rect x={LABEL_W}                    y={y} width={thrivW} height={BAR_H} rx={3} fill="#16A34A" />
            <rect x={LABEL_W + thrivW}           y={y} width={declW}  height={BAR_H} fill="#CA8A04" />
            <rect x={LABEL_W + thrivW + declW}   y={y} width={deadW}  height={BAR_H} fill="#DC2626" />
            <text x={LABEL_W + BAR_W + 8} y={y + 15} fontSize={11} fill="#334155" fontWeight="600">
              {row.healthPct}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 2: Create Histogram.tsx**

```typescript
interface HistogramProps {
  data: { bucket: string; count: number }[]
  height?: number
}

export default function Histogram({ data, height = 160 }: HistogramProps) {
  const W         = 320
  const PAD_TOP   = 24
  const PAD_BOT   = 28
  const INNER_H   = height - PAD_TOP - PAD_BOT
  const maxCount  = Math.max(...data.map(d => d.count), 1)
  const slotW     = W / data.length
  const barW      = slotW * 0.55

  return (
    <svg width={W} height={height}>
      {data.map((d, i) => {
        const barH = (d.count / maxCount) * INNER_H
        const x    = i * slotW + (slotW - barW) / 2
        const y    = PAD_TOP + INNER_H - barH
        return (
          <g key={d.bucket}>
            <rect x={x} y={y} width={barW} height={barH || 2} rx={3} fill="#6366F1" opacity={0.85} />
            {d.count > 0 && (
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" fontSize={11} fill="#334155" fontWeight="600">
                {d.count}
              </text>
            )}
            <text x={x + barW / 2} y={height - 6} textAnchor="middle" fontSize={10} fill="#94A3B8">
              {d.bucket}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 3: Create ReachBarChart.tsx**

```typescript
interface ReachRow {
  featureId: string
  resourceName: string | null
  screenName: string
  reachPct: number
}

export default function ReachBarChart({ data }: { data: ReachRow[] }) {
  const BAR_H  = 18
  const GAP    = 8
  const LABEL_W = 110
  const BAR_W  = 140
  const height = data.length * (BAR_H + GAP) + GAP

  if (data.length === 0) {
    return <p className="text-slate-400 text-center py-6" style={{ fontSize: 13 }}>No data yet</p>
  }

  return (
    <svg width={LABEL_W + BAR_W + 44} height={height}>
      {data.map((row, i) => {
        const y      = i * (BAR_H + GAP) + GAP
        const label  = (row.resourceName ?? row.screenName)
        const short  = label.length > 14 ? label.slice(0, 13) + '…' : label
        const filledW = (row.reachPct / 100) * BAR_W
        return (
          <g key={row.featureId}>
            <text x={LABEL_W - 6} y={y + 13} textAnchor="end" fontSize={10.5} fill="#64748B">{short}</text>
            <rect x={LABEL_W} y={y} width={BAR_W} height={BAR_H} rx={3} fill="#E2E8F0" />
            <rect x={LABEL_W} y={y} width={filledW || 1} height={BAR_H} rx={3} fill="#6366F1" />
            <text x={LABEL_W + BAR_W + 6} y={y + 13} fontSize={10.5} fill="#334155" fontWeight="600">
              {row.reachPct}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

- [ ] **Step 4: Create InsightsCard.tsx**

```typescript
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AppInsight } from '../api/client'

interface InsightsCardProps {
  appId: string
  enabled: boolean
  mode: 'nightly' | 'on_demand'
}

export default function InsightsCard({ appId, enabled, mode }: InsightsCardProps) {
  const [data,    setData]    = useState<AppInsight | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try { setData(await api.getInsights(appId)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }

  useEffect(() => { if (enabled) load() }, [appId, enabled])

  if (!enabled) return null

  return (
    <div className="bg-white rounded-card border border-indigo-200 p-6 mb-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>AI Insights</p>
          <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>Powered by Claude</p>
        </div>
        {mode === 'on_demand' && (
          <button onClick={load} disabled={loading}
            className="border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-semibold rounded-lg transition-colors disabled:opacity-50"
            style={{ padding: '5px 12px', fontSize: 12 }}>
            {loading ? 'Generating…' : '↺ Refresh'}
          </button>
        )}
      </div>
      {loading && !data && <p className="text-slate-400" style={{ fontSize: 13 }}>Generating insights…</p>}
      {error   && <p className="text-red-500"   style={{ fontSize: 13 }}>{error}</p>}
      {data && (
        <>
          <p className="text-slate-700 mb-3" style={{ fontSize: 13, lineHeight: 1.65 }}>{data.summary}</p>
          <ul className="flex flex-col gap-1.5">
            {data.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-indigo-500 flex-shrink-0" style={{ fontSize: 13 }}>•</span>
                <span className="text-slate-600" style={{ fontSize: 13 }}>{b}</span>
              </li>
            ))}
          </ul>
          {mode === 'nightly' && (
            <p className="text-slate-300 mt-3" style={{ fontSize: 11 }}>
              Last updated: {new Date(data.generatedAt).toLocaleString()}
            </p>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add portal/src/components/StackedBarChart.tsx portal/src/components/Histogram.tsx portal/src/components/ReachBarChart.tsx portal/src/components/InsightsCard.tsx
git commit -m "feat(portal): add StackedBarChart, Histogram, ReachBarChart, InsightsCard components"
```

---

### Task 7: Portal — API client types + Analytics page + routing

**Files:**
- Modify: `portal/src/api/client.ts`
- Create: `portal/src/pages/Analytics.tsx`
- Modify: `portal/src/App.tsx`
- Modify: `portal/src/components/Layout.tsx`

**Interfaces:**
- Consumes: all four chart components from Task 6, `api.getAnalytics()`, `api.getInsights()`

- [ ] **Step 1: Extend api/client.ts**

Add to the `api` object (after `getTrend`):
```typescript
  getAnalytics: (appId: string) =>
    request<AnalyticsData>(`/apps/${appId}/analytics`),

  getInsights: (appId: string) =>
    request<AppInsight>(`/apps/${appId}/insights`),
```

Add new interfaces at the bottom of the file:
```typescript
export interface AnalyticsScreenRow {
  screenName: string; total: number; thriving: number
  declining: number; dormant: number; dead: number; healthPct: number
}
export interface AnalyticsDecliningRow {
  id: string; resourceName: string | null; screenName: string
  state: string; wowChangePct: number; lastInteraction: string | null
}
export interface AnalyticsData {
  screenBreakdown: AnalyticsScreenRow[]
  topDeclining:    AnalyticsDecliningRow[]
  dauTrend:        { date: string; dailyActiveUsers: number }[]
  rateHistogram:   { bucket: string; count: number }[]
  featureReach:    { featureId: string; resourceName: string | null; screenName: string; reachPct: number }[]
}
export interface AppInsight {
  summary: string; bullets: string[]; generatedAt: string
}
```

Also extend `AppSummary` interface:
```typescript
export interface AppSummary {
  id: string; name: string; packageName: string; apiKey: string
  createdAt: string; featureCount: number
  deadThresholdDays: number; dormantThresholdDays: number; eventRetentionDays: number
  aiInsightsEnabled: boolean   // NEW
  aiInsightsMode: string       // NEW
}
```

- [ ] **Step 2: Create portal/src/pages/Analytics.tsx**

```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { AnalyticsData, Feature } from '../api/client'
import { useApp } from '../context/AppContext'
import StateBadge from '../components/StateBadge'
import LineChart from '../components/LineChart'
import StackedBarChart from '../components/StackedBarChart'
import Histogram from '../components/Histogram'
import ReachBarChart from '../components/ReachBarChart'
import InsightsCard from '../components/InsightsCard'
import { COLORS } from '../design-tokens'

function formatRelativeTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export default function Analytics() {
  const { appId = '' } = useParams<{ appId: string }>()
  const nav = useNavigate()
  const { activeApp } = useApp()
  const [data,  setData]  = useState<AnalyticsData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!appId) { nav('/apps'); return }
    api.getAnalytics(appId)
      .then(setData)
      .catch((e) => setError(e.message))
  }, [appId, nav])

  if (error) return <p className="text-red-600 p-8">{error}</p>
  if (!data)  return <p className="text-slate-400 p-8">Loading…</p>

  const aiEnabled = activeApp?.aiInsightsEnabled ?? false
  const aiMode    = (activeApp?.aiInsightsMode ?? 'nightly') as 'nightly' | 'on_demand'

  return (
    <div>
      <h1 className="text-slate-900 font-extrabold mb-1" style={{ fontSize: 24, letterSpacing: '-0.5px' }}>
        Analytics
      </h1>
      <p className="text-slate-500 mb-6" style={{ fontSize: 13 }}>
        Usage patterns, user distribution, and AI-powered insights.
      </p>

      <InsightsCard appId={appId} enabled={aiEnabled} mode={aiMode} />

      {/* Screen Health */}
      <div className="bg-white rounded-card border border-slate-200 mb-5">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Screen Health</p>
          <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>
            Feature health per screen — sorted worst to best
          </p>
        </div>
        <div className="p-5 overflow-x-auto">
          <StackedBarChart data={data.screenBreakdown} />
          <div className="flex items-center gap-4 mt-3">
            {[['#16A34A', 'Thriving'], ['#CA8A04', 'Declining / Dormant'], ['#DC2626', 'Dead']].map(([color, label]) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="inline-block rounded-sm flex-shrink-0" style={{ width: 10, height: 10, background: color }} />
                <span className="text-slate-500" style={{ fontSize: 11 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Declining */}
      <div className="bg-white rounded-card border border-slate-200 mb-5">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Top Declining Features</p>
          <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>Ranked by week-over-week interaction rate drop</p>
        </div>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {['Feature', 'Screen', 'State', 'WoW Drop', 'Last Interaction'].map(h => (
                <th key={h} className="text-left text-slate-400 font-bold uppercase"
                  style={{ padding: '8px 20px', fontSize: 10, letterSpacing: '0.07em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.topDeclining.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>
                  No declining features — looking good!
                </td>
              </tr>
            )}
            {data.topDeclining.map(f => (
              <tr key={f.id} onClick={() => nav(`/apps/${appId}/features/${f.id}`)}
                className="border-b border-slate-50 last:border-none hover:bg-slate-50 cursor-pointer transition-colors">
                <td style={{ padding: '11px 20px' }}>
                  <span className="font-mono text-slate-800" style={{ fontSize: 11.5 }}>
                    {f.resourceName ?? '(unnamed)'}
                  </span>
                </td>
                <td className="text-slate-500" style={{ padding: '11px 20px', fontSize: 12 }}>{f.screenName}</td>
                <td style={{ padding: '11px 20px' }}>
                  <StateBadge state={f.state as Feature['state']} />
                </td>
                <td style={{ padding: '11px 20px' }}>
                  <span className="font-bold text-red-600" style={{ fontSize: 12 }}>▼ {f.wowChangePct}%</span>
                </td>
                <td className="text-slate-400" style={{ padding: '11px 20px', fontSize: 11.5 }}>
                  {f.lastInteraction ? formatRelativeTime(f.lastInteraction) : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Metrics */}
      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="bg-white rounded-card border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Daily Active Users</p>
            <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>Unique users per day — last 30 days</p>
          </div>
          <div className="p-5">
            {data.dauTrend.length > 0 ? (
              <LineChart
                labels={data.dauTrend.map(r => new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}
                data={data.dauTrend.map(r => r.dailyActiveUsers)}
                color={COLORS.indigo}
                height={160}
              />
            ) : (
              <p className="text-center text-slate-400 py-8" style={{ fontSize: 13 }}>No data yet — run cron first</p>
            )}
          </div>
        </div>
        <div className="bg-white rounded-card border border-slate-200">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Feature Reach</p>
            <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>% of daily users who touched each feature</p>
          </div>
          <div className="p-5">
            <ReachBarChart data={data.featureReach} />
          </div>
        </div>
      </div>

      {/* Rate Distribution */}
      <div className="bg-white rounded-card border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <p className="text-slate-900 font-bold" style={{ fontSize: 13.5 }}>Interaction Rate Distribution</p>
          <p className="text-slate-400 mt-0.5" style={{ fontSize: 11.5 }}>
            How many features fall into each engagement tier
          </p>
        </div>
        <div className="p-5">
          <Histogram data={data.rateHistogram} height={160} />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Add route in App.tsx**

Open `portal/src/App.tsx`. Find where the other app-scoped routes are declared (e.g. the `features/:id` route) and add:
```tsx
<Route path="analytics" element={<Analytics />} />
```

Also add the import at the top:
```tsx
import Analytics from './pages/Analytics'
```

- [ ] **Step 4: Add nav link in Layout.tsx**

In `portal/src/components/Layout.tsx`, add a chart icon (after `ClockIcon`):

```typescript
const ChartIcon: FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="1" y="8" width="3" height="6" rx="0.5" />
    <rect x="6" y="5" width="3" height="9" rx="0.5" />
    <rect x="11" y="2" width="3" height="12" rx="0.5" />
  </svg>
)
```

In the `PAGE_LABELS` object, add:
```typescript
  'analytics': 'Analytics',
```

In the `ANALYTICS_PAGES` set in `Topbar`, add `'analytics'`:
```typescript
const ANALYTICS_PAGES = new Set(['dashboard', 'features', 'transitions', 'analytics'])
```

In the `Sidebar` nav, add after the Transitions `NavItem`:
```tsx
<NavItem to={hasApp ? `/apps/${effectiveAppId}/analytics` : '#'} label="Analytics" Icon={ChartIcon} disabled={!hasApp} />
```

- [ ] **Step 5: Compile check**

```bash
cd portal && npx tsc --noEmit
```

Fix any type errors before continuing.

- [ ] **Step 6: Commit**

```bash
git add portal/src/api/client.ts portal/src/pages/Analytics.tsx portal/src/App.tsx portal/src/components/Layout.tsx
git commit -m "feat(portal): add Analytics page with screen health, declining table, DAU, reach, histogram, and AI insights"
```

---

### Task 8: Settings page — AI Insights section

**Files:**
- Modify: `portal/src/pages/Settings.tsx`

**Interfaces:**
- Consumes: `api.updateAppSettings()` (already accepts `aiInsightsEnabled`, `aiInsightsMode` after Task 5)
- Consumes: `activeApp.aiInsightsEnabled`, `activeApp.aiInsightsMode` (available after Task 7's AppSummary extension)

- [ ] **Step 1: Add AI Insights section to Settings.tsx**

Add new state variables after the existing state declarations (line ~147):
```typescript
  const [aiEnabled,   setAiEnabled]   = useState(activeApp?.aiInsightsEnabled ?? false)
  const [aiMode,      setAiMode]      = useState<'nightly' | 'on_demand'>(
    (activeApp?.aiInsightsMode ?? 'nightly') as 'nightly' | 'on_demand'
  )
  const [aiSaved,     setAiSaved]     = useState(false)
  const [aiSaving,    setAiSaving]    = useState(false)
```

Add save handler after `saveRetention`:
```typescript
  async function saveAiSettings() {
    setAiSaving(true)
    try {
      await api.updateAppSettings(activeApp!.id, { aiInsightsEnabled: aiEnabled, aiInsightsMode: aiMode })
      await reloadApps()
      setAiSaved(true)
      setTimeout(() => setAiSaved(false), 2000)
    } catch {}
    finally { setAiSaving(false) }
  }
```

Add the new card in the JSX, after the Data Retention card and before `<RenameDeleteCard>`:
```tsx
      {/* AI Insights */}
      <div className="bg-white rounded-card border border-slate-200 p-6 mb-5">
        <h2 className="text-slate-900 font-bold mb-1" style={{ fontSize: 14 }}>AI Insights</h2>
        <p className="text-slate-400 mb-5" style={{ fontSize: 12 }}>
          When enabled, Claude analyses your app's feature data and generates a health summary with actionable recommendations.
        </p>
        <div className="flex items-center justify-between mb-4">
          <p className="text-slate-800 font-semibold" style={{ fontSize: 13 }}>Enable AI Insights</p>
          <button
            onClick={() => setAiEnabled(e => !e)}
            className={`relative inline-flex items-center rounded-full transition-colors flex-shrink-0 ${
              aiEnabled ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
            style={{ width: 40, height: 22 }}
          >
            <span
              className="inline-block bg-white rounded-full shadow transition-transform"
              style={{ width: 16, height: 16, margin: 3, transform: aiEnabled ? 'translateX(18px)' : 'translateX(0)' }}
            />
          </button>
        </div>
        {aiEnabled && (
          <div className="flex flex-col gap-2 mb-4 pl-1">
            <p className="text-slate-600 font-semibold mb-1" style={{ fontSize: 12.5 }}>Generate insights:</p>
            {(['nightly', 'on_demand'] as const).map(m => (
              <label key={m} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="radio" name="aiMode" value={m} checked={aiMode === m}
                  onChange={() => setAiMode(m)}
                  className="accent-indigo-600"
                />
                <span className="text-slate-700" style={{ fontSize: 13 }}>
                  {m === 'nightly' ? 'Nightly — pre-computed by cron, instant load' : 'On-demand — fresh each time you open Analytics'}
                </span>
              </label>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={saveAiSettings} disabled={aiSaving}
            className="bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
            style={{ padding: '8px 18px', fontSize: 13 }}
          >
            {aiSaving ? 'Saving…' : 'Save'}
          </button>
          {aiSaved && <span className="text-green-600 font-medium" style={{ fontSize: 13 }}>✓ Saved</span>}
        </div>
      </div>
```

- [ ] **Step 2: Compile check**

```bash
cd portal && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add portal/src/pages/Settings.tsx
git commit -m "feat(settings): add AI Insights toggle and mode selector"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Add `appId` to DailyAggregate + composite index | Task 1 |
| `AppDailyStats` model | Task 1 |
| `WeeklyAggregate` model | Task 1 |
| `AppInsight` + App AI fields | Task 1 |
| Batch SQL aggregation (N+1 → 1) | Task 2 |
| WeeklyAggregate upsert in cron | Task 2 |
| Classification reads WeeklyAggregate | Task 3 |
| Batch state updates in transaction | Task 3 |
| `GET /analytics` endpoint | Task 4 |
| Screen breakdown | Task 4 |
| Top declining features with WoW % | Task 4 |
| DAU trend | Task 4 |
| Rate histogram | Task 4 |
| Feature reach % | Task 4 |
| Anthropic SDK + insights service | Task 5 |
| `GET /insights` endpoint | Task 5 |
| Nightly cron integration for insights | Task 5 |
| Extend `PATCH /apps/:appId` schema | Task 5 |
| StackedBarChart component | Task 6 |
| Histogram component | Task 6 |
| ReachBarChart component | Task 6 |
| InsightsCard component | Task 6 |
| Analytics page with all 4 sections | Task 7 |
| Analytics nav link | Task 7 |
| `/apps/:appId/analytics` route | Task 7 |
| Settings AI section (toggle + mode) | Task 8 |

**No gaps found.**

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete.

**Type consistency:** `AnalyticsData`, `AppInsight`, `AnalyticsScreenRow`, `AnalyticsDecliningRow` defined in Task 7 and consumed consistently. `AppSummary.aiInsightsEnabled/aiInsightsMode` added in Task 7, consumed in Task 8.
