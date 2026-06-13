// server/src/routes/auth.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import crypto from 'crypto'

export const authRouter = Router()

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  appName: z.string().min(1),
  packageName: z.string().min(1),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

// In-memory user store for demo; replace with User model in production
const users = new Map<string, { passwordHash: string; id: string }>()

authRouter.post('/register', async (req, res) => {
  const result = RegisterSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { email, password, appName, packageName } = result.data
  if (users.has(email)) return res.status(409).json({ error: 'Email already registered' })

  const userId = crypto.randomUUID()
  const passwordHash = await bcrypt.hash(password, 10)
  users.set(email, { passwordHash, id: userId })

  const apiKey = 'fp_' + crypto.randomBytes(24).toString('hex')
  const app = await prisma.app.create({
    data: { name: appName, packageName, apiKey, apiKeyHash: apiKey, ownerEmail: email },
  })

  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.status(201).json({ token, apiKey: app.apiKey, appId: app.id })
})

authRouter.post('/login', async (req, res) => {
  const result = LoginSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { email, password } = result.data
  const user = users.get(email)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.json({ token })
})
