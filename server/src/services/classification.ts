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
