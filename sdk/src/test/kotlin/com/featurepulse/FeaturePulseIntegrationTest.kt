// sdk/src/test/kotlin/com/featurepulse/FeaturePulseIntegrationTest.kt
package com.featurepulse

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import com.featurepulse.internal.model.EventType
import com.featurepulse.internal.model.RawEvent
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [30], application = Application::class)
class FeaturePulseIntegrationTest {

    private lateinit var server: MockWebServer
    private lateinit var app: Application

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        app = ApplicationProvider.getApplicationContext()
        FeaturePulse.reset()
        val config = PulseConfig.Builder()
            .setApiKey("fp_test_integration")
            .setAppId("com.test.integration")
            .setServerUrl(server.url("/").toString().trimEnd('/'))
            .setBatchSize(10)
            .build()
        FeaturePulse.init(app, config)
    }

    @After
    fun tearDown() {
        server.shutdown()
        FeaturePulse.reset()
    }

    @Test
    fun `init registers lifecycle callbacks without crashing`() {
        assertTrue(FeaturePulse.isInitialized())
    }

    @Test
    fun `flush sends batch to server`() = runBlocking {
        val buffer = FeaturePulse.getBuffer()
        repeat(3) { i ->
            buffer.add(RawEvent(
                eventId   = "integration_evt_$i",
                featureId = "feat_test",
                eventType = EventType.TAP,
                timestamp = System.currentTimeMillis(),
                sessionId = "sess_int",
                deviceId  = "dev_int"
            ))
        }
        server.enqueue(MockResponse().setResponseCode(200)
            .setBody("""{"accepted":3,"rejected":0,"errors":[]}"""))

        FeaturePulse.flush()

        val req = server.takeRequest(3, TimeUnit.SECONDS)
        assertNotNull("Expected HTTP request after flush", req)
        assertEquals("POST", req!!.method)
        assertTrue(req.path!!.contains("/api/v1/events/batch"))
        assertEquals("fp_test_integration", req.getHeader("X-API-Key"))
    }

    @Test
    fun `flush with empty buffer sends no HTTP request`() = runBlocking {
        FeaturePulse.flush()
        delay(200)
        val req = server.takeRequest(500, TimeUnit.MILLISECONDS)
        assertNull("Expected no HTTP request for empty buffer", req)
    }

    @Test
    fun `pause stops recording and resume re-enables it`() {
        FeaturePulse.pause()
        assertFalse(FeaturePulse.isEnabled())
        FeaturePulse.resume()
        assertTrue(FeaturePulse.isEnabled())
    }

    @Test
    fun `disable makes isEnabled return false`() {
        FeaturePulse.disable()
        assertFalse(FeaturePulse.isEnabled())
    }
}
