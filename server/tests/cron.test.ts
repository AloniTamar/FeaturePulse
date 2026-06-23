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

describe('POST /api/v1/cron/trigger', () => {
  beforeEach(async () => {
    await prisma.rawEvent.deleteMany()
    await prisma.feature.deleteMany()
    await prisma.app.deleteMany()
    await prisma.user.deleteMany()
  })

  async function getJwt(email: string): Promise<string> {
    await request(app).post('/api/v1/auth/register').send({ email, password: 'Password1!' })
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password1!' })
    return res.body.token as string
  }

  test('returns 401 with no token', async () => {
    const res = await request(app).post('/api/v1/cron/trigger')
    expect(res.status).toBe(401)
  })

  test('returns 401 with invalid token', async () => {
    const res = await request(app)
      .post('/api/v1/cron/trigger')
      .set('Authorization', 'Bearer not_a_real_jwt')
    expect(res.status).toBe(401)
  })

  test('returns 200 with valid JWT', async () => {
    const token = await getJwt('cron_trigger@test.com')
    const res = await request(app)
      .post('/api/v1/cron/trigger')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
