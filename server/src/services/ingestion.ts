// server/src/services/ingestion.ts
import { prisma } from '../db/client'
import { z } from 'zod'

export const RawEventSchema = z.object({
  eventId:   z.string().uuid(),
  featureId: z.string().min(1).max(64),
  eventType: z.enum(['TAP', 'LONG_PRESS', 'SWIPE', 'IMPRESSION']),
  timestamp: z.number().int().positive(),
  sessionId: z.string().optional(),
  deviceId:  z.string().optional(),
})

export const BatchPayloadSchema = z.object({
  appId:      z.string().uuid(),
  deviceId:   z.string().optional(),
  sdkVersion: z.string().optional(),
  events:     z.array(RawEventSchema).min(1).max(500),
})

export type BatchPayload = z.infer<typeof BatchPayloadSchema>

export interface IngestResult {
  accepted: number
  rejected: number
  errors: string[]
  quotaExceeded: boolean
}

export async function ingestBatch(appId: string, payload: BatchPayload): Promise<IngestResult> {
  const currentMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'

  const appRecord = await prisma.app.findUnique({
    where: { id: appId },
    select: { monthlyEventQuota: true, currentMonthEvents: true, quotaResetMonth: true },
  })
  if (!appRecord) {
    return { accepted: 0, rejected: payload.events.length, errors: ['App not found'], quotaExceeded: false }
  }

  let currentCount = appRecord.currentMonthEvents
  if (appRecord.quotaResetMonth !== currentMonth) {
    await prisma.app.update({ where: { id: appId }, data: { currentMonthEvents: 0, quotaResetMonth: currentMonth } })
    currentCount = 0
  }

  if (appRecord.monthlyEventQuota > 0 && currentCount >= appRecord.monthlyEventQuota) {
    return { accepted: 0, rejected: payload.events.length, errors: ['Monthly event quota exceeded'], quotaExceeded: true }
  }

  const errors: string[] = []
  let accepted = 0

  for (const event of payload.events) {
    const parsed = RawEventSchema.safeParse(event)
    if (!parsed.success) {
      errors.push(`${event.eventId}: ${parsed.error.message}`)
      continue
    }

    const now = Date.now()
    const ts = parsed.data.timestamp
    if (ts < now - 7 * 24 * 60 * 60 * 1000 || ts > now + 60_000) {
      errors.push(`${event.eventId}: timestamp out of range`)
      continue
    }

    try {
      await prisma.rawEvent.upsert({
        where: { id: event.eventId },
        update: {},
        create: {
          id:        event.eventId,
          featureId: event.featureId,
          appId,
          eventType: event.eventType,
          timestamp: new Date(event.timestamp),
          sessionId: event.sessionId,
          deviceId:  event.deviceId,
        },
      })
      accepted++
    } catch {
      errors.push(`${event.eventId}: database error`)
    }
  }

  if (accepted > 0) {
    await prisma.app.update({ where: { id: appId }, data: { currentMonthEvents: { increment: accepted } } })
  }
  return { accepted, rejected: errors.length, errors, quotaExceeded: false }
}

export async function upsertFeature(
  appId: string,
  featureId: string,
  elementType: string,
  resourceName: string | null,
  screenName: string,
  hierarchyPath: string | null
): Promise<void> {
  await prisma.feature.upsert({
    where: { id: featureId },
    update: {},
    create: { id: featureId, appId, elementType, resourceName, screenName, hierarchyPath, state: 'THRIVING' },
  })
}

export interface FeatureInput {
  featureId: string
  elementType: string
  resourceName: string | null
  screenName: string
  hierarchyPath: string | null
}

export async function upsertFeatures(appId: string, features: FeatureInput[]): Promise<{ registered: number }> {
  const unique = [...new Map(features.map(f => [f.featureId, f])).values()]
  const result = await prisma.feature.createMany({
    data: unique.map(f => ({
      id: f.featureId,
      appId,
      elementType: f.elementType,
      resourceName: f.resourceName,
      screenName: f.screenName,
      hierarchyPath: f.hierarchyPath,
      state: 'THRIVING',
    })),
    skipDuplicates: true,
  })
  return { registered: result.count }
}
