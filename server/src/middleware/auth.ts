// server/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../db/client'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  appId?: string
  userId?: string
}

/** SDK endpoints: validates X-API-Key header against the App table */
export async function apiKeyAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string | undefined
  if (!key) return res.status(401).json({ error: 'Missing X-API-Key header' })

  try {
    const app = await prisma.app.findUnique({ where: { apiKey: key } })
    if (!app) return res.status(401).json({ error: 'Invalid API key' })
    req.appId = app.id
    next()
  } catch {
    res.status(503).json({ error: 'Service unavailable' })
  }
}

/** Portal endpoints: validates Authorization: Bearer <jwt> */
export function jwtAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' })
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
