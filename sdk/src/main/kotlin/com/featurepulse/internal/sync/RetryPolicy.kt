// sdk/src/main/kotlin/com/featurepulse/internal/sync/RetryPolicy.kt
package com.featurepulse.internal.sync

internal class RetryPolicy(
    private val baseDelayMs: Long = 60_000L,
    private val maxAttempts: Int = 5,
    private val maxDelayMs: Long = 30 * 60_000L
) {
    private var attempt = 0

    fun nextDelay(): Long? {
        if (attempt >= maxAttempts) return null
        val delay = (baseDelayMs * (1L shl attempt)).coerceAtMost(maxDelayMs)
        attempt++
        return delay
    }

    fun reset() { attempt = 0 }

    val hasAttemptsLeft: Boolean get() = attempt < maxAttempts
}
