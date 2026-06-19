import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'
import jwt from 'jsonwebtoken'

function makeToken(userId: string) {
  return jwt.sign({ userId }, process.env.JWT_SECRET ?? 'test-secret', { expiresIn: '1h' })
}

beforeEach(async () => {
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
})
afterAll(async () => { await prisma.$disconnect() })

describe('App CRUD', () => {
  let userId: string
  let token: string
  let otherUserId: string
  let otherToken: string

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: 'owner@test.com', passwordHash: 'x' } })
    userId = user.id
    token = makeToken(userId)
    const other = await prisma.user.create({ data: { email: 'other@test.com', passwordHash: 'x' } })
    otherUserId = other.id
    otherToken = makeToken(otherUserId)
  })

  it('GET /apps returns only the authenticated user\'s apps', async () => {
    await prisma.app.create({ data: { name: 'Mine', packageName: 'com.mine', apiKey: 'fp_m', apiKeyHash: 'fp_m', userId } })
    await prisma.app.create({ data: { name: 'Theirs', packageName: 'com.theirs', apiKey: 'fp_t', apiKeyHash: 'fp_t', userId: otherUserId } })
    const res = await request(app).get('/api/v1/apps').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('Mine')
    expect(res.body[0].featureCount).toBe(0)
  })

  it('POST /apps creates an app owned by the authenticated user', async () => {
    const res = await request(app)
      .post('/api/v1/apps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New App', packageName: 'com.new' })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('New App')
    expect(res.body.apiKey).toMatch(/^fp_/)
    const app_ = await prisma.app.findUnique({ where: { id: res.body.id } })
    expect(app_?.userId).toBe(userId)
  })

  it('PATCH /apps/:appId renames own app', async () => {
    const created = await prisma.app.create({ data: { name: 'Old', packageName: 'com.old', apiKey: 'fp_old', apiKeyHash: 'fp_old', userId } })
    const res = await request(app)
      .patch(`/api/v1/apps/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('New Name')
  })

  it('PATCH /apps/:appId returns 403 for another user\'s app', async () => {
    const created = await prisma.app.create({ data: { name: 'Theirs', packageName: 'com.t', apiKey: 'fp_th', apiKeyHash: 'fp_th', userId: otherUserId } })
    const res = await request(app)
      .patch(`/api/v1/apps/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hijacked' })
    expect(res.status).toBe(403)
  })

  it('DELETE /apps/:appId removes app and cascades features', async () => {
    const created = await prisma.app.create({ data: { name: 'ToDelete', packageName: 'com.del', apiKey: 'fp_d', apiKeyHash: 'fp_d', userId } })
    await prisma.feature.create({ data: { id: 'feat_del', appId: created.id, elementType: 'Button', screenName: 'Home' } })
    const res = await request(app)
      .delete(`/api/v1/apps/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(204)
    expect(await prisma.app.findUnique({ where: { id: created.id } })).toBeNull()
    expect(await prisma.feature.findUnique({ where: { id: 'feat_del' } })).toBeNull()
  })

  it('DELETE /apps/:appId returns 403 for another user\'s app', async () => {
    const created = await prisma.app.create({ data: { name: 'Theirs2', packageName: 'com.t2', apiKey: 'fp_t2', apiKeyHash: 'fp_t2', userId: otherUserId } })
    const res = await request(app)
      .delete(`/api/v1/apps/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('GET /apps/:appId/features returns 403 for another user\'s app', async () => {
    const created = await prisma.app.create({ data: { name: 'Theirs3', packageName: 'com.t3', apiKey: 'fp_t3', apiKeyHash: 'fp_t3', userId: otherUserId } })
    const res = await request(app)
      .get(`/api/v1/apps/${created.id}/features`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /apps/:appId/features — sort param', () => {
  let token: string
  let appId: string

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: 'sort@test.com', passwordHash: 'x' } })
    token = makeToken(user.id)
    const a = await prisma.app.create({
      data: { name: 'S', packageName: 'com.s', apiKey: 'fp_sort', apiKeyHash: 'fp_sort', userId: user.id },
    })
    appId = a.id
    const old = new Date(Date.now() - 10 * 86_400_000)
    await prisma.feature.createMany({
      data: [
        { id: 'f_sort_a', appId, elementType: 'Button', screenName: 'A', resourceName: 'btn_z', lastInteraction: old },
        { id: 'f_sort_b', appId, elementType: 'Button', screenName: 'B', resourceName: 'btn_a', lastInteraction: new Date() },
      ],
    })
  })

  it('sorts by name ascending', async () => {
    const res = await request(app)
      .get(`/api/v1/apps/${appId}/features?sort=name_asc`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data[0].resourceName).toBe('btn_a')
    expect(res.body.data[1].resourceName).toBe('btn_z')
  })

  it('sorts by lastInteraction ascending', async () => {
    const res = await request(app)
      .get(`/api/v1/apps/${appId}/features?sort=lastInteraction_asc`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data[0].resourceName).toBe('btn_z')
  })
})

