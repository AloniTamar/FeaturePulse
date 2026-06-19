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
  daysSinceLastInteraction: number | null,
  thresholds: { deadDays: number; dormantWeeks: number } = { deadDays: 30, dormantWeeks: 2 }
): FeatureState {
  // DEAD: zero interactions for deadDays+ consecutive days
  if (daysSinceLastInteraction !== null && daysSinceLastInteraction >= thresholds.deadDays) return 'DEAD'

  // DORMANT: rate < 1% sustained across last dormantWeeks weekly buckets
  if (
    weeklyRates.length >= thresholds.dormantWeeks &&
    weeklyRates.slice(-thresholds.dormantWeeks).every(w => w.rate < 0.01)
  ) return 'DORMANT'

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

/** Classifies all non-ignored features for an app and persists state transitions */
export async function classifyAllFeatures(appId: string): Promise<void> {
  const app = await prisma.app.findUnique({ where: { id: appId } })
  const thresholds = {
    deadDays:     app?.deadThresholdDays    ?? 30,
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

/** Database-bound — reads aggregate days dynamically based on dormantWeeks and classifies one feature */
export async function classifyFeature(
  featureId: string,
  thresholds: { deadDays: number; dormantWeeks: number } = { deadDays: 30, dormantWeeks: 2 }
): Promise<FeatureState> {
  const bucketCount = Math.max(2, thresholds.dormantWeeks)

  const agg = await prisma.dailyAggregate.findMany({
    where: { featureId },
    orderBy: { date: 'desc' },
    take: bucketCount * 7,
  })

  if (agg.length === 0) return 'THRIVING'

  const feature = await prisma.feature.findUnique({ where: { id: featureId } })
  const daysSince = feature?.lastInteraction
    ? Math.floor((Date.now() - feature.lastInteraction.getTime()) / 86_400_000)
    : null

  // agg is DESC order (most recent first); reverse to get oldest-first for bucketing
  const ascending = [...agg].reverse()
  const weeklyRates: WeeklyRate[] = Array.from({ length: bucketCount }, (_, w) => {
    const slice = ascending.slice(w * 7, (w + 1) * 7)
    if (slice.length === 0) return null
    return { week: w + 1, rate: slice.reduce((s, r) => s + r.interactionRate, 0) / slice.length }
  }).filter((w): w is WeeklyRate => w !== null)

  return determineState(agg[0]?.interactionRate ?? 0, weeklyRates, daysSince, thresholds)
}
