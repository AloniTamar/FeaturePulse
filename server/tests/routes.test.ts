// server/tests/routes.test.ts
import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'

let testApiKey: string
let testAppId: string

beforeAll(async () => {
  await prisma.rawEvent.deleteMany()
  await prisma.stateTransition.deleteMany()
  await prisma.dailyAggregate.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
  const testUser = await prisma.user.create({
    data: { email: 'route@test.com', passwordHash: 'x' },
  })
  const testApp = await prisma.app.create({
    data: {
      name: 'RouteTest', packageName: 'com.routetest',
      apiKey: 'fp_route_key', apiKeyHash: 'fp_route_key',
      userId: testUser.id,
    },
  })
  testApiKey = testApp.apiKey
  testAppId  = testApp.id
})

afterAll(async () => { await prisma.$disconnect() })

describe('GET /health', () => {
  test('returns ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('POST /api/v1/events/batch', () => {
  test('returns 200 with valid payload', async () => {
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('x-api-key', testApiKey)
      .send({
        appId: testAppId,
        deviceId: 'dev_1',
        sdkVersion: '1.0.0',
        events: [{ eventId: '00000000-0000-0000-0000-000000000101', featureId: 'feat_1', eventType: 'TAP', timestamp: Date.now() }],
      })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toBe(1)
  })

  test('returns 401 with missing API key', async () => {
    const res = await request(app).post('/api/v1/events/batch').send({})
    expect(res.status).toBe(401)
  })

  test('returns 401 with invalid API key', async () => {
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('x-api-key', 'fp_wrong_key')
      .send({ appId: testAppId, events: [] })
    expect(res.status).toBe(401)
  })

  test('returns 400 with empty events array', async () => {
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('x-api-key', testApiKey)
      .send({ appId: testAppId, events: [] })
    expect(res.status).toBe(400)
  })
})

describe('POST /api/v1/auth/register', () => {
  test('returns 201 with token only (no apiKey)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: `test_${Date.now()}@example.com`,
      password: 'password123',
    })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
    expect(res.body.apiKey).toBeUndefined()
  })
})
