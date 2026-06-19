// Aggregation is triggered externally via POST /api/v1/cron/nightly.
// Configure Railway cron (or GitHub Actions schedule) to call that endpoint with Bearer <CRON_SECRET>.
export function startCronJobs(): void {
  console.log('[Cron] Running in external-trigger mode — schedule POST /api/v1/cron/nightly')
}
