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
