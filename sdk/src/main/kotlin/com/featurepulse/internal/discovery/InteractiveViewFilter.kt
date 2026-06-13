package com.featurepulse.internal.discovery

import android.view.View

internal object InteractiveViewFilter {

    private val ALWAYS_INTERACTIVE = setOf(
        "android.widget.Button",
        "android.widget.ImageButton",
        "android.widget.Switch",
        "android.widget.CheckBox",
        "android.widget.ToggleButton",
        "android.widget.RadioButton",
        "android.widget.Spinner",
        "com.google.android.material.floatingactionbutton.FloatingActionButton",
        "com.google.android.material.button.MaterialButton",
        "com.google.android.material.chip.Chip",
    )

    fun isInteractive(view: View): Boolean {
        if (view.isClickable || view.hasOnClickListeners()) return true
        var cls: Class<*>? = view.javaClass
        while (cls != null && cls != View::class.java) {
            if (cls.name in ALWAYS_INTERACTIVE) return true
            cls = cls.superclass
        }
        return false
    }
}
