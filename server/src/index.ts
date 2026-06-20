// server/src/index.ts
import * as Sentry from '@sentry/node'

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  })
}

import express from 'express'
import cors from 'cors'
import pinoHttp from 'pino-http'
import { logger } from './lib/logger'
import { eventsRouter } from './routes/events'
import { featuresRouter } from './routes/features'
import { dashboardRouter } from './routes/dashboard'
import { analyticsRouter } from './routes/analytics'
import { insightsRouter } from './routes/insights'
import { appsRouter } from './routes/apps'
import { authRouter } from './routes/auth'
import { startCronJobs } from './cron/nightly'
import { runNightlyAggregation } from './services/aggregation'

const app = express()

const corsOrigin = process.env.CORS_ORIGIN
if (!corsOrigin && process.env.NODE_ENV === 'production') {
  console.error('FATAL: CORS_ORIGIN must be set in production')
  process.exit(1)
}
app.use(cors({ origin: corsOrigin ?? '*' }))
app.use(express.json({ limit: '2mb' }))

if (process.env.NODE_ENV !== 'test') {
  app.use(pinoHttp({ logger }))
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/api/v1/cron/nightly', async (req, res) => {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    await runNightlyAggregation()
    res.json({ ok: true, message: 'Aggregation complete' })
  } catch (err) {
    logger.error({ err }, 'Nightly aggregation failed')
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

Sentry.setupExpressErrorHandler(app)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error')
  res.status(500).json({ error: 'Internal server error' })
})

const PORT = parseInt(process.env.PORT ?? '3000')
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`FeaturePulse server running on :${PORT}`))
}

export { app }
