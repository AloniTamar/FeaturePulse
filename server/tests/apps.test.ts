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
