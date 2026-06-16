import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth, type AuthRequest } from '../middleware/auth'
import crypto from 'crypto'
import { z } from 'zod'

export const appsRouter = Router()

async function requireOwnership(req: AuthRequest, res: any, appId: string) {
  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) { res.status(404).json({ error: 'App not found' }); return null }
  if (app.userId !== req.userId) { res.status(403).json({ error: 'Forbidden' }); return null }
  return app
}

// Public — SDK fetches remote config via this (no auth)
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

// GET /api/v1/apps — list authenticated user's apps
appsRouter.get('/', jwtAuth, async (req: AuthRequest, res) => {
  try {
    const apps = await prisma.app.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { features: true } } },
    })
    res.json(apps.map(a => ({
      id: a.id,
      name: a.name,
      packageName: a.packageName,
      apiKey: a.apiKey,
      createdAt: a.createdAt,
      featureCount: a._count.features,
      deadThresholdDays:    a.deadThresholdDays,
      dormantThresholdDays: a.dormantThresholdDays,
      eventRetentionDays:   a.eventRetentionDays,
    })))
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/v1/apps — create new app
const CreateAppSchema = z.object({
  name: z.string().min(1),
  packageName: z.string().min(1),
})

appsRouter.post('/', jwtAuth, async (req: AuthRequest, res) => {
  const result = CreateAppSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { name, packageName } = result.data
  const apiKey = 'fp_' + crypto.randomBytes(24).toString('hex')
  try {
    const app = await prisma.app.create({
      data: { name, packageName, apiKey, apiKeyHash: apiKey, userId: req.userId! },
      include: { _count: { select: { features: true } } },
    })
    res.status(201).json({
      id: app.id, name: app.name, packageName: app.packageName,
      apiKey: app.apiKey, createdAt: app.createdAt, featureCount: app._count.features,
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/v1/apps/:appId — rename or update settings
const UpdateAppSchema = z.object({
  name:                z.string().min(1).optional(),
  deadThresholdDays:   z.number().int().min(1).max(365).optional(),
  dormantThresholdDays:z.number().int().min(1).max(365).optional(),
  eventRetentionDays:  z.number().int().min(1).max(365).optional(),
})

appsRouter.patch('/:appId', jwtAuth, async (req: AuthRequest, res) => {
  try {
    const owned = await requireOwnership(req, res, req.params.appId)
    if (!owned) return

    const result = UpdateAppSchema.safeParse(req.body)
    if (!result.success) return res.status(400).json({ error: result.error.flatten() })

    const updated = await prisma.app.update({
      where: { id: req.params.appId },
      data: result.data,
      include: { _count: { select: { features: true } } },
    })
    res.json({
      id: updated.id, name: updated.name, packageName: updated.packageName,
      apiKey: updated.apiKey, createdAt: updated.createdAt, featureCount: updated._count.features,
      deadThresholdDays: updated.deadThresholdDays,
      dormantThresholdDays: updated.dormantThresholdDays,
      eventRetentionDays: updated.eventRetentionDays,
    })
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/v1/apps/:appId
appsRouter.delete('/:appId', jwtAuth, async (req: AuthRequest, res) => {
  try {
    const owned = await requireOwnership(req, res, req.params.appId)
    if (!owned) return
    await prisma.app.delete({ where: { id: req.params.appId } })
    res.status(204).end()
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PUT /api/v1/apps/:appId/config — SDK remote config update
appsRouter.put('/:appId/config', jwtAuth, async (req: AuthRequest, res) => {
  try {
    const owned = await requireOwnership(req, res, req.params.appId)
    if (!owned) return
    const app = await prisma.app.update({
      where: { id: req.params.appId },
      data: { config: req.body },
    })
    res.json(app)
  } catch {
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/v1/apps/:appId/features
appsRouter.get('/:appId/features', jwtAuth, async (req: AuthRequest, res) => {
  try {
    const owned = await requireOwnership(req, res, req.params.appId)
    if (!owned) return

    const { appId } = req.params
    const SORT_MAP: Record<string, object> = {
      lastInteraction_desc: { lastInteraction: 'desc' },
      lastInteraction_asc:  { lastInteraction: 'asc'  },
      name_asc:             { resourceName:    'asc'   },
      interactionRate_desc: { dailyAggregates: { _avg: { interactionRate: 'desc' } } },
    }
    const { state, screen, page = '1', limit = '20', sort = 'lastInteraction_desc' } = req.query
    const orderBy = SORT_MAP[sort as string] ?? SORT_MAP['lastInteraction_desc']
    const where: Record<string, unknown> = { appId }
    if (state)  where.state = state
    if (screen) where.screenName = screen

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
    const [features, total] = await Promise.all([
      prisma.feature.findMany({ where, skip, take: parseInt(limit as string), orderBy }),
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

// GET /api/v1/apps/:appId/export
appsRouter.get('/:appId/export', jwtAuth, async (req: AuthRequest, res) => {
  try {
    const owned = await requireOwnership(req, res, req.params.appId)
    if (!owned) return
    const features = await prisma.feature.findMany({ where: { appId: req.params.appId } })
    if ((req.query.format as string) === 'csv') {
      const csvEscape = (val: string) => `"${val.replace(/"/g, '""')}"`
      const header = 'featureId,elementType,resourceName,screenName,state,lastInteraction\n'
      const rows = features.map(f =>
        [csvEscape(f.id), csvEscape(f.elementType), csvEscape(f.resourceName ?? ''),
         csvEscape(f.screenName), csvEscape(f.state), csvEscape(f.lastInteraction?.toISOString() ?? '')].join(',')
      ).join('\n')
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="${owned.name}-features.csv"`)
      return res.send(header + rows)
    }
    res.json(features)
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})
