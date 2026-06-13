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
