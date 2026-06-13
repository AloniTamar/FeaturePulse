package com.featurepulse

import com.featurepulse.internal.buffer.EventBuffer
import com.featurepulse.internal.model.EventType
import com.featurepulse.internal.model.RawEvent
import org.junit.Assert.*
import org.junit.Test

class EventBufferTest {

    private fun event(id: String) = RawEvent(
        eventId = id, featureId = "feat_1", eventType = EventType.TAP,
        timestamp = System.currentTimeMillis(), sessionId = "sess_x", deviceId = "dev_y"
    )

    @Test
    fun `add and drainAll returns all events and clears buffer`() {
        val buf = EventBuffer(maxSize = 10)
        repeat(3) { buf.add(event("e$it")) }
        val drained = buf.drainAll()
        assertEquals(3, drained.size)
        assertEquals(0, buf.size())
    }

    @Test
    fun `drops oldest event when buffer is full`() {
        val buf = EventBuffer(maxSize = 3)
        buf.add(event("first"))
        buf.add(event("second"))
        buf.add(event("third"))
        buf.add(event("fourth"))  // should evict "first"
        val events = buf.drainAll()
        assertEquals(3, events.size)
        assertFalse(events.any { it.eventId == "first" })
        assertTrue(events.any { it.eventId == "fourth" })
    }

    @Test
    fun `isFull returns true at capacity`() {
        val buf = EventBuffer(maxSize = 2)
        buf.add(event("a"))
        buf.add(event("b"))
        assertTrue(buf.isFull())
    }

    @Test
    fun `peek does not clear buffer`() {
        val buf = EventBuffer(maxSize = 10)
        buf.add(event("x"))
        buf.peek()
        assertEquals(1, buf.size())
    }

    @Test
    fun `thread safety — concurrent adds do not exceed maxSize`() {
        val buf = EventBuffer(maxSize = 100)
        val threads = (0..199).map { i ->
            Thread { buf.add(event("e$i")) }
        }
        threads.forEach { it.start() }
        threads.forEach { it.join() }
        assertTrue(buf.size() <= 100)
    }
}
