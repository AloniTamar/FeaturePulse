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
