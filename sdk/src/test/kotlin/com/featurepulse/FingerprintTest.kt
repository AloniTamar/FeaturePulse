package com.featurepulse

import com.featurepulse.internal.discovery.Fingerprinter
import org.junit.Assert.*
import org.junit.Test

class FingerprintTest {

    @Test
    fun `same screen and resource name always produces same fingerprint`() {
        val fp1 = Fingerprinter.generate("MainActivity", "btn_share", "Button", "any/path")
        val fp2 = Fingerprinter.generate("MainActivity", "btn_share", "ImageButton", "different/path")
        assertEquals(fp1, fp2)
    }

    @Test
    fun `different screen name produces different fingerprint`() {
        val fp1 = Fingerprinter.generate("MainActivity", "btn_ok", "Button", "")
        val fp2 = Fingerprinter.generate("ProfileFragment", "btn_ok", "Button", "")
        assertNotEquals(fp1, fp2)
    }

    @Test
    fun `without resource name uses class and hierarchy`() {
        val fp1 = Fingerprinter.generate("MainActivity", null, "Button", "LinearLayout[0]/Button[0]")
        val fp2 = Fingerprinter.generate("MainActivity", null, "Button", "LinearLayout[1]/Button[0]")
        assertNotEquals(fp1, fp2)
    }

    @Test
    fun `generate is deterministic`() {
        val fp1 = Fingerprinter.generate("HomeActivity", "btn_search", "Button", "")
        val fp2 = Fingerprinter.generate("HomeActivity", "btn_search", "Button", "")
        assertEquals(fp1, fp2)
    }

    @Test
    fun `output is exactly 64 characters`() {
        val fp = Fingerprinter.generate("Main", "btn", "Button", "path")
        assertEquals(64, fp.length)
    }

    @Test
    fun `sha256 produces known hash for 'hello'`() {
        val result = Fingerprinter.sha256("hello")
        assertEquals("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", result)
    }
}
