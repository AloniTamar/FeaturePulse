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
