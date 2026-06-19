import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const prisma = new PrismaClient()

// ---------- helpers ----------

function fid(screen: string, resource: string) {
  return crypto.createHash('sha256').update(screen + resource).digest('hex')
}

function freshApiKey() {
  return 'fp_' + crypto.randomBytes(24).toString('hex')
}

function daysAgo(n: number, hour = 2) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

// ---------- aggregate generators ----------

type AggRow = {
  featureId: string
  appId: string
  date: Date
  impressions: number
  interactions: number
  uniqueUsers: number
  interactionRate: number
}

function thrivingAggregates(featureId: string, appId: string, days = 60): AggRow[] {
  return Array.from({ length: days }, (_, i) => {
    const impressions = rand(600, 2200)
    const rate = (rand(80, 150) / 1000)   // 8–15%
    const interactions = Math.round(impressions * rate)
    return {
      featureId,
      appId,
      date: daysAgo(days - i),
      impressions,
      interactions,
      uniqueUsers: Math.round(interactions * rand(70, 90) / 100),
      interactionRate: rate,
    }
  })
}

function decliningAggregates(featureId: string, appId: string, days = 60): AggRow[] {
  return Array.from({ length: days }, (_, i) => {
    const progress = i / days                          // 0 → 1 over time
    const impressions = rand(300, 1400)
    const rate = clamp(0.1 - progress * 0.096, 0.004, 0.1) // 10% → 0.4%
    const interactions = Math.round(impressions * rate)
    return {
      featureId,
      appId,
      date: daysAgo(days - i),
      impressions,
      interactions,
      uniqueUsers: Math.round(interactions * rand(65, 85) / 100),
      interactionRate: rate,
    }
  })
}

function dormantAggregates(featureId: string, appId: string, days = 60): AggRow[] {
  return Array.from({ length: days }, (_, i) => {
    const impressions = rand(150, 700)
    const rate = clamp(0.008 - (i / days) * 0.006, 0.001, 0.008) // slow taper, always <1%
    const interactions = i < 30 ? rand(0, 4) : rand(0, 2)
    return {
      featureId,
      appId,
      date: daysAgo(days - i),
      impressions,
      interactions,
      uniqueUsers: Math.min(interactions, rand(0, 2)),
      interactionRate: rate,
    }
  })
}

function deadAggregates(featureId: string, appId: string, days = 60): AggRow[] {
  return Array.from({ length: days }, (_, i) => {
    const daysFromNow = days - i
    const impressions = daysFromNow > 35 ? rand(80, 400) : rand(20, 100)
    return {
      featureId,
      appId,
      date: daysAgo(days - i),
      impressions,
      interactions: 0,
      uniqueUsers: 0,
      interactionRate: 0,
    }
  })
}

// ---------- derived-aggregate helpers ----------

/** Returns the Monday of the ISO week containing `date`, at midnight UTC. */
function isoWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay() // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

/** Inserts AppDailyStats rows derived from an array of DailyAggregate rows for one app. */
async function seedAppDailyStats(appId: string, rows: AggRow[]) {
  // Group by date string
  const byDate = new Map<string, AggRow[]>()
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(r)
  }

  const stats = Array.from(byDate.entries()).map(([, dayRows]) => {
    const totalImpressions  = dayRows.reduce((s, r) => s + r.impressions,  0)
    const totalInteractions = dayRows.reduce((s, r) => s + r.interactions, 0)
    // derive DAU from the sum of uniqueUsers, capped at a realistic range
    const derivedDAU = Math.max(50, Math.min(200, dayRows.reduce((s, r) => s + r.uniqueUsers, 0)))
    return {
      appId,
      date:              dayRows[0].date,
      dailyActiveUsers:  derivedDAU,
      totalImpressions,
      totalInteractions,
    }
  })

  await prisma.appDailyStats.createMany({ data: stats })
}