describe('PATCH /apps/:appId — settings fields', () => {
  let token: string
  let appId: string

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: 'settings@test.com', passwordHash: 'x' } })
    token = makeToken(user.id)
    const a = await prisma.app.create({
      data: { name: 'Set', packageName: 'com.set', apiKey: 'fp_set', apiKeyHash: 'fp_set', userId: user.id },
    })
    appId = a.id
  })

  it('updates deadThresholdDays', async () => {
    const res = await request(app)
      .patch(`/api/v1/apps/${appId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ deadThresholdDays: 60 })
    expect(res.status).toBe(200)
    expect(res.body.deadThresholdDays).toBe(60)
  })

  it('rejects out-of-range value', async () => {
    const res = await request(app)
      .patch(`/api/v1/apps/${appId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ deadThresholdDays: 0 })
    expect(res.status).toBe(400)
  })
})

describe('GET /apps/:appId/transitions', () => {
  let userId: string
  let token: string
  let appId: string

  beforeEach(async () => {
    const user = await prisma.user.create({ data: { email: 'trans@test.com', passwordHash: 'x' } })
    userId = user.id
    token = makeToken(userId)
    const a = await prisma.app.create({
      data: { name: 'T', packageName: 'com.t', apiKey: 'fp_trans', apiKeyHash: 'fp_trans', userId },
    })
    appId = a.id
    const feat = await prisma.feature.create({
      data: { id: 'f_trans', appId, elementType: 'Button', screenName: 'Home', state: 'DECLINING' },
    })
    await prisma.stateTransition.create({
      data: { featureId: feat.id, oldState: 'THRIVING', newState: 'DECLINING' },
    })
  })

  it('returns paginated transitions', async () => {
    const res = await request(app)
      .get(`/api/v1/apps/${appId}/transitions`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].newState).toBe('DECLINING')
    expect(res.body.data[0].feature.screenName).toBe('Home')
    expect(res.body.pagination.total).toBe(1)
  })

  it('filters by toState', async () => {
    const res = await request(app)
      .get(`/api/v1/apps/${appId}/transitions?toState=DEAD`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  it('returns 403 for wrong user', async () => {
    const other = await prisma.user.create({ data: { email: 'other_trans@test.com', passwordHash: 'x' } })
    const otherToken = makeToken(other.id)
    const res = await request(app)
      .get(`/api/v1/apps/${appId}/transitions`)
      .set('Authorization', `Bearer ${otherToken}`)
    expect(res.status).toBe(403)
  })
})

describe('POST /apps/:appId/rotate-key', () => {
  async function setupUserAndApp(email: string) {
    await request(app).post('/api/v1/auth/register').send({ email, password: 'Password1!' })
    const loginRes = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password1!' })
    const token = loginRes.body.token
    const createRes = await request(app)
      .post('/api/v1/apps')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'TestApp', packageName: `com.${email.split('@')[0]}.test` })
    return { token, appId: createRes.body.id, originalKey: createRes.body.apiKey }
  }

  test('returns a new fp_-prefixed API key different from the original', async () => {
    const { token, appId, originalKey } = await setupUserAndApp('rotate1@test.com')
    const res = await request(app)
      .post(`/api/v1/apps/${appId}/rotate-key`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.apiKey).toMatch(/^fp_/)
    expect(res.body.apiKey).not.toBe(originalKey)
  })

  test('old key returns 401 after rotation', async () => {
    const { token, appId, originalKey } = await setupUserAndApp('rotate2@test.com')
    await request(app).post(`/api/v1/apps/${appId}/rotate-key`).set('Authorization', `Bearer ${token}`)
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('X-API-Key', originalKey)
      .send({ appId, events: [] })
    expect(res.status).toBe(401)
  })

  test('non-owner gets 403', async () => {
    const { appId } = await setupUserAndApp('rotate3@test.com')
    await request(app).post('/api/v1/auth/register').send({ email: 'attacker@test.com', password: 'Password1!' })
    const attackerLogin = await request(app).post('/api/v1/auth/login').send({ email: 'attacker@test.com', password: 'Password1!' })
    const res = await request(app)
      .post(`/api/v1/apps/${appId}/rotate-key`)
      .set('Authorization', `Bearer ${attackerLogin.body.token}`)
    expect(res.status).toBe(403)
  })
})
