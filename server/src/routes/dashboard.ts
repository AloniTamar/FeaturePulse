// server/src/routes/dashboard.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth, type AuthRequest } from '../middleware/auth'

export const dashboardRouter = Router()

// GET /api/v1/apps/:appId/dashboard — summary counts + recent state changes
dashboardRouter.get('/apps/:appId/dashboard', jwtAuth, async (req: AuthRequest, res) => {
  const { appId } = req.params
  try {
    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app) return res.status(404).json({ error: 'App not found' })
    if (app.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' })

    const [stateCounts, recentTransitions] = await Promise.all([
      prisma.feature.groupBy({ by: ['state'], where: { appId }, _count: true }),
      prisma.stateTransition.findMany({
        where: { feature: { appId } },
        orderBy: { changedAt: 'desc' },
        take: 10,
        include: { feature: { select: { resourceName: true, screenName: true } } },
      }),
    ])

    const counts = { TOTAL: 0, THRIVING: 0, DECLINING: 0, DORMANT: 0, DEAD: 0 }
    for (const { state, _count } of stateCounts) {
      counts[state as keyof typeof counts] = _count
      counts.TOTAL += _count
    }

    res.json({ counts, recentTransitions })
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

// GET /api/v1/apps/:appId/dead
dashboardRouter.get('/apps/:appId/dead', jwtAuth, async (req: AuthRequest, res) => {
  try {
    const app = await prisma.app.findUnique({ where: { id: req.params.appId } })
    if (!app) return res.status(404).json({ error: 'App not found' })
    if (app.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' })

    const features = await prisma.feature.findMany({
      where: { appId: req.params.appId, state: 'DEAD', isIgnored: false },
      orderBy: { lastInteraction: 'asc' },
    })
    res.json(features)
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

// GET /api/v1/apps/:appId/declining
dashboardRouter.get('/apps/:appId/declining', jwtAuth, async (req: AuthRequest, res) => {
  try {
    const app = await prisma.app.findUnique({ where: { id: req.params.appId } })
    if (!app) return res.status(404).json({ error: 'App not found' })
    if (app.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' })

    const features = await prisma.feature.findMany({
      where: { appId: req.params.appId, state: 'DECLINING', isIgnored: false },
      orderBy: { lastInteraction: 'desc' },
    })
    res.json(features)
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

// GET /api/v1/apps/:appId/transitions
dashboardRouter.get('/apps/:appId/transitions', jwtAuth, async (req: AuthRequest, res) => {
  const { appId } = req.params
  const { toState, sort = 'desc', page = '1', limit = '20' } = req.query as Record<string, string>
  const pageNum  = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const skip     = (pageNum - 1) * limitNum

  try {
    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app) return res.status(404).json({ error: 'App not found' })
    if (app.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' })

    const where = {
      feature: { appId },
      ...(toState ? { newState: toState } : {}),
    }

    const [data, total] = await Promise.all([
      prisma.stateTransition.findMany({
        where,
        orderBy: { changedAt: sort === 'asc' ? 'asc' : 'desc' },
        skip,
        take: limitNum,
        include: { feature: { select: { id: true, resourceName: true, screenName: true } } },
      }),
      prisma.stateTransition.count({ where }),
    ])

    res.json({
      data,
      pagination: { page: pageNum, limit: limitNum, total },
    })
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

// GET /api/v1/apps/:appId/trend?days=30
dashboardRouter.get('/apps/:appId/trend', jwtAuth, async (req: AuthRequest, res) => {
  const days = Math.max(1, Math.min(365, parseInt((req.query.days as string) ?? '30', 10) || 30))
  const since = new Date(Date.now() - days * 86_400_000)
  try {
    const app = await prisma.app.findUnique({ where: { id: req.params.appId } })
    if (!app) return res.status(404).json({ error: 'App not found' })
    if (app.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' })

    const rows = await prisma.dailyAggregate.groupBy({
      by: ['date'],
      where: { feature: { appId: req.params.appId }, date: { gte: since } },
      _avg: { interactionRate: true },
      orderBy: { date: 'asc' },
    })
    res.json(rows.map(r => ({
      date: r.date.toISOString().slice(0, 10),
      avgInteractionRate: +(r._avg.interactionRate ?? 0).toFixed(4),
    })))
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})
