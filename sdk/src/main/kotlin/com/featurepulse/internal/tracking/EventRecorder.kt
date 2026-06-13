// sdk/src/main/kotlin/com/featurepulse/internal/tracking/EventRecorder.kt
package com.featurepulse.internal.tracking

import android.view.View
import com.featurepulse.internal.buffer.EventBuffer
import com.featurepulse.internal.discovery.Fingerprinter
import com.featurepulse.internal.model.EventType
import com.featurepulse.internal.model.RawEvent
import com.featurepulse.internal.session.SessionManager
import java.util.UUID

internal class EventRecorder(
    private val buffer: EventBuffer,
    private val sessionManager: SessionManager,
    private val deviceId: String,
    private val currentScreen: () -> String
) {
    fun recordTap(view: View)        = record(view, EventType.TAP)
    fun recordLongPress(view: View)  = record(view, EventType.LONG_PRESS)
    fun recordImpression(view: View) = record(view, EventType.IMPRESSION)

    private fun record(view: View, type: EventType) {
        val resourceName  = Fingerprinter.getResourceName(view)
        val hierarchyPath = Fingerprinter.getHierarchyPath(view)
        val featureId = Fingerprinter.generate(
            currentScreen(), resourceName, view.javaClass.simpleName, hierarchyPath
        )
        buffer.add(
            RawEvent(
                eventId   = UUID.randomUUID().toString(),
                featureId = featureId,
                eventType = type,
                timestamp = System.currentTimeMillis(),
                sessionId = sessionManager.getOrCreateSession(),
                deviceId  = deviceId
            )
        )
    }
}
