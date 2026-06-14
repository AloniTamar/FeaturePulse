// server/tests/e2e.test.ts
// Full-flow integration: register → ingest → cron → portal API assertions
import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'
import { runNightlyAggregation } from '../src/services/aggregation'

beforeAll(async () => {
  await prisma.stateTransition.deleteMany()
  await prisma.dailyAggregate.deleteMany()
  await prisma.rawEvent.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

describe('FeaturePulse full flow', () => {
  let appId: string
  let apiKey: string
  let jwtToken: string

  it('POST /auth/register creates user (no app) and returns token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'e2e@example.com', password: 'test1234',
    })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
    jwtToken = res.body.token
  })

  it('POST /api/v1/apps creates the first app and returns apiKey', async () => {
    const res = await request(app)
      .post('/api/v1/apps')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ name: 'E2E Demo App', packageName: 'com.e2e.demo' })
    expect(res.status).toBe(201)
    expect(res.body.apiKey).toMatch(/^fp_/)
    apiKey = res.body.apiKey
    appId  = res.body.id
  })

  it('POST /api/v1/events/batch accepts events', async () => {
    const now = Date.now()
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('x-api-key', apiKey)
      .send({
        appId,
        deviceId: 'dev_e2e',
        sdkVersion: '1.0.0',
        events: [
          // Feature A — actively tapped today
          {
            eventId:   '00000000-e2e0-0000-0000-000000000001',
            featureId: 'fp_feat_a_active',
            eventType: 'TAP',
            timestamp: now,
            sessionId: 'sess_e2e',
            deviceId:  'dev_e2e',
          },
          {
            eventId:   '00000000-e2e0-0000-0000-000000000002',
            featureId: 'fp_feat_a_active',
            eventType: 'IMPRESSION',
            timestamp: now - 1000,
            sessionId: 'sess_e2e',
            deviceId:  'dev_e2e',
          },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toBe(2)
  })

  it('sets up DEAD feature directly in DB (simulates 31-day silence)', async () => {
    const thirtyTwoDaysAgo = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000)
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)

    await prisma.feature.create({
      data: {
        id: 'fp_feat_b_dead',
        appId,
        elementType: 'Button',
        resourceName: 'btn_summer_promo',
        screenName: 'HomeActivity',
        state: 'THRIVING',
        lastInteraction: thirtyOneDaysAgo,
      },
    })
    await prisma.dailyAggregate.create({
      data: {
        featureId: 'fp_feat_b_dead',
        date: thirtyTwoDaysAgo,
        impressions: 5,
        interactions: 0,
        uniqueUsers: 3,
        interactionRate: 0.0,
      },
    })
  })

  it('runNightlyAggregation classifies features correctly', async () => {
    await runNightlyAggregation()

    const featA = await prisma.feature.findFirst({ where: { appId, resourceName: null, screenName: { not: 'HomeActivity' } } })
    const featB = await prisma.feature.findUnique({ where: { id: 'fp_feat_b_dead' } })

    expect(featB).not.toBeNull()
    expect(featB!.state).toBe('DEAD')
  })

  it('GET /apps/:appId/dead returns the dead feature', async () => {
    const res = await request(app)
      .get(`/api/v1/apps/${appId}/dead`)
      .set('Authorization', `Bearer ${jwtToken}`)
    expect(res.status).toBe(200)
    const deadIds = (res.body as Array<{ id: string }>).map(f => f.id)
    expect(deadIds).toContain('fp_feat_b_dead')
    expect(deadIds).not.toContain('fp_feat_a_active')
  })

  it('GET /apps/:appId/dashboard returns correct counts', async () => {
    const res = await request(app)
      .get(`/api/v1/apps/${appId}/dashboard`)
      .set('Authorization', `Bearer ${jwtToken}`)
    expect(res.status).toBe(200)
    expect(res.body.counts.DEAD).toBeGreaterThanOrEqual(1)
  })

  it('PATCH /features/:id/ignore marks feature as ignored', async () => {
    const res = await request(app)
      .patch('/api/v1/features/fp_feat_b_dead/ignore')
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ ignore: true })
    expect(res.status).toBe(200)
    expect(res.body.isIgnored).toBe(true)
  })

  it('GET /features/:id/timeline returns timeline array', async () => {
    const res = await request(app)
      .get('/api/v1/features/fp_feat_b_dead/timeline?days=60')
      .set('Authorization', `Bearer ${jwtToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(1)
  })

  it('GET /apps/:appId/export?format=csv returns CSV', async () => {
    const res = await request(app)
      .get(`/api/v1/apps/${appId}/export?format=csv`)
      .set('Authorization', `Bearer ${jwtToken}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text).toContain('featureId')
  })

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
