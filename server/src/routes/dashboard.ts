// server/src/routes/dashboard.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth } from '../middleware/auth'

export const dashboardRouter = Router()

// GET /api/v1/apps/:appId/dashboard — summary counts + recent state changes
dashboardRouter.get('/apps/:appId/dashboard', jwtAuth, async (req, res) => {
  const { appId } = req.params
  try {
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
dashboardRouter.get('/apps/:appId/dead', jwtAuth, async (req, res) => {
  try {
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
dashboardRouter.get('/apps/:appId/declining', jwtAuth, async (req, res) => {
  try {
    const features = await prisma.feature.findMany({
      where: { appId: req.params.appId, state: 'DECLINING', isIgnored: false },
      orderBy: { lastInteraction: 'desc' },
    })
    res.json(features)
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})
