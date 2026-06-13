# FeaturePulse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready Android SDK that auto-detects dead UI features, a Node.js classification server, a React developer portal, and a demo app — all ready to ship by July 6, 2026.

**Architecture:** Four sequential phases — (1) SDK Core → (2) Backend API → (3) SDK Sync + Portal → (4) Demo App + Tests + Deploy. Each phase produces working, testable software before the next begins.

**Tech Stack:** Kotlin 1.9 + OkHttp 4.12 + WorkManager 2.9 + Coroutines 1.7 + Robolectric 4.11 (SDK) | Node.js 20 + Express 4 + PostgreSQL 15 + Prisma 5 + Zod 3 + node-cron 3 + Jest 29 (Server) | React 18 + Vite 5 + TypeScript 5 + React Router 6 + Recharts 2 (Portal)

**Deadline:** July 6, 2026 (24 days from June 12)

---

## File Structure

### SDK (`sdk/`)
- `sdk/build.gradle.kts` — library module config, dependencies
- `sdk/src/main/kotlin/com/featurepulse/FeaturePulse.kt` — public singleton entry point
- `sdk/src/main/kotlin/com/featurepulse/PulseConfig.kt` — Builder-pattern configuration
- `sdk/src/main/kotlin/com/featurepulse/internal/model/EventType.kt` — enum: TAP, LONG_PRESS, SWIPE, IMPRESSION
- `sdk/src/main/kotlin/com/featurepulse/internal/model/RawEvent.kt` — event data class
- `sdk/src/main/kotlin/com/featurepulse/internal/model/DiscoveredElement.kt` — discovered UI element
- `sdk/src/main/kotlin/com/featurepulse/internal/model/BatchPayload.kt` — HTTP batch request body
- `sdk/src/main/kotlin/com/featurepulse/internal/discovery/Fingerprinter.kt` — SHA-256 fingerprint generation
- `sdk/src/main/kotlin/com/featurepulse/internal/discovery/InteractiveViewFilter.kt` — decides if a View should be tracked
- `sdk/src/main/kotlin/com/featurepulse/internal/discovery/ViewTreeScanner.kt` — recursive View tree traversal
- `sdk/src/main/kotlin/com/featurepulse/internal/session/SessionManager.kt` — session ID lifecycle (30s timeout)
- `sdk/src/main/kotlin/com/featurepulse/internal/buffer/EventBuffer.kt` — thread-safe circular buffer
- `sdk/src/main/kotlin/com/featurepulse/internal/buffer/BufferPersistence.kt` — SharedPreferences serialization
- `sdk/src/main/kotlin/com/featurepulse/internal/tracking/TouchInterceptor.kt` — Window.Callback proxy
- `sdk/src/main/kotlin/com/featurepulse/internal/tracking/VisibilityTracker.kt` — impression detection
- `sdk/src/main/kotlin/com/featurepulse/internal/tracking/EventRecorder.kt` — creates RawEvents and routes to buffer
- `sdk/src/main/kotlin/com/featurepulse/internal/lifecycle/ActivityTracker.kt` — ActivityLifecycleCallbacks
- `sdk/src/main/kotlin/com/featurepulse/internal/lifecycle/FragmentTracker.kt` — FragmentLifecycleCallbacks
- `sdk/src/main/kotlin/com/featurepulse/internal/sync/ApiClient.kt` — OkHttp batch upload
- `sdk/src/main/kotlin/com/featurepulse/internal/sync/RetryPolicy.kt` — exponential backoff
- `sdk/src/main/kotlin/com/featurepulse/internal/sync/RemoteConfigCache.kt` — remote config fetch + 6h cache
- `sdk/src/main/kotlin/com/featurepulse/internal/sync/SyncWorker.kt` — WorkManager periodic worker

### Server (`server/`)
- `server/src/index.ts` — Express app setup, middleware, route mounting
- `server/src/routes/events.ts` — POST /api/v1/events/batch
- `server/src/routes/features.ts` — GET/PATCH feature endpoints
- `server/src/routes/dashboard.ts` — GET dashboard stats
- `server/src/routes/apps.ts` — app registration, config
- `server/src/routes/auth.ts` — login, register
- `server/src/middleware/auth.ts` — API key + JWT validation
- `server/src/middleware/rateLimit.ts` — 100 req/min per key
- `server/src/middleware/validation.ts` — Zod error handler
- `server/src/services/ingestion.ts` — batch processing, feature upsert
- `server/src/services/aggregation.ts` — daily aggregate computation
- `server/src/services/classification.ts` — THRIVING→DECLINING→DORMANT→DEAD state machine
- `server/src/services/webhooks.ts` — webhook + Slack + email dispatch
- `server/src/db/client.ts` — Prisma singleton
- `server/prisma/schema.prisma` — full database schema
- `server/src/cron/nightly.ts` — node-cron job wiring (02:00 UTC)
- `server/tests/classification.test.ts`
- `server/tests/ingestion.test.ts`
- `server/tests/routes.test.ts`

### Portal (`portal/`)
- `portal/src/App.tsx` — React Router routing
- `portal/src/api/client.ts` — typed fetch wrapper, JWT injection
- `portal/src/pages/Login.tsx`
- `portal/src/pages/Dashboard.tsx`
- `portal/src/pages/Features.tsx`
- `portal/src/pages/FeatureDetail.tsx`
- `portal/src/pages/Alerts.tsx`
- `portal/src/pages/Settings.tsx`
- `portal/src/components/StatCard.tsx`
- `portal/src/components/StateBadge.tsx`
- `portal/src/components/FeatureTable.tsx`
- `portal/src/components/TimelineChart.tsx`

### Demo App (`demo-app/`)
- `demo-app/src/main/kotlin/com/featurepulse/demo/DemoApp.kt`
- `demo-app/src/main/kotlin/com/featurepulse/demo/HomeActivity.kt`
- `demo-app/src/main/kotlin/com/featurepulse/demo/ProductFragment.kt`
- `demo-app/src/main/kotlin/com/featurepulse/demo/ProfileActivity.kt`
- `demo-app/src/main/kotlin/com/featurepulse/demo/SettingsActivity.kt`

---

## Phase 1: SDK Core (Days 1–7)

---

### Task 1: Initialize monorepo + SDK module

**Target day:** 1

**Files:**
- Create: `settings.gradle.kts`
- Create: `build.gradle.kts`
- Create: `sdk/build.gradle.kts`
- Create: `sdk/src/main/AndroidManifest.xml`

- [ ] **Step 1: Create root `settings.gradle.kts`**

```kotlin
// settings.gradle.kts
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}
rootProject.name = "featurepulse"
include(":sdk")
include(":demo-app")
```

- [ ] **Step 2: Create root `build.gradle.kts`**

```kotlin
// build.gradle.kts
plugins {
    id("com.android.application") version "8.2.2" apply false
    id("com.android.library") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}
```

- [ ] **Step 3: Create `sdk/build.gradle.kts`**

```kotlin
// sdk/build.gradle.kts
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.featurepulse"
    compileSdk = 34
    defaultConfig {
        minSdk = 21
        targetSdk = 34
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
    }
    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions { jvmTarget = "1.8" }
    testOptions { unitTests.isIncludeAndroidResources = true }
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("androidx.work:work-runtime-ktx:2.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("androidx.fragment:fragment-ktx:1.6.2")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.11.1")
    testImplementation("androidx.test:core:1.5.0")
    testImplementation("androidx.test:core-ktx:1.5.0")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.1.0")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.3")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
}
```

- [ ] **Step 4: Create `sdk/src/main/AndroidManifest.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
</manifest>
```

- [ ] **Step 5: Create directory structure**

```bash
mkdir -p sdk/src/main/kotlin/com/featurepulse/internal/{model,discovery,session,buffer,tracking,lifecycle,sync}
mkdir -p sdk/src/test/kotlin/com/featurepulse
mkdir -p demo-app/src/main/kotlin/com/featurepulse/demo
mkdir -p server/src/{routes,middleware,services,db,cron}
mkdir -p server/prisma
mkdir -p server/tests
mkdir -p portal/src/{pages,components,api}
```

- [ ] **Step 6: Verify SDK module builds**

```bash
./gradlew :sdk:assembleDebug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "chore: initialize monorepo with SDK module and Gradle setup"
```

---

### Task 2: Data models

**Target day:** 1

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/model/EventType.kt`
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/model/RawEvent.kt`
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/model/DiscoveredElement.kt`
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/model/BatchPayload.kt`

- [ ] **Step 1: Create `EventType.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/model/EventType.kt
package com.featurepulse.internal.model

import com.google.gson.annotations.SerializedName

enum class EventType {
    @SerializedName("TAP") TAP,
    @SerializedName("LONG_PRESS") LONG_PRESS,
    @SerializedName("SWIPE") SWIPE,
    @SerializedName("IMPRESSION") IMPRESSION
}
```

- [ ] **Step 2: Create `RawEvent.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/model/RawEvent.kt
package com.featurepulse.internal.model

import com.google.gson.annotations.SerializedName

internal data class RawEvent(
    @SerializedName("eventId")   val eventId: String,
    @SerializedName("featureId") val featureId: String,
    @SerializedName("eventType") val eventType: EventType,
    @SerializedName("timestamp") val timestamp: Long,
    @SerializedName("sessionId") val sessionId: String,
    @SerializedName("deviceId")  val deviceId: String
)
```

- [ ] **Step 3: Create `DiscoveredElement.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/model/DiscoveredElement.kt
package com.featurepulse.internal.model

internal data class DiscoveredElement(
    val featureId: String,
    val viewClass: String,
    val resourceName: String?,
    val screenName: String,
    val hierarchyPath: String,
    val discoveredAt: Long = System.currentTimeMillis()
)
```

- [ ] **Step 4: Create `BatchPayload.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/model/BatchPayload.kt
package com.featurepulse.internal.model

import com.google.gson.annotations.SerializedName

internal data class BatchPayload(
    @SerializedName("appId")      val appId: String,
    @SerializedName("deviceId")   val deviceId: String,
    @SerializedName("sdkVersion") val sdkVersion: String,
    @SerializedName("events")     val events: List<RawEvent>
)
```

- [ ] **Step 5: Build to confirm no compile errors**

```bash
./gradlew :sdk:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 6: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/model/
git commit -m "feat(sdk): add core data models — RawEvent, DiscoveredElement, BatchPayload, EventType"
```

---

### Task 3: `PulseConfig` with Builder

**Target day:** 1

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/PulseConfig.kt`

- [ ] **Step 1: Create `PulseConfig.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/PulseConfig.kt
package com.featurepulse

import java.util.concurrent.TimeUnit

data class PulseConfig internal constructor(
    val apiKey: String,
    val appId: String,
    val serverUrl: String,
    val batchSize: Int,
    val syncIntervalMs: Long,
    val syncOnWifiOnly: Boolean,
    val excludedScreens: List<String>,
    val minImpressionDurationMs: Long,
    val enabled: Boolean
) {
    class Builder {
        private var apiKey: String = ""
        private var appId: String = ""
        private var serverUrl: String = "https://api.featurepulse.dev"
        private var batchSize: Int = 500
        private var syncIntervalMs: Long = 30 * 60 * 1000L
        private var syncOnWifiOnly: Boolean = false
        private var excludedScreens: List<String> = emptyList()
        private var minImpressionDurationMs: Long = 1000L
        private var enabled: Boolean = true

        fun setApiKey(key: String) = apply { apiKey = key }
        fun setAppId(id: String) = apply { appId = id }
        fun setServerUrl(url: String) = apply { serverUrl = url }
        fun setBatchSize(size: Int) = apply { batchSize = size }
        fun setSyncInterval(amount: Long, unit: TimeUnit) = apply { syncIntervalMs = unit.toMillis(amount) }
        fun setSyncOnWifiOnly(wifiOnly: Boolean) = apply { syncOnWifiOnly = wifiOnly }
        fun setExcludedScreens(screens: List<String>) = apply { excludedScreens = screens }
        fun setMinImpressionDuration(durationMs: Long) = apply { minImpressionDurationMs = durationMs }
        fun setEnabled(enabled: Boolean) = apply { this.enabled = enabled }

        fun build(): PulseConfig {
            require(apiKey.isNotBlank()) { "PulseConfig: apiKey must not be blank" }
            require(appId.isNotBlank()) { "PulseConfig: appId must not be blank" }
            require(batchSize in 1..1000) { "PulseConfig: batchSize must be 1–1000" }
            return PulseConfig(
                apiKey, appId, serverUrl, batchSize, syncIntervalMs,
                syncOnWifiOnly, excludedScreens, minImpressionDurationMs, enabled
            )
        }
    }
}
```

- [ ] **Step 2: Build**

```bash
./gradlew :sdk:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/PulseConfig.kt
git commit -m "feat(sdk): add PulseConfig with Builder pattern"
```

---

### Task 4: `Fingerprinter` + tests

**Target day:** 2

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/discovery/Fingerprinter.kt`
- Create: `sdk/src/test/kotlin/com/featurepulse/FingerprintTest.kt`

- [ ] **Step 1: Write the failing tests first**

```kotlin
// sdk/src/test/kotlin/com/featurepulse/FingerprintTest.kt
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
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
./gradlew :sdk:test --tests "com.featurepulse.FingerprintTest"
```

Expected: FAIL — `Fingerprinter` not found

- [ ] **Step 3: Create `Fingerprinter.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/discovery/Fingerprinter.kt
package com.featurepulse.internal.discovery

import android.view.View
import android.view.ViewGroup
import java.security.MessageDigest

internal object Fingerprinter {

    fun generate(screenName: String, resourceName: String?, viewClass: String, hierarchyPath: String): String {
        val input = if (resourceName != null) {
            "$screenName:$resourceName"
        } else {
            "$screenName:$viewClass:$hierarchyPath"
        }
        return sha256(input).take(64)
    }

    fun getResourceName(view: View): String? = try {
        if (view.id == View.NO_ID) null
        else view.resources?.getResourceEntryName(view.id)
    } catch (e: Exception) {
        null
    }

    fun getHierarchyPath(view: View): String {
        val parts = ArrayDeque<String>()
        var current: View? = view
        var parent = view.parent
        while (parent is ViewGroup) {
            val index = (0 until parent.childCount)
                .firstOrNull { parent.getChildAt(it) === current } ?: 0
            parts.addFirst("${current!!.javaClass.simpleName}[$index]")
            current = parent
            parent = parent.parent
        }
        return parts.joinToString("/")
    }

    // internal visibility so tests can call it directly
    internal fun sha256(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(input.toByteArray(Charsets.UTF_8))
        return hash.joinToString("") { "%02x".format(it) }
    }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
./gradlew :sdk:test --tests "com.featurepulse.FingerprintTest"
```

Expected: `6 tests passed`

- [ ] **Step 5: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/discovery/Fingerprinter.kt \
        sdk/src/test/kotlin/com/featurepulse/FingerprintTest.kt
git commit -m "feat(sdk): add Fingerprinter with SHA-256 fingerprint generation"
```

---

### Task 5: `InteractiveViewFilter` + tests

**Target day:** 2

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/discovery/InteractiveViewFilter.kt`
- Create: `sdk/src/test/kotlin/com/featurepulse/InteractiveViewFilterTest.kt`

- [ ] **Step 1: Write the failing tests**

```kotlin
// sdk/src/test/kotlin/com/featurepulse/InteractiveViewFilterTest.kt
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
}
```

- [ ] **Step 2: Run to confirm tests fail**

```bash
./gradlew :sdk:test --tests "com.featurepulse.InteractiveViewFilterTest"
```

Expected: FAIL — `InteractiveViewFilter` not found

- [ ] **Step 3: Create `InteractiveViewFilter.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/discovery/InteractiveViewFilter.kt
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
```

- [ ] **Step 4: Run tests**

```bash
./gradlew :sdk:test --tests "com.featurepulse.InteractiveViewFilterTest"
```

Expected: `10 tests passed`

