package com.featurepulse.internal.session

import java.util.UUID

internal class SessionManager(private val sessionTimeoutMs: Long = 30_000L) {

    private var currentSessionId: String? = null
    private var lastActivityTime: Long = 0

    @Synchronized
    fun getOrCreateSession(): String {
        val now = System.currentTimeMillis()
        if (currentSessionId == null || (now - lastActivityTime) > sessionTimeoutMs) {
            currentSessionId = "sess_" + UUID.randomUUID().toString().replace("-", "").take(12)
        }
        lastActivityTime = now
        return currentSessionId!!
    }

    @Synchronized
    fun onBackground() {
        lastActivityTime = System.currentTimeMillis()
    }

    @Synchronized
    fun reset() {
        currentSessionId = null
        lastActivityTime = 0
    }
}
