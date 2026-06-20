// server/tests/ingestion.test.ts
import { ingestBatch, upsertFeatures, BatchPayload } from '../src/services/ingestion'
import { prisma } from '../src/db/client'

beforeEach(async () => {
  await prisma.stateTransition.deleteMany()
  await prisma.dailyAggregate.deleteMany()
  await prisma.rawEvent.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

async function createTestApp() {
  const user = await prisma.user.create({
    data: { email: 'test@test.com', passwordHash: 'x' },
  })
  return prisma.app.create({
    data: {
      name: 'Test', packageName: 'com.test', apiKey: 'fp_test_key',
      apiKeyHash: 'fp_test_key', userId: user.id,
    },
  })
}

function validPayload(appId: string): BatchPayload {
  return {
    appId,
    deviceId: 'dev_abc',
    sdkVersion: '1.0.0',
    events: [
      { eventId: '00000000-0000-0000-0000-000000000001', featureId: 'feat_001', eventType: 'TAP',        timestamp: Date.now(), sessionId: 'sess_x', deviceId: 'dev_abc' },
      { eventId: '00000000-0000-0000-0000-000000000002', featureId: 'feat_002', eventType: 'IMPRESSION', timestamp: Date.now(), sessionId: 'sess_x', deviceId: 'dev_abc' },
    ],
  }
}

test('accepts valid batch and returns correct counts', async () => {
  const app = await createTestApp()
  const result = await ingestBatch(app.id, validPayload(app.id))
  expect(result.accepted).toBe(2)
  expect(result.rejected).toBe(0)
  expect(result.errors).toHaveLength(0)
})

test('duplicate eventId is idempotent (upsert no-op)', async () => {
  const app = await createTestApp()
  const payload = validPayload(app.id)
  await ingestBatch(app.id, payload)
  const result2 = await ingestBatch(app.id, payload)
  expect(result2.accepted).toBe(2)
  expect(result2.rejected).toBe(0)
})

test('rejects event with invalid eventType', async () => {
  const app = await createTestApp()
  const payload: BatchPayload = {
    ...validPayload(app.id),
    events: [{ eventId: '00000000-0000-0000-0000-000000000099', featureId: 'feat_x', eventType: 'CLICK' as never, timestamp: Date.now() }],
  }
  const result = await ingestBatch(app.id, payload)
  expect(result.rejected).toBe(1)
})

test('upsertFeatures registers multiple features and deduplicates', async () => {
  const app = await createTestApp()
  const result = await upsertFeatures(app.id, [
    { featureId: 'batch_f1', elementType: 'Button', resourceName: 'btn_ok', screenName: 'Main', hierarchyPath: null },
    { featureId: 'batch_f2', elementType: 'TextView', resourceName: null, screenName: 'Main', hierarchyPath: '/root/text' },
    { featureId: 'batch_f1', elementType: 'Button', resourceName: 'btn_ok', screenName: 'Main', hierarchyPath: null },
  ])
  expect(result.registered).toBe(2)
  const count = await prisma.feature.count({ where: { appId: app.id } })
  expect(count).toBe(2)
})

test('rejects event with timestamp older than 7 days', async () => {
  const app = await createTestApp()
  const oldTs = Date.now() - 8 * 24 * 60 * 60 * 1000
  const payload: BatchPayload = {
    ...validPayload(app.id),
    events: [{ eventId: '00000000-0000-0000-0000-000000000010', featureId: 'feat_x', eventType: 'TAP', timestamp: oldTs }],
  }
  const result = await ingestBatch(app.id, payload)
  expect(result.rejected).toBe(1)
})

test('rejects all events when monthly quota is already at limit', async () => {
  const user = await prisma.user.create({ data: { email: 'quota1@test.com', passwordHash: 'x' } })
  const limitedApp = await prisma.app.create({
    data: {
      name: 'LimitedApp', packageName: 'com.limited', apiKey: 'fp_limited_key',
      apiKeyHash: 'fp_limited_key', userId: user.id,
      monthlyEventQuota: 5,
      currentMonthEvents: 5,
      quotaResetMonth: new Date().toISOString().slice(0, 7),
    },
  })
  const result = await ingestBatch(limitedApp.id, validPayload(limitedApp.id))
  expect(result.accepted).toBe(0)
  expect(result.quotaExceeded).toBe(true)
})

test('resets counter and accepts events when quotaResetMonth is an old month', async () => {
  const user = await prisma.user.create({ data: { email: 'quota2@test.com', passwordHash: 'x' } })
  const oldMonthApp = await prisma.app.create({
    data: {
      name: 'OldMonthApp', packageName: 'com.oldmonth', apiKey: 'fp_oldmonth_key',
      apiKeyHash: 'fp_oldmonth_key', userId: user.id,
      monthlyEventQuota: 5,
      currentMonthEvents: 5,
      quotaResetMonth: '2020-01',
    },
  })
  const result = await ingestBatch(oldMonthApp.id, validPayload(oldMonthApp.id))
  expect(result.accepted).toBe(2)
  expect(result.quotaExceeded).toBe(false)
})

test('unlimited quota (0) always accepts events', async () => {
  const app = await createTestApp()
  const result = await ingestBatch(app.id, validPayload(app.id))
  expect(result.quotaExceeded).toBe(false)
  expect(result.accepted).toBe(2)
})
