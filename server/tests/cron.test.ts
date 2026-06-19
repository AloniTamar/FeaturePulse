import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'

afterAll(async () => { await prisma.$disconnect() })

beforeEach(() => {
  process.env.CRON_SECRET = 'test_cron_secret_12345'
})

test('POST /api/v1/cron/nightly rejects missing auth with 401', async () => {
  const res = await request(app).post('/api/v1/cron/nightly')
  expect(res.status).toBe(401)
})

test('POST /api/v1/cron/nightly rejects wrong secret with 401', async () => {
  const res = await request(app)
    .post('/api/v1/cron/nightly')
    .set('Authorization', 'Bearer wrong_secret')
  expect(res.status).toBe(401)
})

test('POST /api/v1/cron/nightly accepts correct CRON_SECRET', async () => {
  const res = await request(app)
    .post('/api/v1/cron/nightly')
    .set('Authorization', 'Bearer test_cron_secret_12345')
  expect(res.status).toBe(200)
  expect(res.body.ok).toBe(true)
})
