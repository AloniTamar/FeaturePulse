import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth, type AuthRequest } from '../middleware/auth'
import { generateAndSaveInsights } from '../services/insights'

export const insightsRouter = Router()

insightsRouter.get('/apps/:appId/insights', jwtAuth, async (req: AuthRequest, res) => {
  const { appId } = req.params
  try {
    const app = await prisma.app.findUnique({ where: { id: appId } })
    if (!app) return res.status(404).json({ error: 'App not found' })
    if (app.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' })
    if (!app.aiInsightsEnabled) return res.status(404).json({ error: 'AI insights not enabled' })

    if (app.aiInsightsMode === 'on_demand') {
      const result = await generateAndSaveInsights(appId)
      if (!result) {
        return res.json({ unavailable: true, reason: 'AI model temporarily unreachable. Please try again later.' })
      }
      return res.json(result)
    }

    // nightly mode: return stored insight
    const stored = await prisma.appInsight.findUnique({ where: { appId } })
    if (!stored) {
      return res.json({ unavailable: true, reason: 'No insights generated yet — check back after 02:00 UTC.' })
    }
    res.json({
      summary: stored.summary,
      bullets: stored.bullets as string[],
      generatedAt: stored.generatedAt.toISOString(),
    })
  } catch (e) {
    res.status(503).json({ error: 'Service unavailable' })
  }
})
