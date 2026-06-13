// server/src/routes/features.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth } from '../middleware/auth'

export const featuresRouter = Router()

// GET /api/v1/apps/:appId/features?state=DEAD&screen=HomeActivity&page=1&limit=20
featuresRouter.get('/apps/:appId/features', jwtAuth, async (req, res) => {
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
// IMPORTANT: must be registered BEFORE /:featureId to avoid route shadowing
featuresRouter.get('/apps/:appId/export', jwtAuth, async (req, res) => {
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

// GET /api/v1/features/:featureId
featuresRouter.get('/:featureId', jwtAuth, async (req, res) => {
  try {
    const feature = await prisma.feature.findUnique({ where: { id: req.params.featureId } })
    if (!feature) return res.status(404).json({ error: 'Feature not found' })
    res.json(feature)
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

// GET /api/v1/features/:featureId/timeline?days=30
featuresRouter.get('/:featureId/timeline', jwtAuth, async (req, res) => {
  const days = parseInt((req.query.days as string) ?? '30')
  const since = new Date(Date.now() - days * 86_400_000)
  try {
    const rows = await prisma.dailyAggregate.findMany({
      where: { featureId: req.params.featureId, date: { gte: since } },
      orderBy: { date: 'asc' },
    })
    res.json(rows)
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

// PATCH /api/v1/features/:featureId/ignore
featuresRouter.patch('/:featureId/ignore', jwtAuth, async (req, res) => {
  const { ignore } = req.body as { ignore: unknown }
  if (typeof ignore !== 'boolean') {
    return res.status(400).json({ error: '`ignore` must be a boolean' })
  }
  try {
    const feature = await prisma.feature.update({
      where: { id: req.params.featureId },
      data: { isIgnored: ignore },
    })
    res.json(feature)
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})
