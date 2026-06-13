package com.featurepulse.internal.model

import com.google.gson.annotations.SerializedName

internal data class RawEvent(
    @SerializedName("eventId")   val eventId: String,
    @SerializedName("featureId") val featureId: String,
    @SerializedName("eventType") val eventType: EventType,
    @SerializedName("timestamp") val timestamp: Long,
    @SerializedName("sessionId") val sessionId: String,
    @SerializedName("deviceId")  val deviceId: String
)
