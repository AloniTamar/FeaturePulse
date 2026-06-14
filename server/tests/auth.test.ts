import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'
import bcrypt from 'bcryptjs'

beforeEach(async () => {
  await prisma.app.deleteMany()
  await prisma.user.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

describe('POST /auth/register', () => {
  it('creates only a User — no App — and returns just a token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'new@example.com', password: 'password123',
    })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeTruthy()
    expect(res.body.apiKey).toBeUndefined()
    expect(res.body.appId).toBeUndefined()
    const users = await prisma.user.findMany()
    expect(users).toHaveLength(1)
    const apps = await prisma.app.findMany()
    expect(apps).toHaveLength(0)
  })

  it('rejects duplicate email with 409', async () => {
    await request(app).post('/api/v1/auth/register').send({ email: 'dup@example.com', password: 'password123' })
    const res = await request(app).post('/api/v1/auth/register').send({ email: 'dup@example.com', password: 'password123' })
    expect(res.status).toBe(409)
  })
})

describe('POST /auth/login', () => {
  let userId: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: 'login@example.com', passwordHash: await bcrypt.hash('pass1234', 10) },
    })
    userId = user.id
    await prisma.app.create({
      data: { name: 'App One', packageName: 'com.one', apiKey: 'fp_one', apiKeyHash: 'fp_one', userId },
    })
    await prisma.app.create({
      data: { name: 'App Two', packageName: 'com.two', apiKey: 'fp_two', apiKeyHash: 'fp_two', userId },
    })
  })

  it('returns token and apps[] sorted by createdAt', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'login@example.com', password: 'pass1234',
    })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(Array.isArray(res.body.apps)).toBe(true)
    expect(res.body.apps).toHaveLength(2)
    expect(res.body.apps[0]).toMatchObject({ name: 'App One', packageName: 'com.one', apiKey: 'fp_one' })
    expect(res.body.apps[0].featureCount).toBe(0)
  })

  it('returns empty apps array when user has no apps', async () => {
    await prisma.app.deleteMany({ where: { userId } })
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'login@example.com', password: 'pass1234',
    })
    expect(res.status).toBe(200)
    expect(res.body.apps).toEqual([])
  })
})

describe('PATCH /auth/me/password', () => {
  it('changes the password when current password is correct', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ email: 'pw@example.com', password: 'oldpass1' })
    const token = reg.body.token
    const res = await request(app)
      .patch('/api/v1/auth/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'oldpass1', newPassword: 'newpass99' })
    expect(res.status).toBe(204)
    // Confirm new password works
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'pw@example.com', password: 'newpass99' })
    expect(login.status).toBe(200)
  })

  it('returns 401 when current password is wrong', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({ email: 'pw2@example.com', password: 'oldpass1' })
    const token = reg.body.token
    const res = await request(app)
      .patch('/api/v1/auth/me/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'wrongpass', newPassword: 'newpass99' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /auth/me', () => {
  it('deletes the authenticated user and all their apps', async () => {
    const reg = await request(app).post('/api/v1/auth/register').send({
      email: 'del@example.com', password: 'password123',
    })
    const token = reg.body.token
    const user = await prisma.user.findUnique({ where: { email: 'del@example.com' } })
    await prisma.app.create({
      data: { name: 'A', packageName: 'com.a', apiKey: 'fp_del', apiKeyHash: 'fp_del', userId: user!.id },
    })

    const res = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(204)

    const remaining = await prisma.user.findUnique({ where: { email: 'del@example.com' } })
    expect(remaining).toBeNull()
    const apps = await prisma.app.findMany()
    expect(apps).toHaveLength(0)
  })
})
