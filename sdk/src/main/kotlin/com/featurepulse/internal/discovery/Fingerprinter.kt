package com.featurepulse.internal.discovery

import android.view.View
import android.view.ViewGroup
import java.security.MessageDigest

internal object Fingerprinter {

    internal fun generate(screenName: String, resourceName: String?, viewClass: String, hierarchyPath: String): String {
        val input = if (resourceName != null) {
            "$screenName:$resourceName"
        } else {
            "$screenName:$viewClass:$hierarchyPath"
        }
        return sha256(input)
    }

    internal fun getResourceName(view: View): String? = try {
        if (view.id == View.NO_ID) null
        else view.resources?.getResourceEntryName(view.id)
    } catch (e: Exception) {
        null
    }

    internal fun getHierarchyPath(view: View): String {
        val parts = ArrayDeque<String>()
        var current: View = view
        var parent = view.parent
        while (parent is ViewGroup) {
            val vg: ViewGroup = parent
            val index = (0 until vg.childCount)
                .firstOrNull { vg.getChildAt(it) === current } ?: 0
            parts.addFirst("${current.javaClass.simpleName}[$index]")
            current = vg
            parent = vg.parent
        }
        return parts.joinToString("/")
    }

    // internal visibility so tests can call it directly
    internal fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(input.toByteArray(Charsets.UTF_8))
        return hash.joinToString("") { "%02x".format(it) }
    }
}