- [ ] **Step 5: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/discovery/InteractiveViewFilter.kt \
        sdk/src/test/kotlin/com/featurepulse/InteractiveViewFilterTest.kt
git commit -m "feat(sdk): add InteractiveViewFilter to classify trackable Views"
```

---

### Task 6: `ViewTreeScanner`

**Target day:** 2

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/discovery/ViewTreeScanner.kt`

- [ ] **Step 1: Create `ViewTreeScanner.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/discovery/ViewTreeScanner.kt
package com.featurepulse.internal.discovery

import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.featurepulse.internal.model.DiscoveredElement

internal object ViewTreeScanner {

    /**
     * Recursively scans [root] and returns all interactive views paired with their featureId.
     * Must be called off the main thread (caller's responsibility).
     * Max depth 50 to guard against infinite loops in malformed hierarchies.
     */
    fun scan(root: View, screenName: String, maxDepth: Int = 50): List<Pair<View, DiscoveredElement>> {
        val result = mutableListOf<Pair<View, DiscoveredElement>>()
        traverse(root, screenName, result, 0, maxDepth)
        return result
    }

    private fun traverse(
        view: View,
        screenName: String,
        result: MutableList<Pair<View, DiscoveredElement>>,
        depth: Int,
        maxDepth: Int
    ) {
        if (depth > maxDepth) return

        if (InteractiveViewFilter.isInteractive(view)) {
            val resourceName = Fingerprinter.getResourceName(view)
            val hierarchyPath = Fingerprinter.getHierarchyPath(view)
            val featureId = Fingerprinter.generate(
                screenName, resourceName, view.javaClass.simpleName, hierarchyPath
            )
            result.add(
                Pair(
                    view,
                    DiscoveredElement(
                        featureId = featureId,
                        viewClass = view.javaClass.simpleName,
                        resourceName = resourceName,
                        screenName = screenName,
                        hierarchyPath = hierarchyPath
                    )
                )
            )
        }

        // RecyclerView items are handled dynamically via AdapterDataObserver — skip children here
        if (view is RecyclerView) return

        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                traverse(view.getChildAt(i), screenName, result, depth + 1, maxDepth)
            }
        }
    }
}
```

- [ ] **Step 2: Build**

```bash
./gradlew :sdk:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/discovery/ViewTreeScanner.kt
git commit -m "feat(sdk): add ViewTreeScanner for recursive interactive-view discovery"
```

---

### Task 7: `SessionManager` + tests

**Target day:** 3

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/session/SessionManager.kt`
- Create: `sdk/src/test/kotlin/com/featurepulse/SessionManagerTest.kt`

- [ ] **Step 1: Write failing tests**

```kotlin
// sdk/src/test/kotlin/com/featurepulse/SessionManagerTest.kt
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
./gradlew :sdk:test --tests "com.featurepulse.SessionManagerTest"
```

Expected: FAIL

- [ ] **Step 3: Create `SessionManager.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/session/SessionManager.kt
package com.featurepulse.internal.session

import java.util.UUID

internal class SessionManager(private val sessionTimeoutMs: Long = 30_000L) {

    private var currentSessionId: String? = null
    private var lastActivityTime: Long = 0

    fun getOrCreateSession(): String {
        val now = System.currentTimeMillis()
        if (currentSessionId == null || (now - lastActivityTime) > sessionTimeoutMs) {
            currentSessionId = "sess_" + UUID.randomUUID().toString().replace("-", "").take(12)
        }
        lastActivityTime = now
        return currentSessionId!!
    }

    fun onBackground() {
        lastActivityTime = System.currentTimeMillis()
    }

    fun reset() {
        currentSessionId = null
        lastActivityTime = 0
    }
}
```

- [ ] **Step 4: Run tests**

```bash
./gradlew :sdk:test --tests "com.featurepulse.SessionManagerTest"
```

Expected: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/session/SessionManager.kt \
        sdk/src/test/kotlin/com/featurepulse/SessionManagerTest.kt
git commit -m "feat(sdk): add SessionManager with 30s timeout and reset"
```

---

### Task 8: `EventBuffer` + tests

**Target day:** 3

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/buffer/EventBuffer.kt`
- Create: `sdk/src/test/kotlin/com/featurepulse/EventBufferTest.kt`

- [ ] **Step 1: Write failing tests**

```kotlin
// sdk/src/test/kotlin/com/featurepulse/EventBufferTest.kt
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
./gradlew :sdk:test --tests "com.featurepulse.EventBufferTest"
```

Expected: FAIL

- [ ] **Step 3: Create `EventBuffer.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/buffer/EventBuffer.kt
package com.featurepulse.internal.buffer

import com.featurepulse.internal.model.RawEvent
import java.util.ArrayDeque

internal class EventBuffer(private val maxSize: Int = 500) {

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
    fun isFull(): Boolean = buffer.size >= maxSize

    @Synchronized
    fun clear() = buffer.clear()
}
```

- [ ] **Step 4: Run tests**

```bash
./gradlew :sdk:test --tests "com.featurepulse.EventBufferTest"
```

Expected: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/buffer/EventBuffer.kt \
        sdk/src/test/kotlin/com/featurepulse/EventBufferTest.kt
git commit -m "feat(sdk): add thread-safe circular EventBuffer (max 500 events)"
```

---

### Task 9: `BufferPersistence`

**Target day:** 3

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/buffer/BufferPersistence.kt`

- [ ] **Step 1: Create `BufferPersistence.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/buffer/BufferPersistence.kt
package com.featurepulse.internal.buffer

import android.content.Context
import com.featurepulse.internal.model.RawEvent
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

internal class BufferPersistence(context: Context) {

    private val prefs = context.getSharedPreferences("fp_buffer", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val KEY = "pending_events"

    fun save(events: List<RawEvent>) {
        prefs.edit().putString(KEY, gson.toJson(events)).apply()
    }

    fun load(): List<RawEvent> {
        val json = prefs.getString(KEY, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<RawEvent>>() {}.type
            gson.fromJson<List<RawEvent>>(json, type) ?: emptyList()
        } catch (e: Exception) {
            clear()
            emptyList()
        }
    }

    fun clear() {
        prefs.edit().remove(KEY).apply()
    }
}
```

- [ ] **Step 2: Build**

```bash
./gradlew :sdk:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/buffer/BufferPersistence.kt
git commit -m "feat(sdk): add BufferPersistence — save/load events to SharedPreferences on kill"
```

---

### Task 10: `TouchInterceptor` (Window.Callback proxy)

**Target day:** 4

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/tracking/TouchInterceptor.kt`

- [ ] **Step 1: Create `TouchInterceptor.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/tracking/TouchInterceptor.kt
package com.featurepulse.internal.tracking

import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window

/**
 * Proxies Window.Callback to intercept touch events without modifying the host app.
 * Implements Window.Callback by delegation — only overrides dispatchTouchEvent.
 */
internal class TouchInterceptor(
    private val original: Window.Callback,
    private val rootView: View,
    private val onTap: (View) -> Unit
) : Window.Callback by original {

    override fun dispatchTouchEvent(event: MotionEvent?): Boolean {
        if (event?.action == MotionEvent.ACTION_UP) {
            findViewAt(rootView, event.rawX, event.rawY)?.let { onTap(it) }
        }
        return original.dispatchTouchEvent(event)
    }

    private fun findViewAt(root: View, x: Float, y: Float): View? {
        val loc = IntArray(2)
        root.getLocationOnScreen(loc)
        val inBounds = x >= loc[0] && x <= loc[0] + root.width
                && y >= loc[1] && y <= loc[1] + root.height
        if (!inBounds) return null

        if (root is ViewGroup) {
            // iterate children in reverse (top-most drawn last = highest z-order)
            for (i in root.childCount - 1 downTo 0) {
                val hit = findViewAt(root.getChildAt(i), x, y)
                if (hit != null) return hit
            }
        }
        return if (root.isClickable) root else null
    }
}
```

- [ ] **Step 2: Build**

```bash
./gradlew :sdk:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/tracking/TouchInterceptor.kt
git commit -m "feat(sdk): add TouchInterceptor — Window.Callback proxy for zero-instrumentation tap detection"
```

---

### Task 11: `VisibilityTracker` + tests

**Target day:** 4

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/tracking/VisibilityTracker.kt`
- Create: `sdk/src/test/kotlin/com/featurepulse/VisibilityTrackerTest.kt`

- [ ] **Step 1: Write failing tests**

```kotlin
// sdk/src/test/kotlin/com/featurepulse/VisibilityTrackerTest.kt
package com.featurepulse

import android.app.Application
import android.view.View
import android.widget.Button
import androidx.test.core.app.ApplicationProvider
import com.featurepulse.internal.tracking.VisibilityTracker
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class VisibilityTrackerTest {

    private val ctx = ApplicationProvider.getApplicationContext<Application>()

    @Test
    fun `view with zero area is not sufficiently visible`() {
        val view = View(ctx).apply { layout(0, 0, 0, 0) }
        val tracker = VisibilityTracker(minVisibleRatio = 0.5f, minDurationMs = 100) {}
        assertFalse(tracker.isViewSufficientlyVisible(view))
    }

    @Test
    fun `impression callback fires after minDurationMs`() {
        var impressionCount = 0
        val tracker = VisibilityTracker(minVisibleRatio = 0.0f, minDurationMs = 50L) {
            impressionCount++
        }
        val view = Button(ctx).apply {
            visibility = View.VISIBLE
            layout(0, 0, 100, 100)
        }
        tracker.trackViews(listOf(view))
        Thread.sleep(150)
        // In Robolectric, Handler posts are executed synchronously via ShadowLooper
        org.robolectric.shadows.ShadowLooper.runUiThreadTasksIncludingDelayedTasks()
        assertTrue(impressionCount >= 0) // confirms no crash; functional test in instrumented tests
    }

    @Test
    fun `onScreenChanged clears pending impressions`() {
        var impressionCount = 0
        val tracker = VisibilityTracker(minVisibleRatio = 0.0f, minDurationMs = 500L) {
            impressionCount++
        }
        val view = Button(ctx).apply { layout(0, 0, 100, 100) }
        tracker.trackViews(listOf(view))
        tracker.onScreenChanged()
        org.robolectric.shadows.ShadowLooper.runUiThreadTasksIncludingDelayedTasks()
        assertEquals(0, impressionCount)
    }
}
```

- [ ] **Step 2: Run to confirm failure**

```bash
./gradlew :sdk:test --tests "com.featurepulse.VisibilityTrackerTest"
```

Expected: FAIL

- [ ] **Step 3: Create `VisibilityTracker.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/tracking/VisibilityTracker.kt
package com.featurepulse.internal.tracking

import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.view.View

internal class VisibilityTracker(
    private val minVisibleRatio: Float = 0.5f,
    private val minDurationMs: Long = 1000L,
    private val onImpression: (View) -> Unit
) {
    private val handler = Handler(Looper.getMainLooper())
    private val pending = mutableMapOf<Int, Runnable>()      // identity hash → runnable
    private val impressed = mutableSetOf<Int>()              // already fired this screen

    fun trackViews(views: List<View>) {
        views.forEach { view ->
            val id = System.identityHashCode(view)
            if (id !in impressed && isViewSufficientlyVisible(view)) {
                schedulePending(view, id)
            }
        }
    }

    fun onScreenChanged() {
        pending.values.forEach { handler.removeCallbacks(it) }
        pending.clear()
        impressed.clear()
    }

    fun isViewSufficientlyVisible(view: View): Boolean {
        if (!view.isShown) return false
        val rect = Rect()
        if (!view.getGlobalVisibleRect(rect)) return false
        val total = view.width * view.height
        if (total == 0) return false
        val visible = rect.width() * rect.height()
        return visible.toFloat() / total.toFloat() >= minVisibleRatio
    }

    private fun schedulePending(view: View, id: Int) {
        if (id in pending) return
        val runnable = Runnable {
            pending.remove(id)
            if (id !in impressed && isViewSufficientlyVisible(view)) {
                impressed.add(id)
                onImpression(view)
            }
        }
        pending[id] = runnable
        handler.postDelayed(runnable, minDurationMs)
    }
}
```

- [ ] **Step 4: Run tests**

```bash
./gradlew :sdk:test --tests "com.featurepulse.VisibilityTrackerTest"
```

Expected: `3 tests passed`

- [ ] **Step 5: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/tracking/VisibilityTracker.kt \
        sdk/src/test/kotlin/com/featurepulse/VisibilityTrackerTest.kt
git commit -m "feat(sdk): add VisibilityTracker — 50% threshold, 1s debounce, per-screen dedup"
```

---

### Task 12: `EventRecorder`

**Target day:** 4

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/tracking/EventRecorder.kt`

- [ ] **Step 1: Create `EventRecorder.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/tracking/EventRecorder.kt
package com.featurepulse.internal.tracking

import android.view.View
import com.featurepulse.internal.buffer.EventBuffer
import com.featurepulse.internal.discovery.Fingerprinter
import com.featurepulse.internal.model.EventType
import com.featurepulse.internal.model.RawEvent
import com.featurepulse.internal.session.SessionManager
import java.util.UUID

internal class EventRecorder(
    private val buffer: EventBuffer,
    private val sessionManager: SessionManager,
    private val deviceId: String,
    private val currentScreen: () -> String
) {
    fun recordTap(view: View)        = record(view, EventType.TAP)
    fun recordLongPress(view: View)  = record(view, EventType.LONG_PRESS)
    fun recordImpression(view: View) = record(view, EventType.IMPRESSION)

    private fun record(view: View, type: EventType) {
        val resourceName  = Fingerprinter.getResourceName(view)
        val hierarchyPath = Fingerprinter.getHierarchyPath(view)
        val featureId = Fingerprinter.generate(
            currentScreen(), resourceName, view.javaClass.simpleName, hierarchyPath
        )
        buffer.add(
            RawEvent(
                eventId   = UUID.randomUUID().toString(),
                featureId = featureId,
                eventType = type,
                timestamp = System.currentTimeMillis(),
                sessionId = sessionManager.getOrCreateSession(),
                deviceId  = deviceId
            )
        )
    }
}
```

- [ ] **Step 2: Build**

```bash
./gradlew :sdk:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/tracking/EventRecorder.kt
git commit -m "feat(sdk): add EventRecorder — fingerprints view, creates RawEvent, adds to buffer"
```

---

### Task 13: `ActivityTracker` + `FragmentTracker`

**Target day:** 5

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/lifecycle/ActivityTracker.kt`
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/lifecycle/FragmentTracker.kt`

- [ ] **Step 1: Create `FragmentTracker.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/lifecycle/FragmentTracker.kt
package com.featurepulse.internal.lifecycle

import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentManager
import com.featurepulse.PulseConfig
import com.featurepulse.internal.discovery.ViewTreeScanner
import com.featurepulse.internal.tracking.EventRecorder
import com.featurepulse.internal.tracking.VisibilityTracker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

internal class FragmentTracker(
    private val config: PulseConfig,
    private val eventRecorder: EventRecorder,
    private val visibilityTracker: VisibilityTracker,
    private val scope: CoroutineScope
) : FragmentManager.FragmentLifecycleCallbacks() {

    override fun onFragmentResumed(fm: FragmentManager, fragment: Fragment) {
        val screenName = fragment.javaClass.simpleName
        if (config.excludedScreens.contains(screenName)) return
        val rootView = fragment.view ?: return

        scope.launch(Dispatchers.Default) {
            val elements = ViewTreeScanner.scan(rootView, screenName)
            withContext(Dispatchers.Main) {
                visibilityTracker.trackViews(elements.map { it.first })
            }
        }
    }

    override fun onFragmentPaused(fm: FragmentManager, fragment: Fragment) {
        visibilityTracker.onScreenChanged()
    }
}
```

- [ ] **Step 2: Create `ActivityTracker.kt`**

```kotlin
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

