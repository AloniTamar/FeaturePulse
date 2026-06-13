// sdk/src/main/kotlin/com/featurepulse/internal/tracking/TouchInterceptor.kt
package com.featurepulse.internal.tracking

import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window

/**
 * Proxies Window.Callback to intercept touch events without modifying the host app.
 * Implements Window.Callback by delegation — only overrides dispatchTouchEvent.
 */
internal class TouchInterceptor(
    private val original: Window.Callback,
    private val rootView: View,
    private val onTap: (View) -> Unit
) : Window.Callback by original {

    override fun dispatchTouchEvent(event: MotionEvent?): Boolean {
        if (event?.action == MotionEvent.ACTION_UP) {
            findViewAt(rootView, event.rawX, event.rawY)?.let { onTap(it) }
        }
        return original.dispatchTouchEvent(event)
    }

    private fun findViewAt(root: View, x: Float, y: Float): View? {
        val loc = IntArray(2)
        root.getLocationOnScreen(loc)
        val inBounds = x >= loc[0] && x <= loc[0] + root.width
                && y >= loc[1] && y <= loc[1] + root.height
        if (!inBounds) return null

        if (root is ViewGroup) {
            // iterate children in reverse (top-most drawn last = highest z-order)
            for (i in root.childCount - 1 downTo 0) {
                val hit = findViewAt(root.getChildAt(i) ?: continue, x, y)
                if (hit != null) return hit
            }
        }
        return if (root.isClickable) root else null
    }
}
