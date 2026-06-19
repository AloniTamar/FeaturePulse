import { logger } from '../lib/logger'

export function startCronJobs(): void {
  logger.info('Running in external-trigger mode — schedule POST /api/v1/cron/nightly')
}