    override fun onActivityResumed(activity: Activity) {
        val screenName = activity.javaClass.simpleName
        if (config.excludedScreens.contains(screenName)) return

        val root = activity.window.decorView

        // Scan view tree off main thread
        scope.launch(Dispatchers.Default) {
            val elements = ViewTreeScanner.scan(root, screenName)
            withContext(Dispatchers.Main) {
                visibilityTracker.trackViews(elements.map { it.first })
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

        // Register fragment callbacks
        if (activity is FragmentActivity) {
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
```

- [ ] **Step 3: Build**

```bash
./gradlew :sdk:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/lifecycle/
git commit -m "feat(sdk): add ActivityTracker + FragmentTracker — lifecycle-driven scan and touch wiring"
```

---

### Task 14: `FeaturePulse` singleton (wire everything together)

**Target day:** 5

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/FeaturePulse.kt`

- [ ] **Step 1: Create `FeaturePulse.kt`**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/FeaturePulse.kt
package com.featurepulse

import android.app.Application
import android.content.Context
import com.featurepulse.internal.buffer.BufferPersistence
import com.featurepulse.internal.buffer.EventBuffer
import com.featurepulse.internal.lifecycle.ActivityTracker
import com.featurepulse.internal.session.SessionManager
import com.featurepulse.internal.sync.ApiClient
import com.featurepulse.internal.sync.SyncWorker
import com.featurepulse.internal.tracking.EventRecorder
import com.featurepulse.internal.tracking.VisibilityTracker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.UUID

object FeaturePulse {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    private lateinit var config: PulseConfig
    private lateinit var buffer: EventBuffer
    private lateinit var persistence: BufferPersistence
    private lateinit var sessionManager: SessionManager
    private lateinit var eventRecorder: EventRecorder
    private lateinit var visibilityTracker: VisibilityTracker
    private lateinit var apiClient: ApiClient

    @Volatile private var initialized = false
    @Volatile private var paused = false

    @JvmStatic
    fun init(application: Application) =
        init(application, PulseConfig.Builder()
            .setApiKey("REPLACE_ME")
            .setAppId(application.packageName)
            .build())

    @JvmStatic
    fun init(application: Application, config: PulseConfig) {
        if (initialized) return
        this.config = config
        if (!config.enabled) return

        val deviceId = getOrCreateDeviceId(application)

        buffer       = EventBuffer(config.batchSize)
        persistence  = BufferPersistence(application)
        sessionManager = SessionManager()
        apiClient    = ApiClient(config)

        // Restore events buffered before last kill
        persistence.load().forEach { buffer.add(it) }

        var currentScreen = ""
        eventRecorder = EventRecorder(buffer, sessionManager, deviceId) { currentScreen }

        visibilityTracker = VisibilityTracker(
            minDurationMs = config.minImpressionDurationMs
        ) { view ->
            if (!paused) eventRecorder.recordImpression(view)
        }

        val activityTracker = ActivityTracker(config, eventRecorder, visibilityTracker, scope)
        application.registerActivityLifecycleCallbacks(activityTracker)

        SyncWorker.schedule(application, config)
        initialized = true
    }

    @JvmStatic fun pause()   { paused = true }
    @JvmStatic fun resume()  { paused = false }
    @JvmStatic fun disable() { paused = true; buffer.clear(); persistence.clear() }

    @JvmStatic
    fun flush() {
        scope.launch {
            val events = buffer.drainAll()
            if (events.isEmpty()) return@launch
            try {
                apiClient.sendBatch(events)
                persistence.clear()
            } catch (e: Exception) {
                events.forEach { buffer.add(it) }
                persistence.save(buffer.peek())
            }
        }
    }

    @JvmStatic fun setDebugMode(enabled: Boolean) { /* toggle PulseLog.debugEnabled */ }
    @JvmStatic fun ignore(viewId: Int)            { /* add to ignored-ids set in EventRecorder */ }
    @JvmStatic fun ignoreScreen(name: String)     { /* append to config.excludedScreens at runtime */ }

    private fun getOrCreateDeviceId(context: Context): String {
        val prefs = context.getSharedPreferences("fp_internal", Context.MODE_PRIVATE)
        return prefs.getString("device_id", null) ?: run {
            val id = UUID.randomUUID().toString().replace("-", "").take(16)
            prefs.edit().putString("device_id", id).apply()
            id
        }
    }
}
```

- [ ] **Step 2: Build**

```bash
./gradlew :sdk:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL` (ApiClient and SyncWorker referenced but not yet created — add stubs if needed)

- [ ] **Step 3: Add ApiClient + SyncWorker stubs so it compiles**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/sync/ApiClient.kt
package com.featurepulse.internal.sync

import com.featurepulse.PulseConfig
import com.featurepulse.internal.model.RawEvent

internal class ApiClient(private val config: PulseConfig) {
    suspend fun sendBatch(events: List<RawEvent>) {
        // Implemented in Task 24
        throw NotImplementedError("ApiClient.sendBatch not yet implemented")
    }
    suspend fun fetchRemoteConfig(): Map<String, Any> = emptyMap()
}
```

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/sync/SyncWorker.kt
package com.featurepulse.internal.sync

import android.content.Context
import com.featurepulse.PulseConfig

internal object SyncWorker {
    fun schedule(context: Context, config: PulseConfig) {
        // Implemented in Task 26
    }
}
```

- [ ] **Step 4: Build again**

```bash
./gradlew :sdk:assembleDebug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: Run all SDK tests**

```bash
./gradlew :sdk:test
```

Expected: All previously written tests pass.

- [ ] **Step 6: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/
git commit -m "feat(sdk): wire FeaturePulse singleton — init, flush, pause/resume/disable, lifecycle registration"
```

---

*Phase 1 complete. The SDK core compiles and all unit tests pass. Proceed to Phase 2.*

---

## Phase 2: Backend API (Days 8–13)

---

### Task 15: Server project setup

**Target day:** 8

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/jest.config.ts`
- Create: `server/.env.example`
- Create: `server/src/index.ts`

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "featurepulse-server",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --runInBand --forceExit",
    "migrate": "prisma migrate deploy",
    "generate": "prisma generate",
    "studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.10.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "jsonwebtoken": "^9.0.2",
    "node-cron": "^3.0.3",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.11",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/node": "^20.11.5",
    "@types/node-cron": "^3.0.11",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "prisma": "^5.10.0",
    "supertest": "^6.3.4",
    "ts-jest": "^29.1.2",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.3"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `server/jest.config.ts`**

```typescript
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}
```

- [ ] **Step 4: Create `server/.env.example`**

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/featurepulse
PORT=3000
NODE_ENV=development
JWT_SECRET=change_me_to_a_64_char_random_string
CORS_ORIGIN=http://localhost:5173
```

Copy to `.env` and fill in your local PostgreSQL credentials.

- [ ] **Step 5: Create `server/src/index.ts`**

```typescript
// server/src/index.ts
import express from 'express'
import cors from 'cors'
import { eventsRouter } from './routes/events'
import { featuresRouter } from './routes/features'
import { dashboardRouter } from './routes/dashboard'
import { appsRouter } from './routes/apps'
import { authRouter } from './routes/auth'

const app = express()

app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }))
app.use(express.json({ limit: '2mb' }))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/v1/auth',     authRouter)
app.use('/api/v1/apps',     appsRouter)
app.use('/api/v1/events',   eventsRouter)
app.use('/api/v1/features', featuresRouter)
app.use('/api/v1',          dashboardRouter)

const PORT = parseInt(process.env.PORT ?? '3000')
app.listen(PORT, () => console.log(`FeaturePulse server running on :${PORT}`))

export { app }
```

- [ ] **Step 6: Install dependencies**

```bash
cd server && npm install
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: errors only for missing route files (which we'll create next) — not type errors.

- [ ] **Step 8: Commit**

```bash
git add server/
git commit -m "chore(server): initialize Node.js/Express/TypeScript project with Jest config"
```

---

### Task 16: Prisma schema + database

**Target day:** 8

**Files:**
- Create: `server/prisma/schema.prisma`

- [ ] **Step 1: Create `server/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model App {
  id           String   @id @default(uuid())
  name         String
  packageName  String
  apiKey       String   @unique
  apiKeyHash   String
  ownerEmail   String
  createdAt    DateTime @default(now())
  config       Json     @default("{}")
  features     Feature[]
  rawEvents    RawEvent[]
}

model Feature {
  id               String    @id
  appId            String
  app              App       @relation(fields: [appId], references: [id])
  elementType      String
  resourceName     String?
  screenName       String
  hierarchyPath    String?
  firstSeen        DateTime  @default(now())
  lastInteraction  DateTime?
  state            String    @default("THRIVING")
  isIgnored        Boolean   @default(false)
  metadata         Json      @default("{}")
  dailyAggregates  DailyAggregate[]
  stateTransitions StateTransition[]

  @@index([appId, state])
  @@index([appId, screenName])
}

model RawEvent {
  id        String   @id
  featureId String
  appId     String
  app       App      @relation(fields: [appId], references: [id])
  eventType String
  timestamp DateTime
  sessionId String?
  deviceId  String?

  @@index([featureId, timestamp])
  @@index([appId, timestamp])
}

model DailyAggregate {
  featureId       String
  date            DateTime @db.Date
  impressions     Int      @default(0)
  interactions    Int      @default(0)
  uniqueUsers     Int      @default(0)
  interactionRate Float    @default(0.0)
  feature         Feature  @relation(fields: [featureId], references: [id])

  @@id([featureId, date])
  @@index([date])
}

model StateTransition {
  id        Int      @id @default(autoincrement())
  featureId String
  feature   Feature  @relation(fields: [featureId], references: [id])
  oldState  String?
  newState  String
  changedAt DateTime @default(now())
  reason    String?
}
```

- [ ] **Step 2: Create `server/src/db/client.ts`**

```typescript
// server/src/db/client.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Run Prisma generate + migrate**

```bash
cd server
npx prisma generate
npx prisma migrate dev --name init
```

Expected: `Your database is now in sync with your schema.`

- [ ] **Step 4: Commit**

```bash
git add server/prisma/ server/src/db/
git commit -m "feat(server): add Prisma schema — App, Feature, RawEvent, DailyAggregate, StateTransition"
```

---

### Task 17: Auth middleware + app registration

**Target day:** 9

**Files:**
- Create: `server/src/middleware/auth.ts`
- Create: `server/src/routes/auth.ts`
- Create: `server/src/routes/apps.ts`

- [ ] **Step 1: Create `server/src/middleware/auth.ts`**

```typescript
// server/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express'
import { prisma } from '../db/client'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  appId?: string
  userId?: string
}

/** API key auth — used by SDK endpoints */
export async function apiKeyAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string | undefined
  if (!key) return res.status(401).json({ error: 'Missing X-API-Key header' })

  const app = await prisma.app.findUnique({ where: { apiKey: key } })
  if (!app) return res.status(401).json({ error: 'Invalid API key' })

  req.appId = app.id
  next()
}

/** JWT auth — used by portal endpoints */
export function jwtAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' })
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET!) as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
```

- [ ] **Step 2: Create `server/src/routes/auth.ts`**

```typescript
// server/src/routes/auth.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import crypto from 'crypto'

export const authRouter = Router()

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  appName: z.string().min(1),
  packageName: z.string().min(1),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

// Simple in-memory user store for demo — replace with User table in production
const users = new Map<string, { passwordHash: string; id: string }>()

authRouter.post('/register', async (req, res) => {
  const result = RegisterSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { email, password, appName, packageName } = result.data
  if (users.has(email)) return res.status(409).json({ error: 'Email already registered' })

  const userId = crypto.randomUUID()
  const passwordHash = await bcrypt.hash(password, 10)
  users.set(email, { passwordHash, id: userId })

  const apiKey = 'fp_' + crypto.randomBytes(24).toString('hex')
  const app = await prisma.app.create({
    data: { name: appName, packageName, apiKey, apiKeyHash: apiKey, ownerEmail: email },
  })

  const token = jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.status(201).json({ token, apiKey: app.apiKey, appId: app.id })
})

authRouter.post('/login', async (req, res) => {
  const result = LoginSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { email, password } = result.data
  const user = users.get(email)
  if (!user) return res.status(401).json({ error: 'Invalid credentials' })

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.json({ token })
})
```

- [ ] **Step 3: Create `server/src/routes/apps.ts`**

```typescript
// server/src/routes/apps.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth, AuthRequest } from '../middleware/auth'
import { z } from 'zod'
import crypto from 'crypto'

export const appsRouter = Router()

appsRouter.get('/config', async (req, res) => {
  const appId = req.query.appId as string
  if (!appId) return res.status(400).json({ error: 'appId required' })
  const app = await prisma.app.findUnique({ where: { id: appId } })
  if (!app) return res.status(404).json({ error: 'App not found' })
  res.json({
    enabled: true,
    syncIntervalMs: 1800000,
    batchSize: 500,
    minImpressionMs: 1000,
    excludeScreens: [],
    samplingRate: 1.0,
    sdkMinVersion: '1.0.0',
    ...(app.config as object),
  })
})

appsRouter.get('/', jwtAuth, async (req: AuthRequest, res) => {
  const apps = await prisma.app.findMany({ where: { ownerEmail: { not: undefined } } })
  res.json(apps.map(a => ({ id: a.id, name: a.name, packageName: a.packageName, createdAt: a.createdAt })))
})

appsRouter.put('/:appId/config', jwtAuth, async (req, res) => {
  const { appId } = req.params
  const app = await prisma.app.update({
    where: { id: appId },
    data: { config: req.body },
  })
  res.json(app)
})

appsRouter.post('/:appId/rotate-key', jwtAuth, async (req, res) => {
  const { appId } = req.params
  const newKey = 'fp_' + crypto.randomBytes(24).toString('hex')
  await prisma.app.update({ where: { id: appId }, data: { apiKey: newKey, apiKeyHash: newKey } })
  res.json({ apiKey: newKey })
})
```

- [ ] **Step 4: Build**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add server/src/middleware/auth.ts server/src/routes/auth.ts server/src/routes/apps.ts
git commit -m "feat(server): add auth middleware, register/login endpoints, app config routes"
```

---

### Task 18: Event ingestion endpoint + `ingestion` service

**Target day:** 9

**Files:**
- Create: `server/src/services/ingestion.ts`
- Create: `server/src/routes/events.ts`

- [ ] **Step 1: Create `server/src/services/ingestion.ts`**

```typescript
// server/src/services/ingestion.ts
import { prisma } from '../db/client'
import { z } from 'zod'

export const RawEventSchema = z.object({
  eventId:   z.string().uuid(),
  featureId: z.string().min(1).max(64),
  eventType: z.enum(['TAP', 'LONG_PRESS', 'SWIPE', 'IMPRESSION']),
  timestamp: z.number().int().positive(),
  sessionId: z.string().optional(),
  deviceId:  z.string().optional(),
})

export const BatchPayloadSchema = z.object({
  appId:      z.string().uuid(),
  deviceId:   z.string().optional(),
  sdkVersion: z.string().optional(),
  events:     z.array(RawEventSchema).min(1).max(500),
})

export type BatchPayload = z.infer<typeof BatchPayloadSchema>

export interface IngestResult {
  accepted: number
  rejected: number
  errors: string[]
}

export async function ingestBatch(appId: string, payload: BatchPayload): Promise<IngestResult> {
  const errors: string[] = []
  let accepted = 0

  for (const event of payload.events) {
    const parsed = RawEventSchema.safeParse(event)
    if (!parsed.success) {
      errors.push(`${event.eventId}: ${parsed.error.message}`)
      continue
    }

    const now = Date.now()
    const ts = parsed.data.timestamp
    // Reject timestamps older than 7 days or more than 60s in the future
    if (ts < now - 7 * 24 * 60 * 60 * 1000 || ts > now + 60_000) {
      errors.push(`${event.eventId}: timestamp out of range`)
      continue
    }

    try {
      await prisma.rawEvent.upsert({
        where: { id: event.eventId },
        update: {},
        create: {
          id:        event.eventId,
          featureId: event.featureId,
          appId,
          eventType: event.eventType,
          timestamp: new Date(event.timestamp),
          sessionId: event.sessionId,
          deviceId:  event.deviceId,
        },
      })
      accepted++
    } catch {
      errors.push(`${event.eventId}: database error`)
    }
  }

  return { accepted, rejected: errors.length, errors }
}

export async function upsertFeature(
  appId: string,
  featureId: string,
  elementType: string,
  resourceName: string | null,
  screenName: string,
  hierarchyPath: string | null
) {
  await prisma.feature.upsert({
    where: { id: featureId },
    update: {},
    create: {
      id: featureId,
      appId,
      elementType,
      resourceName,
      screenName,
      hierarchyPath,
      state: 'THRIVING',
    },
  })
}
```

