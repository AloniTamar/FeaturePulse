// sdk/src/main/kotlin/com/featurepulse/FeaturePulse.kt
package com.featurepulse

import android.app.Application
import android.content.Context
import com.featurepulse.internal.buffer.BufferPersistence
import com.featurepulse.internal.buffer.EventBuffer
import com.featurepulse.internal.lifecycle.ActivityTracker
import com.featurepulse.internal.session.SessionManager
import com.featurepulse.internal.sync.ApiClient
import com.featurepulse.internal.sync.SyncWorker
import com.featurepulse.internal.tracking.EventRecorder
import com.featurepulse.internal.tracking.VisibilityTracker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.UUID

object FeaturePulse {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private lateinit var config: PulseConfig
    private lateinit var buffer: EventBuffer
    private lateinit var persistence: BufferPersistence
    private lateinit var sessionManager: SessionManager
    private lateinit var eventRecorder: EventRecorder
    private lateinit var visibilityTracker: VisibilityTracker
    private lateinit var apiClient: ApiClient

    @Volatile private var initialized = false
    @Volatile private var paused = false

    @JvmStatic
    fun init(application: Application) =
        init(application, PulseConfig.Builder()
            .setApiKey("REPLACE_ME")
            .setAppId(application.packageName)
            .build())

    @JvmStatic
    fun init(application: Application, config: PulseConfig) {
        if (initialized) return
        this.config = config
        if (!config.enabled) return

        val deviceId = getOrCreateDeviceId(application)

        buffer       = EventBuffer(config.batchSize)
        persistence  = BufferPersistence(application)
        sessionManager = SessionManager()
        apiClient    = ApiClient(config)

        // Restore events buffered before last kill
        persistence.load().forEach { buffer.add(it) }

        var currentScreen = ""
        eventRecorder = EventRecorder(buffer, sessionManager, deviceId) { currentScreen }

        visibilityTracker = VisibilityTracker(
            minDurationMs = config.minImpressionDurationMs
        ) { view ->
            if (!paused) eventRecorder.recordImpression(view)
        }

        val activityTracker = ActivityTracker(config, eventRecorder, visibilityTracker, scope)
        application.registerActivityLifecycleCallbacks(activityTracker)

        SyncWorker.schedule(application, config)
        initialized = true
    }

    @JvmStatic fun pause()   { paused = true }
    @JvmStatic fun resume()  { paused = false }
    @JvmStatic fun disable() { paused = true; buffer.clear(); persistence.clear() }

    @JvmStatic
    fun flush() {
        scope.launch {
            val events = buffer.drainAll()
            if (events.isEmpty()) return@launch
            try {
                apiClient.sendBatch(events)
                persistence.clear()
            } catch (e: Exception) {
                events.forEach { buffer.add(it) }
                persistence.save(buffer.peek())
            }
        }
    }

    @JvmStatic fun setDebugMode(enabled: Boolean) { /* toggle PulseLog.debugEnabled */ }
    @JvmStatic fun ignore(viewId: Int)            { /* add to ignored-ids set in EventRecorder */ }
    @JvmStatic fun ignoreScreen(name: String)     { /* append to config.excludedScreens at runtime */ }

    private fun getOrCreateDeviceId(context: Context): String {
        val prefs = context.getSharedPreferences("fp_internal", Context.MODE_PRIVATE)
        return prefs.getString("device_id", null) ?: run {
            val id = UUID.randomUUID().toString().replace("-", "").take(16)
            prefs.edit().putString("device_id", id).apply()
            id
        }
    }
}
