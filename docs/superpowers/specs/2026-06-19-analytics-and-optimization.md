# Analytics, AI Insights & DB Optimization — Design Spec

**Date:** 2026-06-19
**Scope:** Two pillars driven by instructor feedback: (1) demonstrable DB/query optimization, (2) richer analytics dashboard with AI-powered insights and user distribution metrics.

---

## Background

The instructor's grading criteria include:
- Optimization of data pulling, storage, and query efficiency
- More visual insights on the dashboard: actual analytics, charts, tables, user distribution
- AI/LLM integration for insights

The current system has two concrete performance problems:
1. `aggregation.ts` runs a classic N+1: one query to get featureIds, then one query per feature to fetch raw events. 100 features = 101 DB round-trips per cron run.
2. `classifyAllFeatures` loops per feature making 2 DB calls each (~200 calls for 100 features).
3. `DailyAggregate` has no `appId` column — trend queries join through `Feature` to filter by app.

The current dashboard has limited analytics: 4 stat cards, one avg interaction rate line chart, a state distribution donut, recent state changes, dead features list. There are no user metrics, no per-screen breakdown, no declining feature rankings.

---

## Pillar 1: DB & Query Optimization

### Schema Changes

**`DailyAggregate` — add `appId`**

```prisma
model DailyAggregate {
  featureId       String
  appId           String          // NEW — denormalized for direct index
  date            DateTime @db.Date
  impressions     Int      @default(0)
  interactions    Int      @default(0)
  uniqueUsers     Int      @default(0)
  interactionRate Float    @default(0.0)
  feature         Feature  @relation(fields: [featureId], references: [id], onDelete: Cascade)
  app             App      @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@id([featureId, date])
  @@index([date])
  @@index([appId, date])   // NEW — enables direct app-level aggregate queries
}
```

**New: `AppDailyStats`**

App-level daily rollup. Powers DAU trend chart and feature reach % calculation.

```prisma
model AppDailyStats {
  appId             String
  date              DateTime @db.Date
  dailyActiveUsers  Int      @default(0)   // COUNT(DISTINCT deviceId) across all features
  totalImpressions  Int      @default(0)
  totalInteractions Int      @default(0)
  app               App      @relation(fields: [appId], references: [id], onDelete: Cascade)

  @@id([appId, date])
  @@index([appId, date])
}
```

**New: `WeeklyAggregate`**

Precomputed weekly interaction rates. Powers fast classification — replaces the current approach of fetching 28 daily rows and bucketing in memory on every cron run.

```prisma
model WeeklyAggregate {
  featureId          String
  weekStart          DateTime          // Monday 00:00 UTC of the ISO week
  avgInteractionRate Float    @default(0.0)
  totalInteractions  Int      @default(0)
  totalImpressions   Int      @default(0)
  uniqueUsers        Int      @default(0)
  feature            Feature  @relation(fields: [featureId], references: [id], onDelete: Cascade)

  @@id([featureId, weekStart])
  @@index([featureId, weekStart])
}
```

> Note: the `Feature` model also needs `weeklyAggregates WeeklyAggregate[]` and `appDailyStats` needs `AppDailyStats[]` on `App` added as relation fields in `schema.prisma` for Prisma to generate the correct client.

```prisma
```

**`App` — add AI Insights config fields**

```prisma
aiInsightsEnabled  Boolean  @default(false)
aiInsightsMode     String   @default("nightly")   // "nightly" | "on_demand"
```

**New: `AppInsight`**

Stores the last LLM-generated insight so the dashboard reads it instantly.

```prisma
model AppInsight {
  appId       String   @id
  summary     String
  bullets     Json     // String[]
  generatedAt DateTime @default(now())
  app         App      @relation(fields: [appId], references: [id], onDelete: Cascade)
}
```

---

### Aggregation Refactor (`aggregation.ts`)

**Problem:** Current code runs `groupBy featureId` then loops, fetching all events per feature individually.

**Fix:** Replace the loop with a single raw SQL query per app:

```sql
SELECT
  "featureId",
  COUNT(*) FILTER (WHERE "eventType" = 'IMPRESSION')  AS impressions,
  COUNT(*) FILTER (WHERE "eventType" != 'IMPRESSION') AS interactions,
  COUNT(DISTINCT "deviceId")                           AS "uniqueUsers"
FROM "RawEvent"
WHERE "appId" = $1
  AND "timestamp" >= $2
  AND "timestamp" < $3
GROUP BY "featureId"
```

One round-trip replaces N+1. The same cron run:
1. Upserts `DailyAggregate` rows (with `appId` populated)
2. Upserts `AppDailyStats` for the day (SUM of per-feature uniqueUsers via a separate `COUNT(DISTINCT deviceId)` query scoped to the whole app)
3. Upserts `WeeklyAggregate` for the current ISO week (rolling sum — if the week row already exists, add to it)

---

### Classification Refactor (`classification.ts`)

**Problem:** `classifyAllFeatures` loops per feature — 2 DB calls each (dailyAggregates + feature lookup).

**Fix:**
1. Fetch all features for the app in one query
2. Fetch all `WeeklyAggregate` rows for those features in one query (last N weeks)
3. Classify every feature in memory using the precomputed weekly rates
4. Collect all state changes, write them in a single `prisma.$transaction`

Result: ~3 DB round-trips total regardless of feature count, down from ~200 for 100 features.

`classifyFeature` is updated to accept weekly rates as a parameter (already computed) rather than fetching from DB itself — making it fully pure and testable.

---

### Cron Order (`nightly.ts`)

For each app:
1. Raw SQL aggregation → upsert `DailyAggregate` + `AppDailyStats` + `WeeklyAggregate`
2. Batch classification from `WeeklyAggregate` → batch state transition writes
3. Raw event TTL cleanup (`RawEvent` older than `eventRetentionDays`)
4. If `aiInsightsEnabled && aiInsightsMode === 'nightly'` → generate and save `AppInsight`

---

## Pillar 2: Analytics Page & AI Insights

### New Route

`/apps/:appId/analytics` — added to the router. New "Analytics" nav link in the sidebar between Features and Alerts.

---

### New API Endpoint: `GET /api/v1/apps/:appId/analytics`

Returns all analytics data in one response to minimize round-trips:

```ts
{
  screenBreakdown: {
    screenName: string
    total: number
    thriving: number
    declining: number
    dormant: number
    dead: number
    healthPct: number   // thriving / total * 100
  }[]

  topDeclining: {
    id: string
    resourceName: string | null
    screenName: string
    state: string
    wowChangePct: number   // (prevWeekRate - currWeekRate) / prevWeekRate * 100, negative = drop
    lastInteraction: string | null
  }[]  // top 10, sorted by steepest WoW drop

  dauTrend: {
    date: string
    dailyActiveUsers: number
  }[]  // last 30 days from AppDailyStats

  rateHistogram: {
    bucket: '0-10%' | '10-30%' | '30-60%' | '60-100%'
    count: number
  }[]  // features bucketed by latest interactionRate

  featureReach: {
    featureId: string
    resourceName: string | null
    screenName: string
    reachPct: number   // uniqueUsers / appDAU for most recent day * 100
  }[]  // top 10 by reach %
}
```

All sub-queries use the new indexes: `(appId, date)` on `DailyAggregate` and `AppDailyStats`, `(appId, state)` on `Feature`.

---

### New API Endpoint: `GET /api/v1/apps/:appId/insights`

- If `aiInsightsEnabled = false`: returns 404
- If `aiInsightsMode = nightly`: returns stored `AppInsight` (instant read)
- If `aiInsightsMode = on_demand`: fetches app stats, calls Anthropic Claude API, saves result to `AppInsight`, returns it

**LLM prompt structure:**

The server builds a compact data summary (feature counts by state, top declining features, DAU, screen health) and sends it to Claude with a system prompt asking for:
- One short paragraph summary of the app's health
- 3 actionable bullet points (specific feature names and recommended actions)

