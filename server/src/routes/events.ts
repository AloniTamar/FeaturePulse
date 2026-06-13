// server/src/routes/events.ts
import { Router } from 'express'
import { apiKeyAuth, AuthRequest } from '../middleware/auth'
import { ingestBatch, upsertFeature, BatchPayloadSchema } from '../services/ingestion'
import { z } from 'zod'

export const eventsRouter = Router()

const DiscoverSchema = z.object({
  features: z.array(z.object({
    featureId:     z.string(),
    elementType:   z.string(),
    resourceName:  z.string().nullable(),
    screenName:    z.string(),
    hierarchyPath: z.string().nullable(),
  })),
})

eventsRouter.post('/batch', apiKeyAuth, async (req: AuthRequest, res) => {
  const result = BatchPayloadSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const ingested = await ingestBatch(req.appId!, result.data)
  res.json(ingested)
})

eventsRouter.post('/discover', apiKeyAuth, async (req: AuthRequest, res) => {
  const result = DiscoverSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  for (const f of result.data.features) {
    await upsertFeature(req.appId!, f.featureId, f.elementType, f.resourceName, f.screenName, f.hierarchyPath)
  }
  res.json({ registered: result.data.features.length })
})
