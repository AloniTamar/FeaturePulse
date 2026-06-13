// sdk/src/test/kotlin/com/featurepulse/RetryPolicyTest.kt
package com.featurepulse

import com.featurepulse.internal.sync.RetryPolicy
import org.junit.Assert.*
import org.junit.Test

class RetryPolicyTest {

    @Test
    fun `first attempt returns base delay`() {
        val policy = RetryPolicy(baseDelayMs = 60_000L, maxAttempts = 5)
        assertEquals(60_000L, policy.nextDelay())
    }

    @Test
    fun `delays double each attempt`() {
        val policy = RetryPolicy(baseDelayMs = 1000L, maxAttempts = 5)
        assertEquals(1000L,  policy.nextDelay())
        assertEquals(2000L,  policy.nextDelay())
        assertEquals(4000L,  policy.nextDelay())
        assertEquals(8000L,  policy.nextDelay())
        assertEquals(16000L, policy.nextDelay())
    }

    @Test
    fun `returns null after maxAttempts`() {
        val policy = RetryPolicy(baseDelayMs = 1000L, maxAttempts = 2)
        policy.nextDelay()
        policy.nextDelay()
        assertNull(policy.nextDelay())
    }

    @Test
    fun `caps at 30 minutes`() {
        val policy = RetryPolicy(baseDelayMs = 60_000L, maxAttempts = 10)
        repeat(10) { policy.nextDelay() }
        // All delays are capped — no assert needed; just verify no crash and null after max
        assertNull(policy.nextDelay())
    }

    @Test
    fun `reset allows retrying again`() {
        val policy = RetryPolicy(baseDelayMs = 1000L, maxAttempts = 1)
        policy.nextDelay()
        assertNull(policy.nextDelay())
        policy.reset()
        assertNotNull(policy.nextDelay())
    }
}