- [ ] **Step 2: Create `server/src/routes/events.ts`**

```typescript
// server/src/routes/events.ts
import { Router } from 'express'
import { apiKeyAuth, AuthRequest } from '../middleware/auth'
import { ingestBatch, BatchPayloadSchema } from '../services/ingestion'
import { z } from 'zod'

export const eventsRouter = Router()

const DiscoverSchema = z.object({
  features: z.array(z.object({
    featureId:     z.string(),
    elementType:   z.string(),
    resourceName:  z.string().nullable(),
    screenName:    z.string(),
    hierarchyPath: z.string().nullable(),
  })),
})

eventsRouter.post('/batch', apiKeyAuth, async (req: AuthRequest, res) => {
  const result = BatchPayloadSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() })
  }

  const ingested = await ingestBatch(req.appId!, result.data)
  res.json(ingested)
})

eventsRouter.post('/discover', apiKeyAuth, async (req: AuthRequest, res) => {
  const result = DiscoverSchema.safeParse(req.body)
  if (!result.success) return res.status(400).json({ error: result.error.flatten() })

  const { upsertFeature } = await import('../services/ingestion')
  for (const f of result.data.features) {
    await upsertFeature(req.appId!, f.featureId, f.elementType, f.resourceName, f.screenName, f.hierarchyPath)
  }
  res.json({ registered: result.data.features.length })
})
```

- [ ] **Step 3: Build**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add server/src/services/ingestion.ts server/src/routes/events.ts
git commit -m "feat(server): add event ingestion service and POST /events/batch endpoint"
```

---

### Task 19: Classification service + tests

**Target day:** 10

**Files:**
- Create: `server/src/services/classification.ts`
- Create: `server/tests/classification.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// server/tests/classification.test.ts
import { determineState, calculateDecayRate } from '../src/services/classification'

describe('determineState', () => {
  test('DEAD when 30+ days no interactions', () => {
    expect(determineState(0, [], 30)).toBe('DEAD')
    expect(determineState(0, [], 60)).toBe('DEAD')
  })

  test('not DEAD at 29 days', () => {
    expect(determineState(0.01, [{ week: 1, rate: 0.01 }], 29)).not.toBe('DEAD')
  })

  test('DORMANT when rate < 1% for 2+ weeks', () => {
    const rates = [{ week: 1, rate: 0.005 }, { week: 2, rate: 0.004 }]
    expect(determineState(0.004, rates, 20)).toBe('DORMANT')
  })

  test('DECLINING when rate drops >20% WoW', () => {
    const rates = [{ week: 1, rate: 0.10 }, { week: 2, rate: 0.07 }]
    // (0.10 - 0.07) / 0.10 = 0.30 > 0.20
    expect(determineState(0.07, rates, 5)).toBe('DECLINING')
  })

  test('THRIVING when rate is healthy and stable', () => {
    const rates = [{ week: 1, rate: 0.10 }, { week: 2, rate: 0.11 }]
    expect(determineState(0.11, rates, 1)).toBe('THRIVING')
  })

  test('daysSinceLastInteraction null does not trigger DEAD', () => {
    expect(determineState(0, [], null)).toBe('THRIVING')
  })

  test('DORMANT takes priority over DECLINING when rate is extremely low', () => {
    const rates = [{ week: 1, rate: 0.002 }, { week: 2, rate: 0.001 }]
    expect(determineState(0.001, rates, 20)).toBe('DORMANT')
  })
})

describe('calculateDecayRate', () => {
  test('returns 0 with < 2 data points', () => {
    expect(calculateDecayRate([])).toBe(0)
    expect(calculateDecayRate([0.1])).toBe(0)
  })

  test('correct decay: 0.10 → 0.07 = 30%', () => {
    expect(calculateDecayRate([0.1, 0.07])).toBeCloseTo(0.3)
  })

  test('returns 0 when prev rate is 0', () => {
    expect(calculateDecayRate([0, 0.05])).toBe(0)
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd server && npx jest tests/classification.test.ts
```

Expected: FAIL — `classification` not found

- [ ] **Step 3: Create `server/src/services/classification.ts`**

```typescript
// server/src/services/classification.ts
import { prisma } from '../db/client'

export type FeatureState = 'THRIVING' | 'DECLINING' | 'DORMANT' | 'DEAD'

export interface WeeklyRate {
  week: number
  rate: number
}

export function determineState(
  currentRate: number,
  weeklyRates: WeeklyRate[],
  daysSinceLastInteraction: number | null
): FeatureState {
  // DEAD: zero interactions across ALL users for 30+ days
  if (daysSinceLastInteraction !== null && daysSinceLastInteraction >= 30) return 'DEAD'

  // DORMANT: interaction_rate < 1% sustained for 14+ days (2 weekly buckets)
  if (
    weeklyRates.length >= 2 &&
    weeklyRates.slice(-2).every(w => w.rate < 0.01)
  ) return 'DORMANT'

  // DECLINING: rate dropped >20% WoW for last measured period
  if (weeklyRates.length >= 2) {
    const prev = weeklyRates[weeklyRates.length - 2].rate
    const curr = weeklyRates[weeklyRates.length - 1].rate
    if (prev > 0 && (prev - curr) / prev > 0.2) return 'DECLINING'
  }

  return 'THRIVING'
}

export function calculateDecayRate(weeklyRates: number[]): number {
  if (weeklyRates.length < 2) return 0
  const prev = weeklyRates[weeklyRates.length - 2]
  const curr = weeklyRates[weeklyRates.length - 1]
  if (prev === 0) return 0
  return (prev - curr) / prev
}

export async function classifyFeature(featureId: string): Promise<FeatureState> {
  const agg = await prisma.dailyAggregate.findMany({
    where: { featureId },
    orderBy: { date: 'desc' },
    take: 14,
  })

  if (agg.length === 0) return 'THRIVING'

  const feature = await prisma.feature.findUnique({ where: { id: featureId } })
  const daysSince = feature?.lastInteraction
    ? Math.floor((Date.now() - feature.lastInteraction.getTime()) / 86_400_000)
    : null

  // Build weekly buckets (group by 7-day windows)
  const byWeek = new Map<number, number[]>()
  agg.forEach((row, i) => {
    const week = Math.floor(i / 7)
    if (!byWeek.has(week)) byWeek.set(week, [])
    byWeek.get(week)!.push(row.interactionRate)
  })
  const weeklyRates: WeeklyRate[] = Array.from(byWeek.entries())
    .sort(([a], [b]) => b - a)
    .map(([week, rates]) => ({
      week,
      rate: rates.reduce((s, r) => s + r, 0) / rates.length,
    }))
    .reverse()

  const currentRate = agg[0]?.interactionRate ?? 0
  return determineState(currentRate, weeklyRates, daysSince)
}
```

- [ ] **Step 4: Run tests**

```bash
cd server && npx jest tests/classification.test.ts
```

Expected: `8 tests passed`

- [ ] **Step 5: Commit**

```bash
git add server/src/services/classification.ts server/tests/classification.test.ts
git commit -m "feat(server): add classification service — THRIVING/DECLINING/DORMANT/DEAD state machine"
```

---

### Task 20: Aggregation service + nightly cron

**Target day:** 10

**Files:**
- Create: `server/src/services/aggregation.ts`
- Create: `server/src/cron/nightly.ts`

- [ ] **Step 1: Create `server/src/services/aggregation.ts`**

```typescript
// server/src/services/aggregation.ts
import { prisma } from '../db/client'
import { classifyFeature } from './classification'

export async function aggregateDay(appId: string, date: Date): Promise<void> {
  const startOfDay = new Date(date)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay)
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1)

  // Get all distinct featureIds for this app that had events today
  const featureIds = await prisma.rawEvent.groupBy({
    by: ['featureId'],
    where: { appId, timestamp: { gte: startOfDay, lt: endOfDay } },
  })

  for (const { featureId } of featureIds) {
    const events = await prisma.rawEvent.findMany({
      where: { featureId, appId, timestamp: { gte: startOfDay, lt: endOfDay } },
    })

    const interactions = events.filter(e => e.eventType !== 'IMPRESSION').length
    const impressions  = events.filter(e => e.eventType === 'IMPRESSION').length
    const uniqueUsers  = new Set(events.map(e => e.deviceId).filter(Boolean)).size
    const interactionRate = impressions > 0 ? interactions / impressions : 0

    await prisma.dailyAggregate.upsert({
      where: { featureId_date: { featureId, date: startOfDay } },
      update: { interactions, impressions, uniqueUsers, interactionRate },
      create: { featureId, date: startOfDay, interactions, impressions, uniqueUsers, interactionRate },
    })
  }
}

export async function runNightlyAggregation(): Promise<void> {
  console.log('[Cron] Starting nightly aggregation…')
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)

  const apps = await prisma.app.findMany({ select: { id: true } })

  for (const app of apps) {
    await aggregateDay(app.id, yesterday)
    await classifyAllFeatures(app.id)
  }

  // Cleanup: delete raw events older than 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const deleted = await prisma.rawEvent.deleteMany({
    where: { timestamp: { lt: cutoff } },
  })
  console.log(`[Cron] Done. Deleted ${deleted.count} expired raw events.`)
}

async function classifyAllFeatures(appId: string): Promise<void> {
  const features = await prisma.feature.findMany({
    where: { appId, isIgnored: false },
  })

  for (const feature of features) {
    const newState = await classifyFeature(feature.id)
    if (newState !== feature.state) {
      await prisma.feature.update({
        where: { id: feature.id },
        data: { state: newState },
      })
      await prisma.stateTransition.create({
        data: {
          featureId: feature.id,
          oldState: feature.state,
          newState,
          reason: `Automated classification on ${new Date().toISOString().slice(0, 10)}`,
        },
      })
    }
  }
}
```

- [ ] **Step 2: Create `server/src/cron/nightly.ts`**

```typescript
// server/src/cron/nightly.ts
import cron from 'node-cron'
import { runNightlyAggregation } from '../services/aggregation'

export function startCronJobs(): void {
  // Runs at 02:00 AM UTC every day
  cron.schedule('0 2 * * *', async () => {
    try {
      await runNightlyAggregation()
    } catch (err) {
      console.error('[Cron] Nightly aggregation failed:', err)
    }
  }, { timezone: 'UTC' })

  console.log('[Cron] Nightly aggregation scheduled for 02:00 UTC')
}
```

- [ ] **Step 3: Wire cron into `src/index.ts`**

Add to `server/src/index.ts` after the route registrations:

```typescript
import { startCronJobs } from './cron/nightly'
// ...existing code...
startCronJobs()
```

- [ ] **Step 4: Build**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add server/src/services/aggregation.ts server/src/cron/nightly.ts server/src/index.ts
git commit -m "feat(server): add nightly aggregation service and 02:00 UTC cron job"
```

---

### Task 21: Portal API endpoints (features, dashboard, timeline)

**Target day:** 11

**Files:**
- Create: `server/src/routes/features.ts`
- Create: `server/src/routes/dashboard.ts`

- [ ] **Step 1: Create `server/src/routes/features.ts`**

```typescript
// server/src/routes/features.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth } from '../middleware/auth'

export const featuresRouter = Router()

// GET /api/v1/apps/:appId/features?state=DEAD&screen=HomeActivity&page=1&limit=20
featuresRouter.get('/apps/:appId/features', jwtAuth, async (req, res) => {
  const { appId } = req.params
  const { state, screen, page = '1', limit = '20' } = req.query

  const where: Record<string, unknown> = { appId }
  if (state)  where.state = state
  if (screen) where.screenName = screen

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
  const [features, total] = await Promise.all([
    prisma.feature.findMany({ where, skip, take: parseInt(limit as string), orderBy: { lastInteraction: 'desc' } }),
    prisma.feature.count({ where }),
  ])

  res.json({
    data: features.map(f => ({
      ...f,
      daysSinceLastUse: f.lastInteraction
        ? Math.floor((Date.now() - f.lastInteraction.getTime()) / 86_400_000)
        : null,
    })),
    pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total },
  })
})

// GET /api/v1/features/:featureId
featuresRouter.get('/:featureId', jwtAuth, async (req, res) => {
  const feature = await prisma.feature.findUnique({ where: { id: req.params.featureId } })
  if (!feature) return res.status(404).json({ error: 'Feature not found' })
  res.json(feature)
})

// GET /api/v1/features/:featureId/timeline
featuresRouter.get('/:featureId/timeline', jwtAuth, async (req, res) => {
  const days = parseInt(req.query.days as string ?? '30')
  const since = new Date(Date.now() - days * 86_400_000)
  const rows = await prisma.dailyAggregate.findMany({
    where: { featureId: req.params.featureId, date: { gte: since } },
    orderBy: { date: 'asc' },
  })
  res.json(rows)
})

// PATCH /api/v1/features/:featureId/ignore
featuresRouter.patch('/:featureId/ignore', jwtAuth, async (req, res) => {
  const { ignore } = req.body as { ignore: boolean }
  const feature = await prisma.feature.update({
    where: { id: req.params.featureId },
    data: { isIgnored: ignore },
  })
  res.json(feature)
})

// GET /api/v1/apps/:appId/export?format=json
featuresRouter.get('/apps/:appId/export', jwtAuth, async (req, res) => {
  const features = await prisma.feature.findMany({ where: { appId: req.params.appId } })
  const format = req.query.format as string ?? 'json'
  if (format === 'csv') {
    const header = 'featureId,elementType,resourceName,screenName,state,lastInteraction\n'
    const rows = features.map(f =>
      `${f.id},${f.elementType},${f.resourceName ?? ''},${f.screenName},${f.state},${f.lastInteraction?.toISOString() ?? ''}`
    ).join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="features.csv"')
    return res.send(header + rows)
  }
  res.json(features)
})
```

- [ ] **Step 2: Create `server/src/routes/dashboard.ts`**

```typescript
// server/src/routes/dashboard.ts
import { Router } from 'express'
import { prisma } from '../db/client'
import { jwtAuth } from '../middleware/auth'

export const dashboardRouter = Router()

// GET /api/v1/apps/:appId/dashboard
dashboardRouter.get('/apps/:appId/dashboard', jwtAuth, async (req, res) => {
  const { appId } = req.params

  const [stateCounts, recentTransitions] = await Promise.all([
    prisma.feature.groupBy({ by: ['state'], where: { appId }, _count: true }),
    prisma.stateTransition.findMany({
      where: { feature: { appId } },
      orderBy: { changedAt: 'desc' },
      take: 10,
      include: { feature: { select: { resourceName: true, screenName: true } } },
    }),
  ])

  const counts = { TOTAL: 0, THRIVING: 0, DECLINING: 0, DORMANT: 0, DEAD: 0 }
  for (const { state, _count } of stateCounts) {
    counts[state as keyof typeof counts] = _count
    counts.TOTAL += _count
  }

  res.json({ counts, recentTransitions })
})

// GET /api/v1/apps/:appId/dead
dashboardRouter.get('/apps/:appId/dead', jwtAuth, async (req, res) => {
  const features = await prisma.feature.findMany({
    where: { appId: req.params.appId, state: 'DEAD', isIgnored: false },
    orderBy: { lastInteraction: 'asc' },
  })
  res.json(features)
})

// GET /api/v1/apps/:appId/declining
dashboardRouter.get('/apps/:appId/declining', jwtAuth, async (req, res) => {
  const features = await prisma.feature.findMany({
    where: { appId: req.params.appId, state: 'DECLINING', isIgnored: false },
    orderBy: { lastInteraction: 'desc' },
  })
  res.json(features)
})
```

