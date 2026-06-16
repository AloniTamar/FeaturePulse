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

  const apps = await prisma.app.findMany({
    select: { id: true, eventRetentionDays: true },
  })

  for (const app of apps) {
    await aggregateDay(app.id, yesterday)
    await classifyAllFeatures(app.id)

    const retentionDays = app.eventRetentionDays ?? 7
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
    await prisma.rawEvent.deleteMany({ where: { appId: app.id, timestamp: { lt: cutoff } } })
  }

  console.log('[Cron] Done.')
}

async function classifyAllFeatures(appId: string): Promise<void> {
  const app = await prisma.app.findUnique({ where: { id: appId } })
  const thresholds = {
    deadDays:    app?.deadThresholdDays    ?? 30,
    dormantWeeks: Math.ceil((app?.dormantThresholdDays ?? 14) / 7),
  }

  const features = await prisma.feature.findMany({ where: { appId, isIgnored: false } })

  for (const feature of features) {
    const newState = await classifyFeature(feature.id, thresholds)
    if (newState !== feature.state) {
      await prisma.feature.update({ where: { id: feature.id }, data: { state: newState } })
      await prisma.stateTransition.create({
        data: {
          featureId: feature.id,
          oldState:  feature.state,
          newState,
          reason: `Automated classification on ${new Date().toISOString().slice(0, 10)}`,
        },
      })
    }
  }
}
