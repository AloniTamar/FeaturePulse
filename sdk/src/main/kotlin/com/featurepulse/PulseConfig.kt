// sdk/src/main/kotlin/com/featurepulse/PulseConfig.kt
package com.featurepulse

import java.util.concurrent.TimeUnit

data class PulseConfig internal constructor(
    val apiKey: String,
    val appId: String,
    val serverUrl: String,
    val batchSize: Int,
    val syncIntervalMs: Long,
    val syncOnWifiOnly: Boolean,
    val excludedScreens: List<String>,
    val minImpressionDurationMs: Long,
    val enabled: Boolean
) {
    class Builder {
        private var apiKey: String = ""
        private var appId: String = ""
        private var serverUrl: String = "https://api.featurepulse.dev"
        private var batchSize: Int = 500
        private var syncIntervalMs: Long = 30 * 60 * 1000L
        private var syncOnWifiOnly: Boolean = false
        private var excludedScreens: List<String> = emptyList()
        private var minImpressionDurationMs: Long = 1000L
        private var enabled: Boolean = true

        fun setApiKey(key: String) = apply { apiKey = key }
        fun setAppId(id: String) = apply { appId = id }
        fun setServerUrl(url: String) = apply { serverUrl = url }
        fun setBatchSize(size: Int) = apply { batchSize = size }
        fun setSyncInterval(amount: Long, unit: TimeUnit) = apply { syncIntervalMs = unit.toMillis(amount) }
        fun setSyncOnWifiOnly(wifiOnly: Boolean) = apply { syncOnWifiOnly = wifiOnly }
        fun setExcludedScreens(screens: List<String>) = apply { excludedScreens = screens.toList() }
        fun setMinImpressionDuration(durationMs: Long) = apply { minImpressionDurationMs = durationMs }
        fun setEnabled(enabled: Boolean) = apply { this.enabled = enabled }

        fun build(): PulseConfig {
            require(apiKey.isNotBlank()) { "PulseConfig: apiKey must not be blank" }
            require(appId.isNotBlank()) { "PulseConfig: appId must not be blank" }
            require(batchSize in 1..1000) { "PulseConfig: batchSize must be 1–1000" }
            require(serverUrl.isNotBlank()) { "PulseConfig: serverUrl must not be blank" }
            require(syncIntervalMs > 0) { "PulseConfig: syncIntervalMs must be positive" }
            require(minImpressionDurationMs >= 0) { "PulseConfig: minImpressionDurationMs must be non-negative" }
            return PulseConfig(
                apiKey, appId, serverUrl, batchSize, syncIntervalMs,
                syncOnWifiOnly, excludedScreens, minImpressionDurationMs, enabled
            )
        }
    }
}
