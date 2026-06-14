import { Router } from 'express'
import { prisma } from '../db/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { jwtAuth, type AuthRequest } from '../middleware/auth'

export const authRouter = Router()

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

authRouter.post('/register', async (req, res) => {
  const result = RegisterSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { email, password } = result.data
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ error: 'Email already registered' })

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { email, passwordHash } })
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.status(201).json({ token })
})

authRouter.post('/login', async (req, res) => {
  const result = LoginSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { email, password } = result.data
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const apps = await prisma.app.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { features: true } } },
  })

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.json({
    token,
    apps: apps.map(a => ({
      id: a.id,
      name: a.name,
      packageName: a.packageName,
      apiKey: a.apiKey,
      createdAt: a.createdAt,
      featureCount: a._count.features,
    })),
  })
})

authRouter.delete('/me', jwtAuth, async (req: AuthRequest, res) => {
  await prisma.user.delete({ where: { id: req.userId! } })
  res.status(204).end()
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
})

authRouter.patch('/me/password', jwtAuth, async (req: AuthRequest, res) => {
  const result = ChangePasswordSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const user = await prisma.user.findUnique({ where: { id: req.userId! } })
  if (!user) return res.status(404).json({ error: 'User not found' })

  const valid = await bcrypt.compare(result.data.currentPassword, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })

  const passwordHash = await bcrypt.hash(result.data.newPassword, 10)
  await prisma.user.update({ where: { id: req.userId! }, data: { passwordHash } })
  res.status(204).end()
})
