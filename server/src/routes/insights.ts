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
      return res.json(result)
    }

    // nightly: return stored insight
    const stored = await prisma.appInsight.findUnique({ where: { appId } })
    if (!stored) return res.status(404).json({ error: 'No insights yet — run cron first' })
    res.json({
      summary: stored.summary,
      bullets: stored.bullets as string[],
      generatedAt: stored.generatedAt.toISOString(),
    })
  } catch (e) {
    console.error(e)
    res.status(503).json({ error: 'Service unavailable' })
  }
})
