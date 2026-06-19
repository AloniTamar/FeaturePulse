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
