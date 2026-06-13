package com.featurepulse

import com.featurepulse.internal.session.SessionManager
import org.junit.Assert.*
import org.junit.Test

class SessionManagerTest {

    @Test
    fun `returns same session within timeout window`() {
        val sm = SessionManager(sessionTimeoutMs = 5000L)
        val s1 = sm.getOrCreateSession()
        val s2 = sm.getOrCreateSession()
        assertEquals(s1, s2)
    }

    @Test
    fun `creates new session after timeout`() {
        val sm = SessionManager(sessionTimeoutMs = 50L)
        val s1 = sm.getOrCreateSession()
        Thread.sleep(100)
        val s2 = sm.getOrCreateSession()
        assertNotEquals(s1, s2)
    }

    @Test
    fun `session ID starts with sess_`() {
        val sm = SessionManager()
        assertTrue(sm.getOrCreateSession().startsWith("sess_"))
    }

    @Test
    fun `onBackground followed by foreground beyond timeout yields new session`() {
        val sm = SessionManager(sessionTimeoutMs = 50L)
        sm.getOrCreateSession()
        sm.onBackground()
        Thread.sleep(100)
        val newSession = sm.getOrCreateSession()
        assertTrue(newSession.startsWith("sess_"))
    }

    @Test
    fun `reset forces new session on next call`() {
        val sm = SessionManager()
        val s1 = sm.getOrCreateSession()
        sm.reset()
        val s2 = sm.getOrCreateSession()
        assertNotEquals(s1, s2)
    }
}
