package com.featurepulse.internal.buffer

import com.featurepulse.internal.model.RawEvent
import java.util.ArrayDeque

internal class EventBuffer(private val maxSize: Int = 500) {
    init {
        require(maxSize > 0) { "EventBuffer: maxSize must be positive, got $maxSize" }
    }

    private val buffer = ArrayDeque<RawEvent>(maxSize)

    @Synchronized
    fun add(event: RawEvent) {
        if (buffer.size >= maxSize) buffer.poll()  // drop oldest
        buffer.offer(event)
    }

    @Synchronized
    fun drainAll(): List<RawEvent> {
        val events = buffer.toList()
        buffer.clear()
        return events
    }

    @Synchronized
    fun peek(): List<RawEvent> = buffer.toList()

    @Synchronized
    fun size(): Int = buffer.size

    @Synchronized
    fun isFull(): Boolean = buffer.size == maxSize

    @Synchronized
    fun clear() = buffer.clear()
}
