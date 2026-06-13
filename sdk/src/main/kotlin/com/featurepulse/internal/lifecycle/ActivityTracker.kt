// sdk/src/main/kotlin/com/featurepulse/internal/lifecycle/ActivityTracker.kt
package com.featurepulse.internal.lifecycle

import android.app.Activity
import android.app.Application
import android.os.Bundle
import androidx.fragment.app.FragmentActivity
import com.featurepulse.PulseConfig
import com.featurepulse.internal.discovery.ViewTreeScanner
import com.featurepulse.internal.tracking.EventRecorder
import com.featurepulse.internal.tracking.TouchInterceptor
import com.featurepulse.internal.tracking.VisibilityTracker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal class ActivityTracker(
    private val config: PulseConfig,
    private val eventRecorder: EventRecorder,
    private val visibilityTracker: VisibilityTracker,
    private val scope: CoroutineScope
) : Application.ActivityLifecycleCallbacks {

    private val registeredActivities = java.util.WeakHashMap<Activity, Boolean>()

    override fun onActivityResumed(activity: Activity) {
        val screenName = activity.javaClass.simpleName
        if (config.excludedScreens.contains(screenName)) return

        val root = activity.window.decorView

        // Scan view tree off main thread
        scope.launch(Dispatchers.Default) {
            try {
                val elements = ViewTreeScanner.scan(root, screenName)
                withContext(Dispatchers.Main) {
                    visibilityTracker.trackViews(elements.map { it.first })
                }
            } catch (_: Exception) {
                // View tree read on background thread can rarely race with layout; skip this scan
            }
        }

        // Wrap Window.Callback only once
        val cb = activity.window.callback
        if (cb !is TouchInterceptor) {
            activity.window.callback = TouchInterceptor(
                original = cb,
                rootView = root,
                onTap    = { view -> eventRecorder.recordTap(view) }
            )
        }

        // Register fragment callbacks once per activity instance
        if (activity is FragmentActivity && !registeredActivities.containsKey(activity)) {
            registeredActivities[activity] = true
            activity.supportFragmentManager.registerFragmentLifecycleCallbacks(
                FragmentTracker(config, eventRecorder, visibilityTracker, scope),
                true  // recursive = track nested fragments
            )
        }
    }

    override fun onActivityPaused(activity: Activity) {
        visibilityTracker.onScreenChanged()
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
    override fun onActivityStarted(activity: Activity) {}
    override fun onActivityStopped(activity: Activity) {}
    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
    override fun onActivityDestroyed(activity: Activity) {}
}
