// server/src/index.ts
import express from 'express'
import cors from 'cors'
import { eventsRouter } from './routes/events'
import { featuresRouter } from './routes/features'
import { dashboardRouter } from './routes/dashboard'
import { analyticsRouter } from './routes/analytics'
import { insightsRouter } from './routes/insights'
import { appsRouter } from './routes/apps'
import { authRouter } from './routes/auth'
import { startCronJobs } from './cron/nightly'
import { runNightlyAggregation } from './services/aggregation'
import { jwtAuth } from './middleware/auth'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/api/v1/cron', jwtAuth, async (_req, res) => {
  try {
    await runNightlyAggregation()
    res.json({ ok: true, message: 'Aggregation complete' })
  } catch (err) {
    res.status(500).json({ error: 'Cron job failed' })
  }
})

app.use('/api/v1/auth',     authRouter)
app.use('/api/v1/apps',     appsRouter)
app.use('/api/v1/events',   eventsRouter)
app.use('/api/v1/features', featuresRouter)
app.use('/api/v1',          dashboardRouter)
app.use('/api/v1',          analyticsRouter)
app.use('/api/v1',          insightsRouter)

if (process.env.NODE_ENV !== 'test') {
  startCronJobs()
}

const PORT = parseInt(process.env.PORT ?? '3000')
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`FeaturePulse server running on :${PORT}`))
}

export { app }
