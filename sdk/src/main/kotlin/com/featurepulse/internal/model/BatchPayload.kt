package com.featurepulse.internal.model

import com.google.gson.annotations.SerializedName

internal data class BatchPayload(
    @SerializedName("appId")      val appId: String,
    @SerializedName("deviceId")   val deviceId: String,
    @SerializedName("sdkVersion") val sdkVersion: String,
    @SerializedName("events")     val events: List<RawEvent>
)
