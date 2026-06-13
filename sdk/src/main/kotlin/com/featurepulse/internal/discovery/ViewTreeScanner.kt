// sdk/src/main/kotlin/com/featurepulse/internal/discovery/ViewTreeScanner.kt
package com.featurepulse.internal.discovery

import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.featurepulse.internal.model.DiscoveredElement

internal object ViewTreeScanner {

    /**
     * Recursively scans [root] and returns all interactive views paired with their featureId.
     * Must be called off the main thread (caller's responsibility).
     * Max depth 50 to guard against infinite loops in malformed hierarchies.
     */
    fun scan(root: View, screenName: String, maxDepth: Int = 50): List<Pair<View, DiscoveredElement>> {
        val result = mutableListOf<Pair<View, DiscoveredElement>>()
        traverse(root, screenName, result, 0, maxDepth)
        return result
    }

    private fun traverse(
        view: View,
        screenName: String,
        result: MutableList<Pair<View, DiscoveredElement>>,
        depth: Int,
        maxDepth: Int
    ) {
        if (depth > maxDepth) return

        if (InteractiveViewFilter.isInteractive(view)) {
            val resourceName = Fingerprinter.getResourceName(view)
            val hierarchyPath = Fingerprinter.getHierarchyPath(view)
            val featureId = Fingerprinter.generate(
                screenName, resourceName, view.javaClass.simpleName, hierarchyPath
            )
            result.add(
                Pair(
                    view,
                    DiscoveredElement(
                        featureId = featureId,
                        viewClass = view.javaClass.simpleName,
                        resourceName = resourceName,
                        screenName = screenName,
                        hierarchyPath = hierarchyPath
                    )
                )
            )
        }

        // RecyclerView items are handled dynamically via AdapterDataObserver — skip children here
        if (view is RecyclerView) return

        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                traverse(view.getChildAt(i), screenName, result, depth + 1, maxDepth)
            }
        }
    }
}
