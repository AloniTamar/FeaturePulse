// sdk/src/test/kotlin/com/featurepulse/ApiClientTest.kt
package com.featurepulse

import com.featurepulse.internal.model.EventType
import com.featurepulse.internal.model.RawEvent
import com.featurepulse.internal.sync.ApiClient
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import java.util.concurrent.TimeUnit

class ApiClientTest {

    private lateinit var server: MockWebServer
    private lateinit var client: ApiClient

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        val config = PulseConfig.Builder()
            .setApiKey("fp_test")
            .setAppId("com.test.app")
            .setServerUrl(server.url("/").toString().trimEnd('/'))
            .build()
        client = ApiClient(config)
    }

    @After
    fun tearDown() { server.shutdown() }

    private fun event(id: String) = RawEvent(
        eventId = id, featureId = "feat_1", eventType = EventType.TAP,
        timestamp = System.currentTimeMillis(), sessionId = "sess_x", deviceId = "dev_y"
    )

    @Test
    fun `sendBatch sends POST to correct endpoint`() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"accepted":1,"rejected":0,"errors":[]}"""))
        client.sendBatch(listOf(event("evt_001")))
        val req = server.takeRequest(2, TimeUnit.SECONDS)!!
        assertEquals("POST", req.method)
        assertTrue(req.path!!.contains("/api/v1/events/batch"))
    }

    @Test
    fun `sendBatch includes X-API-Key header`() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"accepted":1,"rejected":0,"errors":[]}"""))
        client.sendBatch(listOf(event("evt_002")))
        val req = server.takeRequest(2, TimeUnit.SECONDS)!!
        assertEquals("fp_test", req.getHeader("X-API-Key"))
    }

    @Test
    fun `sendBatch throws on 5xx response`() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(500))
        try {
            client.sendBatch(listOf(event("evt_003")))
            fail("Expected exception on 500")
        } catch (e: Exception) {
            assertTrue(e.message?.contains("500") == true || e is java.io.IOException)
        }
    }

    @Test
    fun `sendBatch throws on 401 response`() = runBlocking {
        server.enqueue(MockResponse().setResponseCode(401))
        try {
            client.sendBatch(listOf(event("evt_004")))
            fail("Expected exception on 401")
        } catch (e: Exception) {
            // expected
        }
    }
}