Model: `claude-haiku-4-5-20251001` — fast and cheap for this summarization task.

`ANTHROPIC_API_KEY` lives in `server/.env`. Never exposed to the portal. No user-facing API key entry.

**Settings endpoint extension:**

`PATCH /api/v1/apps/:appId` Zod schema extended to accept `aiInsightsEnabled?: boolean` and `aiInsightsMode?: 'nightly' | 'on_demand'`.

---

### Analytics Page Layout

Four sections, rendered top to bottom:

**1. Screen Health**
Horizontal stacked bar chart (`StackedBarChart.tsx`). One row per screen. Bar divided into green (% thriving) / yellow (% declining + dormant) / red (% dead). Screen name on left, percentage labels on right. Data from `screenBreakdown`.

**2. Top Declining Features**
Table with columns: Feature (monospace resource name), Screen, State badge, WoW Change (e.g. `▼ 43%` in red), Last Interaction. Top 10 rows sorted by steepest drop. Rows are clickable → navigate to FeatureDetail. Data from `topDeclining`.

**3. User Metrics — two cards side by side**
- **DAU Trend** (left): reuses `LineChart`, 30 days, Y-axis = daily active users. Data from `dauTrend`.
- **Feature Reach** (right): horizontal bar chart (`ReachBarChart.tsx`), top 10 features, X-axis = reach %. Data from `featureReach`.

**4. Interaction Rate Distribution**
Vertical bar chart / histogram (`Histogram.tsx`). 4 buckets: 0–10%, 10–30%, 30–60%, 60–100%. Y-axis = feature count. Shows at a glance whether the app has broadly engaged features or most are ignored. Data from `rateHistogram`.

**5. AI Insights Card (`InsightsCard.tsx`)**
Appears at the top of the Analytics page. Exact visual design to be determined by the developer. Functional contract:
- On mount: calls `GET /apps/:appId/insights`
- Shows loading state while fetching
- Renders `summary` as a paragraph and `bullets` as a bulleted list
- On-demand mode: shows a "Refresh" button that re-triggers the endpoint
- Nightly mode: shows "Last updated X time ago" from `generatedAt`
- If AI insights disabled: card is hidden

---

### Settings Page Extension

New "AI Insights" section added to the existing Settings page, same visual pattern as the existing threshold/retention sections:

```
AI Insights
────────────────────────────────────────────
Enable AI Insights                [toggle]

Generate insights:
  ● On-demand  (fresh each time you open Analytics)
  ○ Nightly    (pre-computed by cron, instant load)

  (radio group only visible when toggle is ON)
────────────────────────────────────────────
                                      [Save]
```

Saved via the extended `PATCH /apps/:appId` endpoint.

---

### New Components

| Component | Purpose |
|-----------|---------|
| `StackedBarChart.tsx` | Horizontal stacked bars for screen health |
| `Histogram.tsx` | Vertical bars for rate distribution |
| `ReachBarChart.tsx` | Horizontal bars for feature reach % |
| `InsightsCard.tsx` | AI insights panel shell (visual TBD) |

Existing `LineChart.tsx` reused for DAU trend — no changes needed.

---

## What This Demonstrates to the Instructor

**Optimization:**
- N+1 → single raw SQL (aggregation): measurable reduction from O(n) queries to O(1)
- N*2 → batch + in-memory (classification): measurable reduction from O(n) queries to O(3)
- Schema denormalization (`appId` on `DailyAggregate`) with explicit composite index: eliminates join in the hot trend query path
- `WeeklyAggregate` precomputation: moves CPU work from query time to cron time

**Analytics depth:**
- Per-screen health breakdown
- WoW declining feature ranking
- App-level DAU trend
- Feature reach % (user distribution)
- Interaction rate histogram (distribution shape)
- AI-generated natural language summary + actionable bullets

**Storage efficiency:**
- Raw events still purged after `eventRetentionDays` (unchanged)
- `AppDailyStats` and `WeeklyAggregate` are small, bounded tables (one row per app/day, one per feature/week)
- `AppInsight` is one row per app — no unbounded growth
