// sdk/src/main/kotlin/com/featurepulse/internal/lifecycle/FragmentTracker.kt
package com.featurepulse.internal.lifecycle

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import com.featurepulse.PulseConfig
import com.featurepulse.internal.discovery.ViewTreeScanner
import com.featurepulse.internal.tracking.EventRecorder
import com.featurepulse.internal.tracking.VisibilityTracker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal class FragmentTracker(
    private val config: PulseConfig,
    private val eventRecorder: EventRecorder,
    private val visibilityTracker: VisibilityTracker,
    private val scope: CoroutineScope
) : FragmentManager.FragmentLifecycleCallbacks() {

    override fun onFragmentResumed(fm: FragmentManager, fragment: Fragment) {
        val screenName = fragment.javaClass.simpleName
        if (config.excludedScreens.contains(screenName)) return
        val rootView = fragment.view ?: return

        scope.launch(Dispatchers.Default) {
            try {
                val elements = ViewTreeScanner.scan(rootView, screenName)
                withContext(Dispatchers.Main) {
                    visibilityTracker.trackViews(elements.map { it.first })
                }
            } catch (_: Exception) {
                // View tree read on background thread can rarely race with layout; skip this scan
            }
        }
    }

    override fun onFragmentPaused(fm: FragmentManager, fragment: Fragment) {
        visibilityTracker.onScreenChanged()
    }
}
