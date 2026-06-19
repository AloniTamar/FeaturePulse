// server/src/routes/events.ts
import { Router } from 'express'
import { apiKeyAuth, AuthRequest } from '../middleware/auth'
import { apiKeyRateLimit } from '../middleware/rateLimit'
import { ingestBatch, upsertFeature, BatchPayloadSchema } from '../services/ingestion'
import { z } from 'zod'

export const eventsRouter = Router()

const DiscoverSchema = z.object({
  features: z.array(z.object({
    featureId:     z.string().min(1).max(64),
    elementType:   z.string(),
    resourceName:  z.string().nullable(),
    screenName:    z.string(),
    hierarchyPath: z.string().nullable(),
  })),
})

eventsRouter.post('/batch', apiKeyRateLimit, apiKeyAuth, async (req: AuthRequest, res) => {
  const result = BatchPayloadSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  try {
    const ingested = await ingestBatch(req.appId!, result.data)
    res.json(ingested)
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
})

eventsRouter.post('/discover', apiKeyRateLimit, apiKeyAuth, async (req: AuthRequest, res) => {
  const result = DiscoverSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const errors: string[] = []
  let registered = 0
  for (const f of result.data.features) {
    try {
      await upsertFeature(req.appId!, f.featureId, f.elementType, f.resourceName, f.screenName, f.hierarchyPath)
      registered++
    } catch {
      errors.push(`${f.featureId}: failed to register`)
    }
  }
  res.json({ registered, errors })
})
