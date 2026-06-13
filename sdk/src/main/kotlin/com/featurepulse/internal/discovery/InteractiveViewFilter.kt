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
        if (view.isClickable) return true
        val name = view.javaClass.name
        val superName = view.javaClass.superclass?.name ?: ""
        return ALWAYS_INTERACTIVE.any { it == name || it == superName }
    }
}
