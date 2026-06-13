package com.featurepulse

import android.app.Application
import android.view.View
import android.widget.*
import androidx.test.core.app.ApplicationProvider
import com.featurepulse.internal.discovery.InteractiveViewFilter
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class InteractiveViewFilterTest {

    private val ctx = ApplicationProvider.getApplicationContext<Application>()

    @Test fun `Button is interactive`() = assertTrue(InteractiveViewFilter.isInteractive(Button(ctx)))
    @Test fun `ImageButton is interactive`() = assertTrue(InteractiveViewFilter.isInteractive(ImageButton(ctx)))
    @Test fun `Switch is interactive`() = assertTrue(InteractiveViewFilter.isInteractive(Switch(ctx)))
    @Test fun `CheckBox is interactive`() = assertTrue(InteractiveViewFilter.isInteractive(CheckBox(ctx)))
    @Test fun `ToggleButton is interactive`() = assertTrue(InteractiveViewFilter.isInteractive(ToggleButton(ctx)))
    @Test fun `RadioButton is interactive`() = assertTrue(InteractiveViewFilter.isInteractive(RadioButton(ctx)))

    @Test fun `plain TextView is not interactive`() = assertFalse(InteractiveViewFilter.isInteractive(TextView(ctx)))
    @Test fun `plain View is not interactive`() = assertFalse(InteractiveViewFilter.isInteractive(View(ctx)))

    @Test
    fun `View with isClickable=true is interactive`() {
        val view = View(ctx).apply { isClickable = true }
        assertTrue(InteractiveViewFilter.isInteractive(view))
    }

    @Test
    fun `View with setOnClickListener is interactive`() {
        val view = View(ctx).apply { setOnClickListener { } }
        assertTrue(InteractiveViewFilter.isInteractive(view))
    }

    @Test
    fun `View with click listener but isClickable=false is still interactive`() {
        val view = View(ctx).apply {
            setOnClickListener { }
            isClickable = false  // explicitly override what setOnClickListener set
        }
        assertTrue(InteractiveViewFilter.isInteractive(view))
    }
}
