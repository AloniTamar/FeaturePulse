import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'

beforeEach(async () => {
  await prisma.rawEvent.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

async function createRateLimitTestApp() {
  const user = await prisma.user.create({
    data: { email: 'ratelimit@test.com', passwordHash: 'x' },
  })
  return prisma.app.create({
    data: {
      name: 'RateTest', packageName: 'com.test.rate',
      apiKey: 'fp_ratelimit_unique_key', apiKeyHash: 'fp_ratelimit_unique_key',
      userId: user.id,
    },
  })
}

async function createDiscoverRateLimitTestApp() {
  const user = await prisma.user.create({
    data: { email: 'ratelimit_discover@test.com', passwordHash: 'x' },
  })
  return prisma.app.create({
    data: {
      name: 'RateTestDiscover', packageName: 'com.test.rate.discover',
      apiKey: 'fp_ratelimit_discover_key', apiKeyHash: 'fp_ratelimit_discover_key',
      userId: user.id,
    },
  })
}

test('returns 429 after exceeding 100 requests per 15 minutes per API key', async () => {
  const testApp = await createRateLimitTestApp()
  let lastStatus = 200
  for (let i = 0; i <= 100; i++) {
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('X-API-Key', 'fp_ratelimit_unique_key')
      .send({
        appId: testApp.id,
        events: [{
          eventId: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
          featureId: 'f1', eventType: 'TAP', timestamp: Date.now(),
        }],
      })
    lastStatus = res.status
  }
  expect(lastStatus).toBe(429)
})

test('returns 429 after exceeding 100 requests to /discover per 15 minutes per API key', async () => {
  const testApp = await createDiscoverRateLimitTestApp()
  let lastStatus = 200
  for (let i = 0; i <= 100; i++) {
    const res = await request(app)
      .post('/api/v1/events/discover')
      .set('X-API-Key', 'fp_ratelimit_discover_key')
      .send({
        appId: testApp.id,
        features: [{
          featureId: 'f1',
          elementType: 'Button',
          resourceName: 'btn_ok',
          screenName: 'Main',
          hierarchyPath: null,
        }],
      })
    lastStatus = res.status
  }
  expect(lastStatus).toBe(429)
})
