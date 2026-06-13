// sdk/src/main/kotlin/com/featurepulse/internal/sync/SyncWorker.kt
package com.featurepulse.internal.sync

import android.content.Context
import androidx.work.*
import com.featurepulse.FeaturePulse
import com.featurepulse.PulseConfig
import java.util.concurrent.TimeUnit

internal class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            FeaturePulse.flush()
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    companion object {
        private const val WORK_NAME = "fp_sync_worker"

        fun schedule(context: Context, config: PulseConfig) {
            val constraints = Constraints.Builder()
                .apply {
                    if (config.syncOnWifiOnly) {
                        setRequiredNetworkType(NetworkType.UNMETERED)
                    } else {
                        setRequiredNetworkType(NetworkType.CONNECTED)
                    }
                }
                .build()

            val request = PeriodicWorkRequestBuilder<SyncWorker>(
                config.syncIntervalMs, TimeUnit.MILLISECONDS,
                (config.syncIntervalMs * 0.2).toLong().coerceAtLeast(5 * 60_000L), TimeUnit.MILLISECONDS
            )
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun cancelAll(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
