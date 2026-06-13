// sdk/src/main/kotlin/com/featurepulse/internal/sync/RemoteConfigCache.kt
package com.featurepulse.internal.sync

import android.content.Context
import com.featurepulse.PulseConfig
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

internal class RemoteConfigCache(
    context: Context,
    private val apiClient: ApiClient,
    private val cacheTtlMs: Long = 6 * 60 * 60 * 1000L  // 6 hours
) {
    private val prefs = context.getSharedPreferences("fp_remote_config", Context.MODE_PRIVATE)
    private val gson = Gson()

    data class CachedConfig(val config: Map<String, Any>, val fetchedAt: Long)

    suspend fun getConfig(): Map<String, Any> {
        val cached = loadFromPrefs()
        if (cached != null && System.currentTimeMillis() - cached.fetchedAt < cacheTtlMs) {
            return cached.config
        }
        return try {
            val fresh = apiClient.fetchRemoteConfig()
            saveToPrefs(CachedConfig(fresh, System.currentTimeMillis()))
            fresh
        } catch (e: Exception) {
            cached?.config ?: PulseConfig.REMOTE_DEFAULTS
        }
    }

    private fun loadFromPrefs(): CachedConfig? {
        val json = prefs.getString("config", null) ?: return null
        return try {
            val type = object : TypeToken<CachedConfig>() {}.type
            gson.fromJson(json, type)
        } catch (e: Exception) { null }
    }

    private fun saveToPrefs(cached: CachedConfig) {
        prefs.edit().putString("config", gson.toJson(cached)).apply()
    }
}
