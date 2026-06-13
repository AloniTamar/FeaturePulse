// sdk/src/main/kotlin/com/featurepulse/internal/sync/ApiClient.kt
package com.featurepulse.internal.sync

import com.featurepulse.PulseConfig
import com.featurepulse.internal.model.RawEvent

internal class ApiClient(private val config: PulseConfig) {
    suspend fun sendBatch(events: List<RawEvent>) {
        // Implemented in Task 24
        throw NotImplementedError("ApiClient.sendBatch not yet implemented")
    }
    suspend fun fetchRemoteConfig(): Map<String, Any> = emptyMap()
}
