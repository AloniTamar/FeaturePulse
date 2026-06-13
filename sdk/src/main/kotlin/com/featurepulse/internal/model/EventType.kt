package com.featurepulse.internal.model

import com.google.gson.annotations.SerializedName

enum class EventType {
    @SerializedName("TAP") TAP,
    @SerializedName("LONG_PRESS") LONG_PRESS,
    @SerializedName("SWIPE") SWIPE,
    @SerializedName("IMPRESSION") IMPRESSION
}
