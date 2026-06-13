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