/** Inserts WeeklyAggregate rows derived from an array of DailyAggregate rows for one feature. */
async function seedWeeklyAggregates(featureId: string, rows: AggRow[]) {
  // Group by ISO week start (as ISO string key)
  const byWeek = new Map<string, AggRow[]>()
  for (const r of rows) {
    const ws = isoWeekStart(r.date)
    const key = ws.toISOString()
    if (!byWeek.has(key)) byWeek.set(key, [])
    byWeek.get(key)!.push(r)
  }

  const weeks = Array.from(byWeek.entries()).map(([weekKey, weekRows]) => {
    const totalImpressions  = weekRows.reduce((s, r) => s + r.impressions,  0)
    const totalInteractions = weekRows.reduce((s, r) => s + r.interactions, 0)
    const avgInteractionRate =
      weekRows.reduce((s, r) => s + r.interactionRate, 0) / weekRows.length
    const uniqueUsers = Math.max(...weekRows.map(r => r.uniqueUsers))
    return {
      featureId,
      weekStart:          new Date(weekKey),
      avgInteractionRate,
      totalInteractions,
      totalImpressions,
      uniqueUsers,
    }
  })

  await prisma.weeklyAggregate.createMany({ data: weeks })
}

// ---------- main ----------

const EMAIL = process.argv[2] ?? 'demo@featurepulse.dev'
const PASSWORD = 'demo1234'

