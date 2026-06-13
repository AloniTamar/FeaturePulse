package com.featurepulse.internal.model

internal data class DiscoveredElement(
    val featureId: String,
    val viewClass: String,
    val resourceName: String?,
    val screenName: String,
    val hierarchyPath: String,
    val discoveredAt: Long = System.currentTimeMillis()
)