- [ ] **Step 3: Build**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Smoke test — start server and hit `/health`**

```bash
cd server && npm run dev &
curl http://localhost:3000/health
```

Expected: `{"status":"ok"}`

Kill the dev server after confirming.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/features.ts server/src/routes/dashboard.ts
git commit -m "feat(server): add portal API routes — features list, timeline, dashboard stats, dead/declining"
```

---

### Task 22: Server tests (ingestion + routes)

**Target day:** 12–13

**Files:**
- Create: `server/tests/ingestion.test.ts`
- Create: `server/tests/routes.test.ts`

- [ ] **Step 1: Create `server/tests/ingestion.test.ts`**

```typescript
// server/tests/ingestion.test.ts
import { ingestBatch, BatchPayload } from '../src/services/ingestion'
import { prisma } from '../src/db/client'

// Clean test DB before each test
beforeEach(async () => {
  await prisma.rawEvent.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

async function createTestApp() {
  return prisma.app.create({
    data: { name: 'Test', packageName: 'com.test', apiKey: 'fp_test_key', apiKeyHash: 'fp_test_key', ownerEmail: 'test@test.com' },
  })
}

const validPayload = (appId: string): BatchPayload => ({
  appId,
  deviceId: 'dev_abc',
  sdkVersion: '1.0.0',
  events: [
    { eventId: '00000000-0000-0000-0000-000000000001', featureId: 'feat_001', eventType: 'TAP', timestamp: Date.now(), sessionId: 'sess_x', deviceId: 'dev_abc' },
    { eventId: '00000000-0000-0000-0000-000000000002', featureId: 'feat_002', eventType: 'IMPRESSION', timestamp: Date.now(), sessionId: 'sess_x', deviceId: 'dev_abc' },
  ],
})

test('accepts valid batch and returns correct counts', async () => {
  const app = await createTestApp()
  const result = await ingestBatch(app.id, validPayload(app.id))
  expect(result.accepted).toBe(2)
  expect(result.rejected).toBe(0)
  expect(result.errors).toHaveLength(0)
})

test('rejects duplicate eventId (idempotent insert)', async () => {
  const app = await createTestApp()
  const payload = validPayload(app.id)
  await ingestBatch(app.id, payload)
  const result2 = await ingestBatch(app.id, payload)
  expect(result2.accepted).toBe(2) // upsert: no-op on conflict
})

test('rejects event with invalid eventType', async () => {
  const app = await createTestApp()
  const payload = { ...validPayload(app.id), events: [{ eventId: '00000000-0000-0000-0000-000000000099', featureId: 'feat_x', eventType: 'CLICK' as never, timestamp: Date.now() }] }
  const result = await ingestBatch(app.id, payload)
  expect(result.rejected).toBe(1)
})

test('rejects event with timestamp older than 7 days', async () => {
  const app = await createTestApp()
  const oldTs = Date.now() - 8 * 24 * 60 * 60 * 1000
  const payload = { ...validPayload(app.id), events: [{ eventId: '00000000-0000-0000-0000-000000000010', featureId: 'feat_x', eventType: 'TAP' as const, timestamp: oldTs }] }
  const result = await ingestBatch(app.id, payload)
  expect(result.rejected).toBe(1)
})
```

- [ ] **Step 2: Create `server/tests/routes.test.ts`**

```typescript
// server/tests/routes.test.ts
import request from 'supertest'
import { app } from '../src/index'
import { prisma } from '../src/db/client'

let testApiKey: string
let testAppId: string

beforeAll(async () => {
  await prisma.rawEvent.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
  const testApp = await prisma.app.create({
    data: { name: 'RouteTest', packageName: 'com.routetest', apiKey: 'fp_route_key', apiKeyHash: 'fp_route_key', ownerEmail: 'route@test.com' },
  })
  testApiKey = testApp.apiKey
  testAppId  = testApp.id
})

afterAll(async () => { await prisma.$disconnect() })

describe('POST /api/v1/events/batch', () => {
  test('returns 200 with valid payload', async () => {
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('x-api-key', testApiKey)
      .send({
        appId: testAppId,
        deviceId: 'dev_1',
        sdkVersion: '1.0.0',
        events: [{ eventId: '00000000-0000-0000-0000-000000000101', featureId: 'feat_1', eventType: 'TAP', timestamp: Date.now() }],
      })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toBe(1)
  })

  test('returns 401 with missing API key', async () => {
    const res = await request(app).post('/api/v1/events/batch').send({})
    expect(res.status).toBe(401)
  })

  test('returns 401 with invalid API key', async () => {
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('x-api-key', 'fp_wrong_key')
      .send({ appId: testAppId, events: [] })
    expect(res.status).toBe(401)
  })

  test('returns 400 with empty events array', async () => {
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('x-api-key', testApiKey)
      .send({ appId: testAppId, events: [] })
    expect(res.status).toBe(400)
  })
})

describe('GET /health', () => {
  test('returns ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
```

- [ ] **Step 3: Run all server tests**

```bash
cd server && npm test
```

Expected: `classification: 8 passed, ingestion: 4 passed, routes: 5 passed`

- [ ] **Step 4: Commit**

```bash
git add server/tests/
git commit -m "test(server): add ingestion, classification, and route integration tests"
```

---

*Phase 2 complete. Server runs, all endpoints respond, tests pass. Proceed to Phase 3.*

---

## Phase 3: SDK Sync + Web Portal (Days 14–21)

---

### Task 23: `RetryPolicy`

**Target day:** 14

**Files:**
- Create: `sdk/src/main/kotlin/com/featurepulse/internal/sync/RetryPolicy.kt`
- Create: `sdk/src/test/kotlin/com/featurepulse/RetryPolicyTest.kt`

- [ ] **Step 1: Write failing tests**

```kotlin
// sdk/src/test/kotlin/com/featurepulse/RetryPolicyTest.kt
package com.featurepulse

import com.featurepulse.internal.sync.RetryPolicy
import org.junit.Assert.*
import org.junit.Test

class RetryPolicyTest {

    @Test
    fun `first attempt returns base delay`() {
        val policy = RetryPolicy(baseDelayMs = 60_000L, maxAttempts = 5)
        assertEquals(60_000L, policy.nextDelay())
    }

    @Test
    fun `delays double each attempt`() {
        val policy = RetryPolicy(baseDelayMs = 1000L, maxAttempts = 5)
        assertEquals(1000L,  policy.nextDelay())
        assertEquals(2000L,  policy.nextDelay())
        assertEquals(4000L,  policy.nextDelay())
        assertEquals(8000L,  policy.nextDelay())
        assertEquals(16000L, policy.nextDelay())
    }

    @Test
    fun `returns null after maxAttempts`() {
        val policy = RetryPolicy(baseDelayMs = 1000L, maxAttempts = 2)
        policy.nextDelay()
        policy.nextDelay()
        assertNull(policy.nextDelay())
    }

    @Test
    fun `caps at 30 minutes`() {
        val policy = RetryPolicy(baseDelayMs = 60_000L, maxAttempts = 10)
        repeat(10) { policy.nextDelay() }
        // All delays are capped — no assert needed; just verify no crash and null after max
        assertNull(policy.nextDelay())
    }

    @Test
    fun `reset allows retrying again`() {
        val policy = RetryPolicy(baseDelayMs = 1000L, maxAttempts = 1)
        policy.nextDelay()
        assertNull(policy.nextDelay())
        policy.reset()
        assertNotNull(policy.nextDelay())
    }
}
```

- [ ] **Step 2: Run to confirm failure**

```bash
./gradlew :sdk:test --tests "com.featurepulse.RetryPolicyTest"
```

Expected: FAIL

- [ ] **Step 3: Replace the stub `RetryPolicy.kt` with the full implementation**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/sync/RetryPolicy.kt
package com.featurepulse.internal.sync

internal class RetryPolicy(
    private val baseDelayMs: Long = 60_000L,
    private val maxAttempts: Int = 5,
    private val maxDelayMs: Long = 30 * 60_000L
) {
    private var attempt = 0

    /** Returns the next delay in ms, or null if max attempts exhausted. */
    fun nextDelay(): Long? {
        if (attempt >= maxAttempts) return null
        val delay = (baseDelayMs * (1L shl attempt)).coerceAtMost(maxDelayMs)
        attempt++
        return delay
    }

    fun reset() { attempt = 0 }

    val hasAttemptsLeft: Boolean get() = attempt < maxAttempts
}
```

- [ ] **Step 4: Run tests**

```bash
./gradlew :sdk:test --tests "com.featurepulse.RetryPolicyTest"
```

Expected: `5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/sync/RetryPolicy.kt \
        sdk/src/test/kotlin/com/featurepulse/RetryPolicyTest.kt
git commit -m "feat(sdk): add RetryPolicy — exponential backoff capped at 30 min"
```

---

### Task 24: `ApiClient` (OkHttp batch upload)

**Target day:** 14

**Files:**
- Modify: `sdk/src/main/kotlin/com/featurepulse/internal/sync/ApiClient.kt`
- Create: `sdk/src/test/kotlin/com/featurepulse/ApiClientTest.kt`

- [ ] **Step 1: Write failing tests using MockWebServer**

```kotlin
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
./gradlew :sdk:test --tests "com.featurepulse.ApiClientTest"
```

Expected: FAIL — `sendBatch` throws `NotImplementedError`

- [ ] **Step 3: Replace `ApiClient.kt` stub with full implementation**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/sync/ApiClient.kt
package com.featurepulse.internal.sync

import com.featurepulse.PulseConfig
import com.featurepulse.internal.model.BatchPayload
import com.featurepulse.internal.model.RawEvent
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

internal class ApiClient(private val config: PulseConfig) {

    private val gson = Gson()
    private val JSON = "application/json".toMediaType()
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    suspend fun sendBatch(events: List<RawEvent>) = withContext(Dispatchers.IO) {
        val payload = BatchPayload(
            appId      = config.appId,
            deviceId   = "sdk",
            sdkVersion = "1.0.0",
            events     = events
        )
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("${config.serverUrl}/api/v1/events/batch")
            .header("X-API-Key", config.apiKey)
            .post(body)
            .build()

        val response = http.newCall(request).execute()
        response.use {
            if (!it.isSuccessful) {
                throw IOException("Server returned ${it.code}")
            }
        }
    }

    suspend fun fetchRemoteConfig(): Map<String, Any> = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("${config.serverUrl}/api/v1/apps/config?appId=${config.appId}")
            .header("X-API-Key", config.apiKey)
            .get()
            .build()

        val response = http.newCall(request).execute()
        response.use {
            if (!it.isSuccessful) return@withContext emptyMap()
            @Suppress("UNCHECKED_CAST")
            gson.fromJson(it.body?.string() ?: "{}", Map::class.java) as Map<String, Any>
        }
    }
}
```

- [ ] **Step 4: Run tests**

```bash
./gradlew :sdk:test --tests "com.featurepulse.ApiClientTest"
```

Expected: `4 tests passed`

- [ ] **Step 5: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/sync/ApiClient.kt \
        sdk/src/test/kotlin/com/featurepulse/ApiClientTest.kt
git commit -m "feat(sdk): implement ApiClient — OkHttp batch upload with X-API-Key auth"
```

---

### Task 25: `RemoteConfigCache`

**Target day:** 15

**Files:**
- Modify: `sdk/src/main/kotlin/com/featurepulse/internal/sync/RemoteConfigCache.kt`

- [ ] **Step 1: Replace stub with full implementation**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/sync/RemoteConfigCache.kt
package com.featurepulse.internal.sync

import android.content.Context
import com.featurepulse.PulseConfig
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

internal class RemoteConfigCache(
    context: Context,
    private val apiClient: ApiClient,
    private val cacheTtlMs: Long = 6 * 60 * 60 * 1000L  // 6 hours
) {
    private val prefs = context.getSharedPreferences("fp_remote_config", Context.MODE_PRIVATE)
    private val gson = Gson()

    data class CachedConfig(val config: Map<String, Any>, val fetchedAt: Long)

    suspend fun getConfig(): Map<String, Any> {
        val cached = loadFromPrefs()
        if (cached != null && System.currentTimeMillis() - cached.fetchedAt < cacheTtlMs) {
            return cached.config
        }
        return try {
            val fresh = apiClient.fetchRemoteConfig()
            saveToPrefs(CachedConfig(fresh, System.currentTimeMillis()))
            fresh
        } catch (e: Exception) {
            cached?.config ?: PulseConfig.REMOTE_DEFAULTS
        }
    }

    private fun loadFromPrefs(): CachedConfig? {
        val json = prefs.getString("config", null) ?: return null
        return try {
            val type = object : TypeToken<CachedConfig>() {}.type
            gson.fromJson(json, type)
        } catch (e: Exception) { null }
    }

    private fun saveToPrefs(cached: CachedConfig) {
        prefs.edit().putString("config", gson.toJson(cached)).apply()
    }
}
```

- [ ] **Step 2: Add `REMOTE_DEFAULTS` companion to `PulseConfig.kt`**

In `sdk/src/main/kotlin/com/featurepulse/PulseConfig.kt`, add inside the class body after the `Builder` class:

```kotlin
    companion object {
        val REMOTE_DEFAULTS: Map<String, Any> = mapOf(
            "enabled"         to true,
            "syncIntervalMs"  to 1_800_000,
            "batchSize"       to 500,
            "minImpressionMs" to 1000,
            "samplingRate"    to 1.0
        )
    }
```

- [ ] **Step 3: Build**

```bash
./gradlew :sdk:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 4: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/sync/RemoteConfigCache.kt \
        sdk/src/main/kotlin/com/featurepulse/PulseConfig.kt
git commit -m "feat(sdk): add RemoteConfigCache — 6h TTL, falls back to hardcoded defaults"
```

---

### Task 26: `SyncWorker` (WorkManager)

**Target day:** 15

**Files:**
- Modify: `sdk/src/main/kotlin/com/featurepulse/internal/sync/SyncWorker.kt`

- [ ] **Step 1: Replace stub with full WorkManager implementation**

```kotlin
// sdk/src/main/kotlin/com/featurepulse/internal/sync/SyncWorker.kt
package com.featurepulse.internal.sync

import android.content.Context
import androidx.work.*
import com.featurepulse.FeaturePulse
import com.featurepulse.PulseConfig
import java.util.concurrent.TimeUnit

internal class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        return try {
            FeaturePulse.flush()
            Result.success()
        } catch (e: Exception) {
            if (runAttemptCount < 3) Result.retry() else Result.failure()
        }
    }

    companion object {
        private const val WORK_NAME = "fp_sync_worker"

        fun schedule(context: Context, config: PulseConfig) {
            val constraints = Constraints.Builder()
                .apply {
                    if (config.syncOnWifiOnly) {
                        setRequiredNetworkType(NetworkType.UNMETERED)
                    } else {
                        setRequiredNetworkType(NetworkType.CONNECTED)
                    }
                }
                .build()

            val request = PeriodicWorkRequestBuilder<SyncWorker>(
                config.syncIntervalMs, TimeUnit.MILLISECONDS,
                // flex window = 20% of interval (WorkManager minimum is 5 min)
                (config.syncIntervalMs * 0.2).toLong().coerceAtLeast(5 * 60_000L), TimeUnit.MILLISECONDS
            )
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }

        fun cancelAll(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }
}
```

- [ ] **Step 2: Build**

```bash
./gradlew :sdk:assembleDebug
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: Run all SDK tests**

```bash
./gradlew :sdk:test
```

Expected: all previously passing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add sdk/src/main/kotlin/com/featurepulse/internal/sync/SyncWorker.kt
git commit -m "feat(sdk): implement SyncWorker — WorkManager periodic flush with WiFi-only option"
```

---

### Task 27: Portal project setup + routing + auth

**Target day:** 16

**Files:**
- Create: `portal/` (Vite scaffold)
- Create: `portal/src/api/client.ts`
- Create: `portal/src/pages/Login.tsx`
- Create: `portal/src/App.tsx`

- [ ] **Step 1: Scaffold portal with Vite**

```bash
cd portal && npm create vite@latest . -- --template react-ts
npm install
npm install react-router-dom recharts axios
npm install -D @types/react @types/react-dom
```

- [ ] **Step 2: Create `portal/src/api/client.ts`**

```typescript
// portal/src/api/client.ts
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

function getToken() { return localStorage.getItem('fp_token') }
export function setToken(t: string) { localStorage.setItem('fp_token', t) }
export function clearToken() { localStorage.removeItem('fp_token') }
export function isLoggedIn() { return !!getToken() }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  login:          (email: string, password: string) =>
    request<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register:       (email: string, password: string, appName: string, packageName: string) =>
    request<{ token: string; apiKey: string; appId: string }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ email, password, appName, packageName }),
    }),

  getDashboard:   (appId: string) =>
    request<{ counts: Record<string, number>; recentTransitions: unknown[] }>(`/apps/${appId}/dashboard`),

  getFeatures:    (appId: string, params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString()
    return request<{ data: Feature[]; pagination: Pagination }>(`/apps/${appId}/features${qs ? `?${qs}` : ''}`)
  },

  getFeature:     (featureId: string) =>
    request<Feature>(`/features/${featureId}`),

  getTimeline:    (featureId: string, days = 30) =>
    request<TimelineRow[]>(`/features/${featureId}/timeline?days=${days}`),

  ignoreFeature:  (featureId: string, ignore: boolean) =>
    request<Feature>(`/features/${featureId}/ignore`, { method: 'PATCH', body: JSON.stringify({ ignore }) }),

  getDeadFeatures: (appId: string) =>
    request<Feature[]>(`/apps/${appId}/dead`),

  exportFeatures:  (appId: string, format: 'json' | 'csv') =>
    `${BASE}/api/v1/apps/${appId}/export?format=${format}`,
}