async function main() {
  console.log(`Seeding for: ${EMAIL}`)

  // Upsert user
  let user = await prisma.user.findUnique({ where: { email: EMAIL } })
  if (!user) {
    user = await prisma.user.create({
      data: { email: EMAIL, passwordHash: await bcrypt.hash(PASSWORD, 10) },
    })
    console.log(`Created user ${EMAIL} / ${PASSWORD}`)
  }

  // Remove existing seed apps so re-running is safe
  await prisma.app.deleteMany({
    where: { userId: user.id, name: { in: ['ShopMate Pro', 'FitTrack'] } },
  })

  // ─── App 1: ShopMate Pro ───────────────────────────────────────────────────
  const shopKey = freshApiKey()
  const shop = await prisma.app.create({
    data: {
      name: 'ShopMate Pro',
      packageName: 'com.shopmate.pro',
      apiKey: shopKey,
      apiKeyHash: shopKey,
      userId: user.id,
      createdAt: daysAgo(62),
    },
  })

  const shopFeatures: Array<{
    screen: string; resource: string; state: string
    lastInteraction: Date | null; firstSeen: Date
  }> = [
    { screen: 'HomeScreen',     resource: 'btn_search',        state: 'THRIVING',  lastInteraction: daysAgo(0),  firstSeen: daysAgo(60) },
    { screen: 'HomeScreen',     resource: 'carousel_categories',state: 'THRIVING',  lastInteraction: daysAgo(0),  firstSeen: daysAgo(60) },
    { screen: 'HomeScreen',     resource: 'banner_promo',       state: 'DECLINING', lastInteraction: daysAgo(2),  firstSeen: daysAgo(60) },
    { screen: 'ProductScreen',  resource: 'btn_add_to_cart',    state: 'THRIVING',  lastInteraction: daysAgo(0),  firstSeen: daysAgo(58) },
    { screen: 'ProductScreen',  resource: 'btn_wishlist',       state: 'DECLINING', lastInteraction: daysAgo(3),  firstSeen: daysAgo(57) },
    { screen: 'ProductScreen',  resource: 'btn_share',          state: 'DORMANT',   lastInteraction: daysAgo(17), firstSeen: daysAgo(55) },
    { screen: 'CartScreen',     resource: 'btn_checkout',       state: 'THRIVING',  lastInteraction: daysAgo(0),  firstSeen: daysAgo(58) },
    { screen: 'CartScreen',     resource: 'field_promo_code',   state: 'DORMANT',   lastInteraction: daysAgo(20), firstSeen: daysAgo(54) },
    { screen: 'ProfileScreen',  resource: 'toggle_notifications',state: 'DEAD',     lastInteraction: null,        firstSeen: daysAgo(55) },
    { screen: 'ProfileScreen',  resource: 'toggle_dark_mode',   state: 'DEAD',      lastInteraction: null,        firstSeen: daysAgo(50) },
    { screen: 'OnboardingScreen',resource:'btn_skip',           state: 'DEAD',      lastInteraction: null,        firstSeen: daysAgo(60) },
    { screen: 'SearchScreen',   resource: 'btn_voice_search',   state: 'DORMANT',   lastInteraction: daysAgo(22), firstSeen: daysAgo(48) },
  ]

  const shopAllRows: AggRow[] = []

  for (const f of shopFeatures) {
    const id = fid(f.screen, f.resource)
    await prisma.feature.create({
      data: {
        id,
        appId: shop.id,
        elementType: 'View',
        resourceName: f.resource,
        screenName: f.screen,
        state: f.state,
        firstSeen: f.firstSeen,
        lastInteraction: f.lastInteraction,
      },
    })

    const aggFn = f.state === 'THRIVING' ? thrivingAggregates
      : f.state === 'DECLINING' ? decliningAggregates
      : f.state === 'DORMANT'   ? dormantAggregates
      : deadAggregates

    const rows = aggFn(id, shop.id)
    await prisma.dailyAggregate.createMany({ data: rows })
    shopAllRows.push(...rows)
    await seedWeeklyAggregates(id, rows)

    // State transitions
    if (f.state === 'THRIVING') {
      await prisma.stateTransition.create({ data: { featureId: id, oldState: null, newState: 'THRIVING', changedAt: daysAgo(59), reason: 'Feature first seen' } })
    } else if (f.state === 'DECLINING') {
      await prisma.stateTransition.createMany({ data: [
        { featureId: id, oldState: null,         newState: 'THRIVING',  changedAt: daysAgo(59), reason: 'Feature first seen' },
        { featureId: id, oldState: 'THRIVING',   newState: 'DECLINING', changedAt: daysAgo(22), reason: 'Interaction rate fell below 2% for 7 days' },
      ]})
    } else if (f.state === 'DORMANT') {
      await prisma.stateTransition.createMany({ data: [
        { featureId: id, oldState: null,         newState: 'THRIVING',  changedAt: daysAgo(54), reason: 'Feature first seen' },
        { featureId: id, oldState: 'THRIVING',   newState: 'DECLINING', changedAt: daysAgo(32), reason: 'Interaction rate fell below 2% for 7 days' },
        { featureId: id, oldState: 'DECLINING',  newState: 'DORMANT',   changedAt: daysAgo(16), reason: 'Interaction rate below 1% for 14 days' },
      ]})
    } else {
      await prisma.stateTransition.createMany({ data: [
        { featureId: id, oldState: null,         newState: 'THRIVING',  changedAt: daysAgo(55), reason: 'Feature first seen' },
        { featureId: id, oldState: 'THRIVING',   newState: 'DECLINING', changedAt: daysAgo(45), reason: 'Interaction rate fell below 2% for 7 days' },
        { featureId: id, oldState: 'DECLINING',  newState: 'DORMANT',   changedAt: daysAgo(33), reason: 'Interaction rate below 1% for 14 days' },
        { featureId: id, oldState: 'DORMANT',    newState: 'DEAD',      changedAt: daysAgo(5),  reason: 'Zero interactions for 30 days' },
      ]})
    }
  }

  await seedAppDailyStats(shop.id, shopAllRows)
  console.log(`✓ ShopMate Pro — ${shopFeatures.length} features`)

  // ─── App 2: FitTrack ──────────────────────────────────────────────────────
  const fitKey = freshApiKey()
  const fit = await prisma.app.create({
    data: {
      name: 'FitTrack',
      packageName: 'com.fittrack.app',
      apiKey: fitKey,
      apiKeyHash: fitKey,
      userId: user.id,
      createdAt: daysAgo(50),
    },
  })

  const fitFeatures: Array<{
    screen: string; resource: string; state: string
    lastInteraction: Date | null; firstSeen: Date
  }> = [
    { screen: 'DashboardScreen', resource: 'btn_start_workout',  state: 'THRIVING',  lastInteraction: daysAgo(0),  firstSeen: daysAgo(49) },
    { screen: 'DashboardScreen', resource: 'ring_weekly_goal',   state: 'THRIVING',  lastInteraction: daysAgo(0),  firstSeen: daysAgo(49) },
    { screen: 'DashboardScreen', resource: 'card_nutrition',     state: 'DECLINING', lastInteraction: daysAgo(1),  firstSeen: daysAgo(48) },
    { screen: 'WorkoutScreen',   resource: 'btn_pause',          state: 'THRIVING',  lastInteraction: daysAgo(0),  firstSeen: daysAgo(47) },
    { screen: 'WorkoutScreen',   resource: 'card_heart_rate',    state: 'DECLINING', lastInteraction: daysAgo(2),  firstSeen: daysAgo(46) },
    { screen: 'WorkoutScreen',   resource: 'ctrl_music',         state: 'DORMANT',   lastInteraction: daysAgo(18), firstSeen: daysAgo(45) },
    { screen: 'HistoryScreen',   resource: 'btn_export',         state: 'DEAD',      lastInteraction: null,        firstSeen: daysAgo(44) },
    { screen: 'HistoryScreen',   resource: 'btn_share',          state: 'DORMANT',   lastInteraction: daysAgo(15), firstSeen: daysAgo(43) },
    { screen: 'SettingsScreen',  resource: 'toggle_biometrics',  state: 'THRIVING',  lastInteraction: daysAgo(1),  firstSeen: daysAgo(42) },
    { screen: 'SettingsScreen',  resource: 'widget_customizer',  state: 'DEAD',      lastInteraction: null,        firstSeen: daysAgo(40) },
  ]

  const fitAllRows: AggRow[] = []

  for (const f of fitFeatures) {
    const id = fid(f.screen, f.resource)
    await prisma.feature.create({
      data: {
        id,
        appId: fit.id,
        elementType: 'View',
        resourceName: f.resource,
        screenName: f.screen,
        state: f.state,
        firstSeen: f.firstSeen,
        lastInteraction: f.lastInteraction,
      },
    })

    const aggFn = f.state === 'THRIVING' ? thrivingAggregates
      : f.state === 'DECLINING' ? decliningAggregates
      : f.state === 'DORMANT'   ? dormantAggregates
      : deadAggregates

    const rows = aggFn(id, fit.id)
    await prisma.dailyAggregate.createMany({ data: rows })
    fitAllRows.push(...rows)
    await seedWeeklyAggregates(id, rows)

    if (f.state === 'THRIVING') {
      await prisma.stateTransition.create({ data: { featureId: id, oldState: null, newState: 'THRIVING', changedAt: daysAgo(48), reason: 'Feature first seen' } })
    } else if (f.state === 'DECLINING') {
      await prisma.stateTransition.createMany({ data: [
        { featureId: id, oldState: null,       newState: 'THRIVING',  changedAt: daysAgo(47), reason: 'Feature first seen' },
        { featureId: id, oldState: 'THRIVING', newState: 'DECLINING', changedAt: daysAgo(18), reason: 'Interaction rate fell below 2% for 7 days' },
      ]})
    } else if (f.state === 'DORMANT') {
      await prisma.stateTransition.createMany({ data: [
        { featureId: id, oldState: null,        newState: 'THRIVING',  changedAt: daysAgo(44), reason: 'Feature first seen' },
        { featureId: id, oldState: 'THRIVING',  newState: 'DECLINING', changedAt: daysAgo(30), reason: 'Interaction rate fell below 2% for 7 days' },
        { featureId: id, oldState: 'DECLINING', newState: 'DORMANT',   changedAt: daysAgo(16), reason: 'Interaction rate below 1% for 14 days' },
      ]})
    } else {
      await prisma.stateTransition.createMany({ data: [
        { featureId: id, oldState: null,        newState: 'THRIVING',  changedAt: daysAgo(42), reason: 'Feature first seen' },
        { featureId: id, oldState: 'THRIVING',  newState: 'DECLINING', changedAt: daysAgo(38), reason: 'Interaction rate fell below 2% for 7 days' },
        { featureId: id, oldState: 'DECLINING', newState: 'DORMANT',   changedAt: daysAgo(32), reason: 'Interaction rate below 1% for 14 days' },
        { featureId: id, oldState: 'DORMANT',   newState: 'DEAD',      changedAt: daysAgo(4),  reason: 'Zero interactions for 30 days' },
      ]})
    }
  }

  await seedAppDailyStats(fit.id, fitAllRows)
  console.log(`✓ FitTrack — ${fitFeatures.length} features`)
  console.log('Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
