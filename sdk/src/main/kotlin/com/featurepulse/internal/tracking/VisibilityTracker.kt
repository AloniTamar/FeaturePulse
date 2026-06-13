// sdk/src/main/kotlin/com/featurepulse/internal/tracking/VisibilityTracker.kt
package com.featurepulse.internal.tracking

import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.view.View

internal class VisibilityTracker(
    private val minVisibleRatio: Float = 0.5f,
    private val minDurationMs: Long = 1000L,
    private val onImpression: (View) -> Unit
) {
    private val handler = Handler(Looper.getMainLooper())
    private val pending = mutableMapOf<Int, Runnable>()      // identity hash → runnable
    private val impressed = mutableSetOf<Int>()              // already fired this screen

    fun trackViews(views: List<View>) {
        views.forEach { view ->
            val id = System.identityHashCode(view)
            if (id !in impressed && isViewSufficientlyVisible(view)) {
                schedulePending(view, id)
            }
        }
    }

    fun onScreenChanged() {
        pending.values.forEach { handler.removeCallbacks(it) }
        pending.clear()
        impressed.clear()
    }

    fun isViewSufficientlyVisible(view: View): Boolean {
        if (!view.isShown) return false
        val rect = Rect()
        if (!view.getGlobalVisibleRect(rect)) return false
        val total = view.width * view.height
        if (total == 0) return false
        val visible = rect.width() * rect.height()
        return visible.toFloat() / total.toFloat() >= minVisibleRatio
    }

    private fun schedulePending(view: View, id: Int) {
        if (id in pending) return
        val runnable = Runnable {
            pending.remove(id)
            if (id !in impressed && isViewSufficientlyVisible(view)) {
                impressed.add(id)
                onImpression(view)
            }
        }
        pending[id] = runnable
        handler.postDelayed(runnable, minDurationMs)
    }
}