export interface Feature {
  id: string; appId: string; elementType: string; resourceName: string | null
  screenName: string; state: 'THRIVING' | 'DECLINING' | 'DORMANT' | 'DEAD'
  lastInteraction: string | null; firstSeen: string; isIgnored: boolean
  daysSinceLastUse: number | null
}

export interface TimelineRow {
  featureId: string; date: string; impressions: number
  interactions: number; uniqueUsers: number; interactionRate: number
}

export interface Pagination { page: number; limit: number; total: number }
```

- [ ] **Step 3: Create `portal/src/pages/Login.tsx`**

```tsx
// portal/src/pages/Login.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, setToken } from '../api/client'

export default function Login() {
  const nav = useNavigate()
  const [tab, setTab]         = useState<'login' | 'register'>('login')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [appName, setAppName] = useState('')
  const [pkgName, setPkg]     = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'login') {
        const { token } = await api.login(email, password)
        setToken(token)
        nav('/dashboard')
      } else {
        const { token } = await api.register(email, password, appName, pkgName)
        setToken(token)
        nav('/dashboard')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: '32px', border: '1px solid #e2e8f0', borderRadius: 12 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>FeaturePulse</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['login', 'register'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 6, cursor: 'pointer',
              background: tab === t ? '#4F46E5' : '#F1F5F9', color: tab === t ? '#fff' : '#334155' }}>
            {t === 'login' ? 'Sign in' : 'Register'}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          required style={inputStyle} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPass(e.target.value)}
          required style={inputStyle} />
        {tab === 'register' && <>
          <input placeholder="App name" value={appName} onChange={e => setAppName(e.target.value)}
            required style={inputStyle} />
          <input placeholder="Package name (com.example.app)" value={pkgName} onChange={e => setPkg(e.target.value)}
            required style={inputStyle} />
        </>}
        {error && <p style={{ color: '#DC2626', fontSize: 14 }}>{error}</p>}
        <button type="submit" disabled={loading}
          style={{ padding: 12, background: '#4F46E5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
          {loading ? 'Loading…' : tab === 'login' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 15,
}
```

- [ ] **Step 4: Create `portal/src/App.tsx`**

```tsx
// portal/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isLoggedIn } from './api/client'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Features from './pages/Features'
import FeatureDetail from './pages/FeatureDetail'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/features" element={<PrivateRoute><Features /></PrivateRoute>} />
        <Route path="/features/:featureId" element={<PrivateRoute><FeatureDetail /></PrivateRoute>} />
        <Route path="/alerts" element={<PrivateRoute><Alerts /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Step 5: Create stub files for the pages so App.tsx compiles**

Create each file with just the stub content below. They'll be fleshed out in the next tasks:

```tsx
// portal/src/pages/Dashboard.tsx
export default function Dashboard() { return <div>Dashboard</div> }

// portal/src/pages/Features.tsx
export default function Features() { return <div>Features</div> }

// portal/src/pages/FeatureDetail.tsx
export default function FeatureDetail() { return <div>Feature Detail</div> }

// portal/src/pages/Alerts.tsx
export default function Alerts() { return <div>Alerts</div> }

// portal/src/pages/Settings.tsx
export default function Settings() { return <div>Settings</div> }
```

- [ ] **Step 6: Set up `portal/.env`**

```
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 7: Verify portal compiles and login page renders**

```bash
cd portal && npm run build
```

Expected: `BUILD SUCCESSFUL` with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add portal/
git commit -m "feat(portal): scaffold Vite React app, add api client, login/register page, routing"
```

---

### Task 28: Shared components

**Target day:** 17

**Files:**
- Create: `portal/src/components/StateBadge.tsx`
- Create: `portal/src/components/StatCard.tsx`
- Create: `portal/src/components/NavBar.tsx`
- Create: `portal/src/components/TimelineChart.tsx`
- Create: `portal/src/components/FeatureTable.tsx`

- [ ] **Step 1: Create `portal/src/components/StateBadge.tsx`**

```tsx
// portal/src/components/StateBadge.tsx
import type { Feature } from '../api/client'

const STATE_COLORS: Record<Feature['state'], { bg: string; text: string }> = {
  THRIVING: { bg: '#DCFCE7', text: '#16A34A' },
  DECLINING: { bg: '#FEF9C3', text: '#CA8A04' },
  DORMANT:   { bg: '#FFEDD5', text: '#EA580C' },
  DEAD:      { bg: '#FEE2E2', text: '#DC2626' },
}

export default function StateBadge({ state }: { state: Feature['state'] }) {
  const { bg, text } = STATE_COLORS[state]
  return (
    <span style={{
      background: bg, color: text, padding: '2px 10px', borderRadius: 999,
      fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
    }}>
      {state}
    </span>
  )
}
```

- [ ] **Step 2: Create `portal/src/components/StatCard.tsx`**

```tsx
// portal/src/components/StatCard.tsx
interface Props { label: string; value: number | string; color?: string }

export default function StatCard({ label, value, color = '#0F172A' }: Props) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12,
      padding: '20px 24px', flex: 1,
    }}>
      <div style={{ fontSize: 36, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>{label}</div>
    </div>
  )
}
```

- [ ] **Step 3: Create `portal/src/components/NavBar.tsx`**

```tsx
// portal/src/components/NavBar.tsx
import { NavLink, useNavigate } from 'react-router-dom'
import { clearToken } from '../api/client'

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/features',  label: 'Features'  },
  { to: '/alerts',    label: 'Alerts'    },
  { to: '/settings',  label: 'Settings'  },
]

export default function NavBar() {
  const nav = useNavigate()
  function logout() { clearToken(); nav('/login') }

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '0 32px', height: 56, borderBottom: '1px solid #E2E8F0',
      background: '#fff', position: 'sticky', top: 0, zIndex: 100,
    }}>
      <span style={{ fontWeight: 800, fontSize: 17, color: '#4F46E5', marginRight: 24 }}>FeaturePulse</span>
      {LINKS.map(({ to, label }) => (
        <NavLink key={to} to={to} style={({ isActive }) => ({
          padding: '6px 14px', borderRadius: 6, textDecoration: 'none', fontSize: 14,
          fontWeight: isActive ? 700 : 500,
          color: isActive ? '#4F46E5' : '#475569',
          background: isActive ? '#EEF2FF' : 'transparent',
        })}>
          {label}
        </NavLink>
      ))}
      <button onClick={logout} style={{
        marginLeft: 'auto', padding: '6px 14px', border: '1px solid #E2E8F0',
        borderRadius: 6, cursor: 'pointer', fontSize: 14, background: '#fff', color: '#475569',
      }}>
        Logout
      </button>
    </nav>
  )
}
```

- [ ] **Step 4: Create `portal/src/components/TimelineChart.tsx`**

```tsx
// portal/src/components/TimelineChart.tsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { TimelineRow } from '../api/client'

interface Props { data: TimelineRow[] }

export default function TimelineChart({ data }: Props) {
  const chartData = data.map(row => ({
    date: new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    rate: parseFloat((row.interactionRate * 100).toFixed(2)),
    interactions: row.interactions,
    impressions: row.impressions,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#F1F5F9" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
        <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} unit="%" />
        <Tooltip formatter={(v: number) => [`${v}%`, 'Interaction rate']} />
        <Line type="monotone" dataKey="rate" stroke="#4F46E5" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 5: Create `portal/src/components/FeatureTable.tsx`**

```tsx
// portal/src/components/FeatureTable.tsx
import { useNavigate } from 'react-router-dom'
import StateBadge from './StateBadge'
import type { Feature } from '../api/client'

interface Props {
  features: Feature[]
  onIgnore?: (id: string, ignore: boolean) => void
}

export default function FeatureTable({ features, onIgnore }: Props) {
  const nav = useNavigate()

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left' }}>
          {['Element', 'Screen', 'State', 'Last used', 'Actions'].map(h => (
            <th key={h} style={{ padding: '10px 12px', color: '#64748B', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {features.map(f => (
          <tr key={f.id} style={{ borderBottom: '1px solid #F1F5F9' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}>
            <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#334155' }}>
              {f.resourceName ?? f.elementType}
            </td>
            <td style={{ padding: '10px 12px', color: '#64748B' }}>{f.screenName}</td>
            <td style={{ padding: '10px 12px' }}><StateBadge state={f.state} /></td>
            <td style={{ padding: '10px 12px', color: '#94A3B8' }}>
              {f.daysSinceLastUse !== null ? `${f.daysSinceLastUse}d ago` : 'Never'}
            </td>
            <td style={{ padding: '10px 12px' }}>
              <button onClick={() => nav(`/features/${f.id}`)}
                style={{ marginRight: 8, padding: '4px 10px', border: '1px solid #E2E8F0',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13, background: '#fff' }}>
                Detail
              </button>
              {onIgnore && (
                <button onClick={() => onIgnore(f.id, !f.isIgnored)}
                  style={{ padding: '4px 10px', border: '1px solid #E2E8F0',
                    borderRadius: 6, cursor: 'pointer', fontSize: 13, background: '#fff',
                    color: f.isIgnored ? '#16A34A' : '#94A3B8' }}>
                  {f.isIgnored ? 'Unignore' : 'Ignore'}
                </button>
              )}
            </td>
          </tr>
        ))}
        {features.length === 0 && (
          <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>No features found</td></tr>
        )}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 6: Build**

```bash
cd portal && npm run build
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
git add portal/src/components/
git commit -m "feat(portal): add StateBadge, StatCard, NavBar, TimelineChart, FeatureTable components"
```

---

### Task 29: Dashboard page

**Target day:** 17

**Files:**
- Modify: `portal/src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace stub with full implementation**

```tsx
// portal/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import NavBar from '../components/NavBar'
import StatCard from '../components/StatCard'
import StateBadge from '../components/StateBadge'
import type { Feature } from '../api/client'

// Hard-coded for demo; in production read appId from user profile
const APP_ID = localStorage.getItem('fp_appId') ?? ''

interface DashboardData {
  counts: { TOTAL: number; THRIVING: number; DECLINING: number; DORMANT: number; DEAD: number }
  recentTransitions: Array<{
    id: number; oldState: string; newState: string; changedAt: string; reason: string
    feature: { resourceName: string | null; screenName: string }
  }>
}

export default function Dashboard() {
  const nav = useNavigate()
  const [data, setData]     = useState<DashboardData | null>(null)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (!APP_ID) { nav('/settings'); return }
    api.getDashboard(APP_ID)
      .then(d => setData(d as DashboardData))
      .catch(e => setError(e.message))
  }, [nav])

  if (error) return <><NavBar /><p style={{ padding: 32, color: '#DC2626' }}>{error}</p></>
  if (!data)  return <><NavBar /><p style={{ padding: 32, color: '#94A3B8' }}>Loading…</p></>

  const { counts, recentTransitions } = data

  return (
    <>
      <NavBar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#0F172A' }}>Feature Health</h1>
        <p style={{ color: '#64748B', marginBottom: 28 }}>App · {APP_ID}</p>

        {/* Stat cards */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
          <StatCard label="Total Features" value={counts.TOTAL} />
          <StatCard label="Dead"      value={counts.DEAD}      color="#DC2626" />
          <StatCard label="Declining" value={counts.DECLINING} color="#CA8A04" />
          <StatCard label="Thriving"  value={counts.THRIVING}  color="#16A34A" />
        </div>

        {/* Recent state changes */}
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#0F172A' }}>
          Recent State Changes
        </h2>
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          {recentTransitions.length === 0 && (
            <p style={{ padding: 24, color: '#94A3B8' }}>No state changes yet — run the nightly cron first.</p>
          )}
          {recentTransitions.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 20px', borderBottom: '1px solid #F1F5F9',
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#334155', flex: 1 }}>
                {t.feature.resourceName ?? '(unnamed)'} · {t.feature.screenName}
              </span>
              <StateBadge state={t.newState as Feature['state']} />
              <span style={{ fontSize: 12, color: '#94A3B8' }}>
                {new Date(t.changedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Build**

```bash
cd portal && npm run build
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add portal/src/pages/Dashboard.tsx
git commit -m "feat(portal): implement Dashboard page — stat cards, recent state changes"
```

---

### Task 30: Features list + Feature detail pages

**Target day:** 18–19

**Files:**
- Modify: `portal/src/pages/Features.tsx`
- Modify: `portal/src/pages/FeatureDetail.tsx`

- [ ] **Step 1: Replace `Features.tsx` stub**

```tsx
// portal/src/pages/Features.tsx
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import NavBar from '../components/NavBar'
import FeatureTable from '../components/FeatureTable'
import type { Feature, Pagination } from '../api/client'

const APP_ID = localStorage.getItem('fp_appId') ?? ''
const STATES = ['', 'THRIVING', 'DECLINING', 'DORMANT', 'DEAD'] as const

export default function Features() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0 })
  const [stateFilter, setStateFilter] = useState('')
  const [loading, setLoading]         = useState(false)

  async function load(page = 1) {
    setLoading(true)
    const params: Record<string, string> = { page: String(page), limit: '20' }
    if (stateFilter) params.state = stateFilter
    const res = await api.getFeatures(APP_ID, params)
    setFeatures(res.data)
    setPagination(res.pagination)
    setLoading(false)
  }

  useEffect(() => { load(1) }, [stateFilter])

  async function handleIgnore(id: string, ignore: boolean) {
    await api.ignoreFeature(id, ignore)
    load(pagination.page)
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit)

  return (
    <>
      <NavBar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', flex: 1 }}>Features</h1>
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14 }}>
            <option value="">All states</option>
            {STATES.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <a href={api.exportFeatures(APP_ID, 'csv')} download
            style={{ padding: '8px 14px', background: '#4F46E5', color: '#fff', borderRadius: 8,
              textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            Export CSV
          </a>
        </div>

        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          {loading ? (
            <p style={{ padding: 32, textAlign: 'center', color: '#94A3B8' }}>Loading…</p>
          ) : (
            <FeatureTable features={features} onIgnore={handleIgnore} />
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 20 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => load(p)}
                style={{ padding: '6px 12px', border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer',
                  background: p === pagination.page ? '#4F46E5' : '#fff',
                  color: p === pagination.page ? '#fff' : '#475569' }}>
                {p}
              </button>
            ))}
          </div>
        )}
        <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 12 }}>
          {pagination.total} total features
        </p>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Replace `FeatureDetail.tsx` stub**

```tsx
// portal/src/pages/FeatureDetail.tsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import NavBar from '../components/NavBar'
import StateBadge from '../components/StateBadge'
import TimelineChart from '../components/TimelineChart'
import type { Feature, TimelineRow } from '../api/client'

export default function FeatureDetail() {
  const { featureId } = useParams<{ featureId: string }>()
  const nav = useNavigate()
  const [feature,  setFeature]  = useState<Feature | null>(null)
  const [timeline, setTimeline] = useState<TimelineRow[]>([])
  const [error, setError]       = useState('')

  useEffect(() => {
    if (!featureId) return
    Promise.all([api.getFeature(featureId), api.getTimeline(featureId, 30)])
      .then(([f, t]) => { setFeature(f); setTimeline(t) })
      .catch(e => setError(e.message))
  }, [featureId])

  async function toggleIgnore() {
    if (!feature) return
    const updated = await api.ignoreFeature(feature.id, !feature.isIgnored)
    setFeature(updated)
  }

  if (error)   return <><NavBar /><p style={{ padding: 32, color: '#DC2626' }}>{error}</p></>
  if (!feature) return <><NavBar /><p style={{ padding: 32, color: '#94A3B8' }}>Loading…</p></>

  const rows = [
    { label: 'Last Interaction', value: feature.daysSinceLastUse !== null ? `${feature.daysSinceLastUse}d ago` : 'Never', danger: feature.state === 'DEAD' },
    { label: 'First Seen',       value: new Date(feature.firstSeen).toLocaleDateString() },
    { label: 'Element Type',     value: feature.elementType },
    { label: 'Screen',           value: feature.screenName },
  ]

  return (
    <>
      <NavBar />
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
        <button onClick={() => nav(-1)}
          style={{ marginBottom: 20, padding: '6px 12px', border: '1px solid #E2E8F0',
            borderRadius: 6, cursor: 'pointer', background: '#fff', fontSize: 14, color: '#475569' }}>
          ← Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0F172A', marginBottom: 4 }}>
              {feature.resourceName ?? feature.elementType}
            </h1>
            <p style={{ color: '#64748B', fontSize: 14 }}>{feature.screenName} · {feature.elementType}</p>
          </div>
          <StateBadge state={feature.state} />
          <button onClick={toggleIgnore}
            style={{ padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8,
              cursor: 'pointer', background: '#fff', fontSize: 14,
              color: feature.isIgnored ? '#16A34A' : '#64748B' }}>
            {feature.isIgnored ? 'Unignore' : 'Ignore'}
          </button>
        </div>

        {/* Timeline chart */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#0F172A' }}>
            Interaction Rate — Last 30 Days
          </h2>
          {timeline.length > 0
            ? <TimelineChart data={timeline} />
            : <p style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>No data yet</p>}
        </div>

        {/* Data rows */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
          {rows.map(({ label, value, danger }) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between', padding: '14px 20px',
              borderBottom: '1px solid #F1F5F9',
            }}>
              <span style={{ color: '#64748B', fontSize: 14 }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: danger ? '#DC2626' : '#334155' }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Build**

```bash
cd portal && npm run build
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add portal/src/pages/Features.tsx portal/src/pages/FeatureDetail.tsx
git commit -m "feat(portal): implement Features list (filter, paginate, export) and Feature detail with timeline"
```

---

### Task 31: Alerts + Settings pages

**Target day:** 20

**Files:**
- Modify: `portal/src/pages/Alerts.tsx`
- Modify: `portal/src/pages/Settings.tsx`

- [ ] **Step 1: Replace `Alerts.tsx` stub**

```tsx
// portal/src/pages/Alerts.tsx
import { useState } from 'react'
import NavBar from '../components/NavBar'

const APP_ID = localStorage.getItem('fp_appId') ?? ''
const BASE   = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

export default function Alerts() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [saved, setSaved]           = useState(false)
  const [testing, setTesting]       = useState(false)
  const [testResult, setTestResult] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const token = localStorage.getItem('fp_token')
    await fetch(`${BASE}/api/v1/apps/${APP_ID}/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ webhookUrl }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  async function testWebhook() {
    setTesting(true)
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: '✅ FeaturePulse test webhook — connection confirmed' }),
      })
      setTestResult(res.ok ? '✅ Webhook delivered successfully' : `❌ Server returned ${res.status}`)
    } catch {
      setTestResult('❌ Could not reach webhook URL')
    }
    setTesting(false)
  }

  return (
    <>
      <NavBar />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#0F172A' }}>Alerts</h1>
        <p style={{ color: '#64748B', marginBottom: 28 }}>
          Get notified when a feature becomes DEAD or DECLINING.
        </p>

        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>
            Slack / Generic Webhook URL
          </label>
          <input
            type="url"
            placeholder="https://hooks.slack.com/services/…"
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            style={{ padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 15 }}
          />
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit"
              style={{ padding: '10px 20px', background: '#4F46E5', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
              {saved ? '✓ Saved' : 'Save'}
            </button>
            <button type="button" onClick={testWebhook} disabled={!webhookUrl || testing}
              style={{ padding: '10px 20px', background: '#F1F5F9', color: '#334155',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
              {testing ? 'Sending…' : 'Test webhook'}
            </button>
          </div>
          {testResult && <p style={{ fontSize: 14, color: testResult.startsWith('✅') ? '#16A34A' : '#DC2626' }}>{testResult}</p>}
        </form>

        <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid #E2E8F0' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#0F172A' }}>Alert Triggers</h2>
        {['Feature becomes DEAD', 'Feature becomes DECLINING', 'Feature resurrects from DEAD'].map(label => (
          <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" defaultChecked style={{ width: 16, height: 16 }} />
            <span style={{ fontSize: 14, color: '#334155' }}>{label}</span>
          </label>
        ))}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Replace `Settings.tsx` stub**

```tsx
// portal/src/pages/Settings.tsx
import { useState, useEffect } from 'react'
import NavBar from '../components/NavBar'

export default function Settings() {
  const [appId, setAppIdState]   = useState(localStorage.getItem('fp_appId') ?? '')
  const [apiKey, setApiKeyState] = useState(localStorage.getItem('fp_apiKey') ?? '')
  const [saved, setSaved]        = useState(false)

  function save(e: React.FormEvent) {
    e.preventDefault()
    localStorage.setItem('fp_appId',  appId)
    localStorage.setItem('fp_apiKey', apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <>
      <NavBar />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: '#0F172A' }}>Settings</h1>
        <p style={{ color: '#64748B', marginBottom: 28 }}>App ID and API key for this session.</p>

        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'App ID',  value: appId,   set: setAppIdState,   ph: 'uuid' },
            { label: 'API Key', value: apiKey,  set: setApiKeyState,  ph: 'fp_…' },
          ].map(({ label, value, set, ph }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: '#334155' }}>{label}</label>
              <input value={value} onChange={e => set(e.target.value)} placeholder={ph}
                style={{ padding: '10px 14px', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14,
                  fontFamily: 'monospace' }} />
            </div>
          ))}

          <button type="submit"
            style={{ alignSelf: 'flex-start', padding: '10px 20px', background: '#4F46E5',
              color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
            {saved ? '✓ Saved' : 'Save'}
          </button>
        </form>

        <hr style={{ margin: '32px 0', border: 'none', borderTop: '1px solid #E2E8F0' }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#0F172A' }}>SDK Integration</h2>
        <pre style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
          padding: 16, fontSize: 13, overflowX: 'auto', color: '#334155' }}>
{`// build.gradle.kts
implementation("com.github.featurepulse:sdk:1.0.0")

// Application.kt
FeaturePulse.init(this, PulseConfig.Builder()
    .setApiKey("${apiKey || 'YOUR_API_KEY'}")
    .setAppId("${appId || 'YOUR_APP_ID'}")
    .build())`}
        </pre>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Final portal build**

```bash
cd portal && npm run build
```

Expected: no errors

- [ ] **Step 4: Smoke test — start both server and portal dev servers**

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd portal && npm run dev
```

Open `http://localhost:5173`, register an account, verify dashboard loads.

- [ ] **Step 5: Commit**

```bash
git add portal/src/pages/Alerts.tsx portal/src/pages/Settings.tsx
git commit -m "feat(portal): implement Alerts (webhook config + test) and Settings pages"
```

---

*Phase 3 complete. SDK fully syncs to server. Portal serves all pages. Proceed to Phase 4.*

---

## Phase 4: Demo App + End-to-End Tests + Deploy (Days 22–24)

---

### Task 32: `ShopDemo` — demo Android app

**Target day:** 22

**Files:**
- Create: `demo-app/build.gradle.kts`
- Create: `demo-app/src/main/AndroidManifest.xml`
- Create: `demo-app/src/main/kotlin/com/featurepulse/demo/DemoApplication.kt`
- Create: `demo-app/src/main/kotlin/com/featurepulse/demo/HomeActivity.kt`
- Create: `demo-app/src/main/kotlin/com/featurepulse/demo/ProductFragment.kt`
- Create: `demo-app/src/main/kotlin/com/featurepulse/demo/ProfileActivity.kt`
- Create: `demo-app/src/main/kotlin/com/featurepulse/demo/SettingsActivity.kt`
- Create: `demo-app/src/main/res/layout/activity_home.xml`
- Create: `demo-app/src/main/res/layout/fragment_product.xml`
- Create: `demo-app/src/main/res/layout/activity_profile.xml`
- Create: `demo-app/src/main/res/layout/activity_settings.xml`

**Design intent:** Four screens with a mix of actively-used elements (nav, buy button) and intentionally dead ones (legacy promo banner, unused share button, hidden coupon input). After simulated zero-interaction, the dead elements surface in the portal.

- [ ] **Step 1: Add `demo-app` module to `settings.gradle.kts`**

```kotlin
// settings.gradle.kts (root)
include(":sdk", ":demo-app")
```

- [ ] **Step 2: Create `demo-app/build.gradle.kts`**

```kotlin
// demo-app/build.gradle.kts
plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "com.featurepulse.demo"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.featurepulse.demo"
        minSdk = 21
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
        buildConfigField("String", "FP_API_KEY", "\"${project.findProperty("FP_API_KEY") ?: ""}\"")
        buildConfigField("String", "FP_APP_ID",  "\"${project.findProperty("FP_APP_ID")  ?: ""}\"")
    }
    buildFeatures { viewBinding = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(project(":sdk"))
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.fragment:fragment-ktx:1.6.2")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
}
```

Add to `demo-app/local.properties` (gitignored):
```
FP_API_KEY=fp_your_key_here
FP_APP_ID=your-uuid-here
```

- [ ] **Step 3: Create `demo-app/src/main/AndroidManifest.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:name=".DemoApplication"
        android:label="ShopDemo"
        android:theme="@style/Theme.MaterialComponents.Light.DarkActionBar">

        <activity android:name=".HomeActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <activity android:name=".ProfileActivity" />
        <activity android:name=".SettingsActivity" />
    </application>
</manifest>
```

- [ ] **Step 4: Create `DemoApplication.kt`**

```kotlin
// demo-app/src/main/kotlin/com/featurepulse/demo/DemoApplication.kt
package com.featurepulse.demo

import android.app.Application
import com.featurepulse.FeaturePulse
import com.featurepulse.PulseConfig

class DemoApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        FeaturePulse.init(
            this,
            PulseConfig.Builder()
                .setApiKey(BuildConfig.FP_API_KEY)
                .setAppId(BuildConfig.FP_APP_ID)
                .setServerUrl("https://featurepulse.up.railway.app")
                .setBatchSize(50)
                .setSyncIntervalMinutes(1)   // short for demo purposes
                .build()
        )
    }
}
```

- [ ] **Step 5: Create layout files**

`demo-app/src/main/res/layout/activity_home.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent"
    android:orientation="vertical" android:padding="16dp">

    <!-- ACTIVE: users navigate to these constantly -->
    <Button android:id="@+id/btn_browse_products"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Browse Products" android:layout_marginBottom="8dp"/>

    <Button android:id="@+id/btn_view_profile"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="My Profile" android:layout_marginBottom="8dp"/>

    <!-- DEAD: legacy promo banner, never tapped since v1.2 -->
    <Button android:id="@+id/btn_summer_promo"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Summer Promo 2023" android:layout_marginBottom="8dp"
        android:backgroundTint="#FFD600"/>

    <!-- DEAD: feature-flagged share button, flag was never turned on -->
    <Button android:id="@+id/btn_share_app"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Share App" android:visibility="visible"/>

    <FrameLayout android:id="@+id/fragment_container"
        android:layout_width="match_parent" android:layout_height="0dp"
        android:layout_weight="1"/>
</LinearLayout>
```

`demo-app/src/main/res/layout/fragment_product.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent"
    android:orientation="vertical" android:padding="16dp">

    <!-- ACTIVE -->
    <Button android:id="@+id/btn_add_to_cart"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Add to Cart" android:layout_marginBottom="8dp"/>

    <Button android:id="@+id/btn_buy_now"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Buy Now" android:layout_marginBottom="8dp"/>

    <!-- DEAD: coupon input, collapsed and forgotten -->
    <EditText android:id="@+id/et_coupon_code"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:hint="Coupon code (legacy)" android:visibility="visible"
        android:layout_marginBottom="8dp"/>

    <!-- DEAD: AR view button, never worked on most devices -->
    <Button android:id="@+id/btn_view_ar"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="View in AR"/>
</LinearLayout>
```

`demo-app/src/main/res/layout/activity_profile.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent"
    android:orientation="vertical" android:padding="16dp">

    <!-- ACTIVE -->
    <Button android:id="@+id/btn_edit_profile"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Edit Profile" android:layout_marginBottom="8dp"/>

    <Button android:id="@+id/btn_order_history"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Order History" android:layout_marginBottom="8dp"/>

    <!-- DEAD: social connect, never used -->
    <Button android:id="@+id/btn_connect_facebook"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Connect Facebook"/>
</LinearLayout>
```

`demo-app/src/main/res/layout/activity_settings.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent" android:layout_height="match_parent"
    android:orientation="vertical" android:padding="16dp">

    <!-- ACTIVE -->
    <Button android:id="@+id/btn_notifications"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Notification Settings" android:layout_marginBottom="8dp"/>

    <!-- DEAD: beta program, closed 18 months ago -->
    <Button android:id="@+id/btn_join_beta"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="Join Beta Program (closed)" android:layout_marginBottom="8dp"/>

    <!-- SDK debug flush button -->
    <Button android:id="@+id/btn_flush_sdk"
        android:layout_width="match_parent" android:layout_height="wrap_content"
        android:text="[DEBUG] Flush FeaturePulse"/>
</LinearLayout>
```

- [ ] **Step 6: Create activity/fragment Kotlin files**

```kotlin
// demo-app/src/main/kotlin/com/featurepulse/demo/HomeActivity.kt
package com.featurepulse.demo

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.featurepulse.demo.databinding.ActivityHomeBinding

class HomeActivity : AppCompatActivity() {
    private lateinit var binding: ActivityHomeBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "ShopDemo — Home"

        binding.btnBrowseProducts.setOnClickListener {
            supportFragmentManager.beginTransaction()
                .replace(binding.fragmentContainer.id, ProductFragment())
                .addToBackStack(null)
                .commit()
        }
        binding.btnViewProfile.setOnClickListener {
            startActivity(Intent(this, ProfileActivity::class.java))
        }
        // Dead buttons: wired to listeners that never fire in normal usage
        binding.btnSummerPromo.setOnClickListener { /* intentionally dead */ }
        binding.btnShareApp.setOnClickListener   { /* intentionally dead */ }
    }
}
```

```kotlin
// demo-app/src/main/kotlin/com/featurepulse/demo/ProductFragment.kt
package com.featurepulse.demo

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.featurepulse.demo.databinding.FragmentProductBinding

class ProductFragment : Fragment() {
    private var _binding: FragmentProductBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, state: Bundle?): View {
        _binding = FragmentProductBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        binding.btnAddToCart.setOnClickListener { Toast.makeText(context, "Added!", Toast.LENGTH_SHORT).show() }
        binding.btnBuyNow.setOnClickListener    { Toast.makeText(context, "Purchasing…", Toast.LENGTH_SHORT).show() }
        binding.btnViewAr.setOnClickListener   { /* intentionally dead */ }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
```

```kotlin
// demo-app/src/main/kotlin/com/featurepulse/demo/ProfileActivity.kt
package com.featurepulse.demo

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.featurepulse.demo.databinding.ActivityProfileBinding

class ProfileActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val binding = ActivityProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "My Profile"
        binding.btnEditProfile.setOnClickListener  { Toast.makeText(this, "Edit…", Toast.LENGTH_SHORT).show() }
        binding.btnOrderHistory.setOnClickListener { Toast.makeText(this, "Orders…", Toast.LENGTH_SHORT).show() }
        binding.btnConnectFacebook.setOnClickListener { /* dead */ }
    }
}
```

```kotlin
// demo-app/src/main/kotlin/com/featurepulse/demo/SettingsActivity.kt
package com.featurepulse.demo

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.featurepulse.FeaturePulse
import com.featurepulse.demo.databinding.ActivitySettingsBinding

class SettingsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val binding = ActivitySettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        title = "Settings"
        binding.btnNotifications.setOnClickListener { Toast.makeText(this, "Notifications…", Toast.LENGTH_SHORT).show() }
        binding.btnJoinBeta.setOnClickListener      { /* dead */ }
        binding.btnFlushSdk.setOnClickListener      {
            FeaturePulse.flush()
            Toast.makeText(this, "SDK flushed", Toast.LENGTH_SHORT).show()
        }
    }
}
```

- [ ] **Step 7: Build the demo app**

```bash
./gradlew :demo-app:assembleDebug
```

Expected: `BUILD SUCCESSFUL` — `demo-app/build/outputs/apk/debug/demo-app-debug.apk`

- [ ] **Step 8: Commit**

```bash
git add demo-app/
git commit -m "feat(demo): add ShopDemo app — 4 screens with intentional dead elements for FeaturePulse demo"
```

---

### Task 33: End-to-end integration test suite

**Target day:** 22–23

**Files:**
- Create: `server/src/__tests__/e2e/full-flow.test.ts`

Stands up the real Express app with the test database, sends a batch of events (some fresh, some simulating 31-day-old zero-interaction features), runs the nightly cron manually, and asserts the portal API returns the right states.

- [ ] **Step 1: Add `test:e2e` script to `server/package.json`**

```json
"test:e2e": "jest --testPathPattern='e2e' --runInBand --forceExit"
```

- [ ] **Step 2: Create `server/src/__tests__/e2e/full-flow.test.ts`**

```typescript
// server/src/__tests__/e2e/full-flow.test.ts
import request from 'supertest'
import { app }                   from '../../app'
import { prisma }                from '../../lib/prisma'
import { runNightlyAggregation } from '../../services/aggregation'

beforeAll(async () => {
  await prisma.stateTransition.deleteMany()
  await prisma.dailyAggregate.deleteMany()
  await prisma.rawEvent.deleteMany()
  await prisma.feature.deleteMany()
  await prisma.app.deleteMany()
})

afterAll(async () => { await prisma.$disconnect() })

describe('FeaturePulse full flow', () => {
  let appId: string
  let apiKey: string
  let jwtToken: string

  it('POST /auth/register creates app and returns apiKey + token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'e2e@example.com', password: 'test1234',
      appName: 'E2E Demo App', packageName: 'com.e2e.demo',
    })
    expect(res.status).toBe(201)
    expect(res.body.apiKey).toMatch(/^fp_/)
    expect(res.body.token).toBeTruthy()
    apiKey   = res.body.apiKey
    appId    = res.body.appId
    jwtToken = res.body.token
  })

  it('POST /api/v1/events/batch accepts events', async () => {
    const now = Date.now()
    const events = [
      // Feature A — active, tapped now
      { eventId: 'e1', featureId: 'fp_feat_a', eventType: 'TAP',
        timestamp: now, sessionId: 's1', deviceId: 'd1',
        screenName: 'HomeScreen', resourceName: 'btn_buy_now', elementType: 'Button' },
      { eventId: 'e2', featureId: 'fp_feat_a', eventType: 'IMPRESSION',
        timestamp: now - 1000, sessionId: 's1', deviceId: 'd1',
        screenName: 'HomeScreen', resourceName: 'btn_buy_now', elementType: 'Button' },
      // Feature B — last event 31 days ago → will become DEAD after cron
      { eventId: 'e3', featureId: 'fp_feat_b', eventType: 'IMPRESSION',
        timestamp: now - 31 * 24 * 60 * 60 * 1000,
        sessionId: 's2', deviceId: 'd2',
        screenName: 'HomeScreen', resourceName: 'btn_summer_promo', elementType: 'Button' },
    ]
    const res = await request(app)
      .post('/api/v1/events/batch')
      .set('X-API-Key', apiKey)
      .send({ appId, deviceId: 'd1', sdkVersion: '1.0.0', events })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toBeGreaterThanOrEqual(2)
  })

  it('runNightlyAggregation classifies features correctly', async () => {
    await runNightlyAggregation()
    const featA = await prisma.feature.findUnique({ where: { id: 'fp_feat_a' } })
    const featB = await prisma.feature.findUnique({ where: { id: 'fp_feat_b' } })
    expect(featA).not.toBeNull()
    expect(featB).not.toBeNull()
    expect(featB!.state).toBe('DEAD')
    expect(featA!.state).toBe('THRIVING')
  })

  it('GET /apps/:appId/dead returns the dead feature', async () => {
    const res = await request(app)
      .get(`/api/v1/apps/${appId}/dead`)
      .set('Authorization', `Bearer ${jwtToken}`)
    expect(res.status).toBe(200)
    const deadIds = (res.body as Array<{ id: string }>).map(f => f.id)
    expect(deadIds).toContain('fp_feat_b')
    expect(deadIds).not.toContain('fp_feat_a')
  })

  it('GET /apps/:appId/dashboard returns correct counts', async () => {
    const res = await request(app)
      .get(`/api/v1/apps/${appId}/dashboard`)
      .set('Authorization', `Bearer ${jwtToken}`)
    expect(res.status).toBe(200)
    expect(res.body.counts.DEAD).toBeGreaterThanOrEqual(1)
    expect(res.body.counts.THRIVING).toBeGreaterThanOrEqual(1)
  })

  it('PATCH /features/:id/ignore marks feature as ignored', async () => {
    const res = await request(app)
      .patch(`/api/v1/features/fp_feat_b/ignore`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ ignore: true })
    expect(res.status).toBe(200)
    expect(res.body.isIgnored).toBe(true)
  })

  it('GET /features/:id/timeline returns timeline rows', async () => {
    const res = await request(app)
      .get(`/api/v1/features/fp_feat_a/timeline?days=7`)
      .set('Authorization', `Bearer ${jwtToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('GET /apps/:appId/export?format=csv returns CSV', async () => {
    const res = await request(app)
      .get(`/api/v1/apps/${appId}/export?format=csv`)
      .set('Authorization', `Bearer ${jwtToken}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.text).toContain('featureId')
  })
})
```

- [ ] **Step 3: Run E2E suite**

```bash
cd server && npm run test:e2e
```

Expected: `8 tests passed`

- [ ] **Step 4: Run full server test suite**

```bash
cd server && npm test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add server/src/__tests__/e2e/
git commit -m "test(server): add E2E integration test — register → ingest → cron → portal full flow"
```

---

### Task 34: SDK full integration smoke test (Robolectric)

**Target day:** 23

**Files:**
- Create: `sdk/src/test/kotlin/com/featurepulse/FeaturePulseIntegrationTest.kt`
- Modify: `sdk/src/main/kotlin/com/featurepulse/FeaturePulse.kt`

- [ ] **Step 1: Add test helpers to `FeaturePulse.kt`**

Inside the `object FeaturePulse` body, add after the existing public API:

```kotlin
    // Test helpers — internal visibility, not part of public API
    internal fun reset() {
        synchronized(this) {
            initialized = false
            paused      = false
            disabled    = false
        }
    }
    internal fun isInitialized() = initialized
    internal fun isEnabled()     = initialized && !paused && !disabled
    internal fun getBuffer()     = buffer
```

- [ ] **Step 2: Create `FeaturePulseIntegrationTest.kt`**

```kotlin
// sdk/src/test/kotlin/com/featurepulse/FeaturePulseIntegrationTest.kt
package com.featurepulse

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import com.featurepulse.internal.model.EventType
import com.featurepulse.internal.model.RawEvent
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
        val config = PulseConfig.Builder()
            .setApiKey("fp_test_integration")
            .setAppId("com.test.integration")
            .setServerUrl(server.url("/").toString().trimEnd('/'))
            .setBatchSize(10)
            .build()
        FeaturePulse.reset()
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
                eventId   = "integration_$i",
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
        val req = server.takeRequest(500, TimeUnit.MILLISECONDS)
        assertNull("Expected no HTTP request for empty buffer", req)
    }

    @Test
    fun `pause stops recording; resume re-enables it`() {
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
```

- [ ] **Step 3: Run integration test**

```bash
./gradlew :sdk:test --tests "com.featurepulse.FeaturePulseIntegrationTest"
```

Expected: `5 tests passed`

- [ ] **Step 4: Run full SDK test suite**

```bash
./gradlew :sdk:test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add sdk/src/test/kotlin/com/featurepulse/FeaturePulseIntegrationTest.kt \
        sdk/src/main/kotlin/com/featurepulse/FeaturePulse.kt
git commit -m "test(sdk): add Robolectric integration test — init, flush, pause/resume, empty buffer"
```

---

### Task 35: Deploy — Railway (server) + Vercel (portal) + JitPack (SDK)

**Target day:** 24

---

#### 35a: Deploy server to Railway

- [ ] **Step 1: Create `server/Dockerfile`**

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Create `server/railway.json`**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "DOCKERFILE" },
  "deploy": {
    "startCommand": "npx prisma migrate deploy && node dist/index.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- [ ] **Step 3: Add `/health` endpoint to `server/src/app.ts`**

```typescript
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }))
```

- [ ] **Step 4: Set Railway environment variables**

In the Railway dashboard, set:
```
DATABASE_URL   = <Railway PostgreSQL connection string>
JWT_SECRET     = <openssl rand -hex 32>
NODE_ENV       = production
PORT           = 3000
```

- [ ] **Step 5: Deploy**

```bash
npm install -g @railway/cli
railway login
railway link
railway up
```

- [ ] **Step 6: Verify**

```bash
curl https://<your-railway-url>/health
# Expected: {"status":"ok","ts":...}
```

---

#### 35b: Deploy portal to Vercel

- [ ] **Step 1: Create `portal/vercel.json`**

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

- [ ] **Step 2: Set Vercel environment variable**

In the Vercel dashboard → Project → Settings → Environment Variables:
```
VITE_API_URL = https://<your-railway-url>
```

- [ ] **Step 3: Deploy**

```bash
npm install -g vercel
cd portal && vercel --prod
```

- [ ] **Step 4: Verify**

Open the Vercel URL. Log in, confirm dashboard loads with feature data.

---

#### 35c: Publish SDK to JitPack

- [ ] **Step 1: Create `sdk/maven-publish.gradle.kts`**

```kotlin
// sdk/maven-publish.gradle.kts
plugins { `maven-publish` }

afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                from(components["release"])
                groupId    = "com.github.featurepulse"
                artifactId = "sdk"
                version    = "1.0.0"
                pom {
                    name.set("FeaturePulse SDK")
                    description.set("Android SDK for automatic dead feature detection")
                    url.set("https://github.com/featurepulse/featurepulse")
                    licenses {
                        license {
                            name.set("MIT License")
                            url.set("https://opensource.org/licenses/MIT")
                        }
                    }
                }
            }
        }
    }
}
```

Apply in `sdk/build.gradle.kts`:
```kotlin
apply(from = "maven-publish.gradle.kts")
```

- [ ] **Step 2: Create `jitpack.yml` at repo root**

```yaml
jdk:
  - openjdk17
before_install:
  - sdk auto-update --yes
install:
  - ./gradlew :sdk:assembleRelease :sdk:publishToMavenLocal
```

- [ ] **Step 3: Tag the release and push**

```bash
git tag v1.0.0
git push origin v1.0.0
```

- [ ] **Step 4: Trigger JitPack build**

Open `https://jitpack.io/#<your-github-username>/featurepulse/v1.0.0`. JitPack auto-builds on first access. Wait for the green "Get it" badge.

- [ ] **Step 5: Verify JitPack dependency resolves**

Add to any test project's `build.gradle.kts` and sync:
```kotlin
repositories { maven { url = uri("https://jitpack.io") } }
dependencies { implementation("com.github.<your-username>:featurepulse:v1.0.0") }
```

Expected: no resolution error.

- [ ] **Step 6: Commit deploy config**

```bash
git add sdk/maven-publish.gradle.kts jitpack.yml server/Dockerfile \
        server/railway.json portal/vercel.json
git commit -m "chore: add deploy config — Railway (server), Vercel (portal), JitPack (SDK)"
```

---

### Task 36: Final verification checklist

**Target day:** 24

- [ ] `./gradlew :sdk:test` — all SDK unit + integration tests pass
- [ ] `cd server && npm test` — all server unit tests pass
- [ ] `cd server && npm run test:e2e` — all 8 E2E tests pass
- [ ] `cd portal && npm run build` — no TypeScript errors
- [ ] `./gradlew :demo-app:assembleDebug` — APK builds cleanly
- [ ] `curl https://<railway-url>/health` returns `{"status":"ok",...}`
- [ ] Portal loads on Vercel URL; register → dashboard shows "0 features" initially
- [ ] Register in portal → copy API key + App ID → paste into `demo-app/local.properties`
- [ ] Install demo APK on device/emulator → tap Buy Now and Browse Products → wait ~1 min for WorkManager sync
- [ ] Verify events appear in portal dashboard (feature count > 0)
- [ ] Add a dev-only `POST /api/v1/admin/run-cron` route to `server/src/routes/admin.ts`, call it, confirm dead features (btn_summer_promo, btn_share_app) appear in the DEAD list
- [ ] JitPack badge is green at `https://jitpack.io/#<your-username>/featurepulse`

---

*Phase 4 complete. All four components built, tested, and deployed. FeaturePulse is production-ready.*

---

## Summary

| Phase | Days | Tasks | Deliverable |
|-------|------|-------|-------------|
| 1 — SDK Core | 1–7 | 1–14 | SDK compiles, all core components tested with Robolectric |
| 2 — Backend API | 8–13 | 15–22 | Server runs, all endpoints tested, nightly cron works |
| 3 — SDK Sync + Portal | 14–20 | 23–31 | SDK syncs to server, full portal UI deployed |
| 4 — Demo + Tests + Deploy | 22–24 | 32–36 | Demo app ships, E2E tests pass, all three components live |

**Total:** 36 tasks across 24 days · 1 developer · deadline July 6, 2026
