// server/src/cron/nightly.ts
import cron from 'node-cron'
import { runNightlyAggregation } from '../services/aggregation'

let scheduled = false

export function startCronJobs(): void {
  if (scheduled) return
  scheduled = true

  // 02:00 AM UTC every day
  cron.schedule('0 2 * * *', async () => {
    try {
      await runNightlyAggregation()
    } catch (err) {
      console.error('[Cron] Nightly aggregation failed:', err)
    }
  }, { timezone: 'UTC' })

  console.log('[Cron] Nightly aggregation scheduled for 02:00 UTC')
}
