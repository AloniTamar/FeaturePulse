// server/src/routes/features.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth } from '../middleware/auth'

export const featuresRouter = Router()

// GET /api/v1/features/:featureId
featuresRouter.get('/:featureId', jwtAuth, async (req, res) => {
  try {
    const feature = await prisma.feature.findUnique({ where: { id: req.params.featureId } })
    if (!feature) return res.status(404).json({ error: 'Feature not found' })
    res.json({
      ...feature,
      daysSinceLastUse: feature.lastInteraction
        ? Math.floor((Date.now() - feature.lastInteraction.getTime()) / 86_400_000)
        : null,
    })
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
