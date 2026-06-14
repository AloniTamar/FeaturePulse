// server/src/routes/apps.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth } from '../middleware/auth'


export const appsRouter = Router()

// SDK fetches remote config via this (no auth required — public config only)
appsRouter.get('/config', async (req, res) => {
  const appId = req.query.appId
  if (typeof appId !== 'string' || !appId) return res.status(400).json({ error: 'appId required' })
  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) return res.status(404).json({ error: 'App not found' })
  const storedConfig = app.config && typeof app.config === 'object' && !Array.isArray(app.config)
    ? app.config as Record<string, unknown>
    : {}
  res.json({
    enabled: true,
    syncIntervalMs: 1800000,
    batchSize: 500,
    minImpressionMs: 1000,
    excludeScreens: [],
    samplingRate: 1.0,
    sdkMinVersion: '1.0.0',
    ...storedConfig,
  })
})

appsRouter.get('/', jwtAuth, async (_req, res) => {
  const apps = await prisma.app.findMany()
  res.json(apps.map(a => ({ id: a.id, name: a.name, packageName: a.packageName, createdAt: a.createdAt })))
})

appsRouter.put('/:appId/config', jwtAuth, async (req, res) => {
  const app = await prisma.app.update({
    where: { id: req.params.appId },
    data: { config: req.body },
  })
  res.json(app)
})

// GET /api/v1/apps/:appId/features?state=DEAD&screen=HomeActivity&page=1&limit=20
appsRouter.get('/:appId/features', jwtAuth, async (req, res) => {
  const { appId } = req.params
  const { state, screen, page = '1', limit = '20' } = req.query

  const where: Record<string, unknown> = { appId }
  if (state)  where.state = state
  if (screen) where.screenName = screen

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
  try {
    const [features, total] = await Promise.all([
      prisma.feature.findMany({ where, skip, take: parseInt(limit as string), orderBy: { lastInteraction: 'desc' } }),
      prisma.feature.count({ where }),
    ])
    res.json({
      data: features.map(f => ({
        ...f,
        daysSinceLastUse: f.lastInteraction
          ? Math.floor((Date.now() - f.lastInteraction.getTime()) / 86_400_000)
          : null,
      })),
      pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total },
    })
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

// GET /api/v1/apps/:appId/export?format=json|csv
appsRouter.get('/:appId/export', jwtAuth, async (req, res) => {
  try {
    const features = await prisma.feature.findMany({ where: { appId: req.params.appId } })
    if ((req.query.format as string) === 'csv') {
      const csvEscape = (val: string) => `"${val.replace(/"/g, '""')}"`
      const header = 'featureId,elementType,resourceName,screenName,state,lastInteraction\n'
      const rows = features.map(f =>
        [
          csvEscape(f.id),
          csvEscape(f.elementType),
          csvEscape(f.resourceName ?? ''),
          csvEscape(f.screenName),
          csvEscape(f.state),
          csvEscape(f.lastInteraction?.toISOString() ?? ''),
        ].join(',')
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename="features.csv"')
      return res.send(header + rows)
    }
    res.json(features)
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})
