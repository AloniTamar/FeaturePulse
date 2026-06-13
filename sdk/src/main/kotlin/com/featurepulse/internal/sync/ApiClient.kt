// sdk/src/main/kotlin/com/featurepulse/internal/sync/ApiClient.kt
package com.featurepulse.internal.sync

import com.featurepulse.PulseConfig
import com.featurepulse.internal.model.BatchPayload
import com.featurepulse.internal.model.RawEvent
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

internal class ApiClient(private val config: PulseConfig) {

    private val gson = Gson()
    private val JSON = "application/json".toMediaType()
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun sendBatch(events: List<RawEvent>) = withContext(Dispatchers.IO) {
        val payload = BatchPayload(
            appId      = config.appId,
            deviceId   = "sdk",
            sdkVersion = "1.0.0",
            events     = events
        )
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("${config.serverUrl}/api/v1/events/batch")
            .header("X-API-Key", config.apiKey)
            .post(body)
            .build()

        val response = http.newCall(request).execute()
        response.use {
            if (!it.isSuccessful) {
                throw IOException("Server returned ${it.code}")
            }
        }
    }

    suspend fun fetchRemoteConfig(): Map<String, Any> = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${config.serverUrl}/api/v1/apps/config?appId=${config.appId}")
            .header("X-API-Key", config.apiKey)
            .get()
            .build()

        val response = http.newCall(request).execute()
        response.use {
            if (!it.isSuccessful) return@withContext emptyMap()
            @Suppress("UNCHECKED_CAST")
            gson.fromJson(it.body?.string() ?: "{}", Map::class.java) as Map<String, Any>
        }
    }
}
