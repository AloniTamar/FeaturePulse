# FeaturePulse — Dead Feature Detector SDK

> Automatically detect unused UI elements in Android apps. Zero instrumentation. One line of code.

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [How It Works (Step by Step)](#how-it-works)
4. [Architecture](#architecture)
5. [SDK (Android Library)](#sdk-android-library)
6. [Backend Server (API)](#backend-server-api)
7. [Web Portal](#web-portal)
8. [Data Models](#data-models)
9. [API Endpoints](#api-endpoints)
10. [Detection & Classification Algorithm](#detection--classification-algorithm)
11. [Design Patterns Used](#design-patterns-used)
12. [Technical Research](#technical-research)
13. [Coverage Strategy](#coverage-strategy)
14. [Data Efficiency & Storage](#data-efficiency--storage)
15. [Pricing Model](#pricing-model)
16. [Target Apps](#target-apps)
17. [Development Plan](#development-plan)
18. [Future Work](#future-work)
19. [Security & Privacy](#security--privacy)
20. [SDK Integration Guide](#sdk-integration-guide)
21. [Error Handling & Resilience](#error-handling--resilience)
22. [Session Management](#session-management)
23. [Impression Tracking Details](#impression-tracking-details)
24. [Performance Overhead](#performance-overhead)
25. [Comparison vs. Alternatives](#comparison-vs-alternatives)
26. [Edge Cases](#edge-cases)
27. [Testing Strategy](#testing-strategy)
28. [Demo App Specification](#demo-app-specification)
29. [Deployment Guide](#deployment-guide)
30. [Remote Config Details](#remote-config-details)
31. [Versioning & Backward Compatibility](#versioning--backward-compatibility)
32. [File Structure (Project)](#file-structure-project)

---

## Overview

**FeaturePulse** is an Android SDK that automatically discovers all interactive UI elements in an app, tracks user interactions (or lack thereof), and classifies each element's "health" over time. Features that no user touches are flagged as **DEAD** — giving developers a clear "kill list" to simplify their app.

**Three components:**
- **Android SDK** (Kotlin library) — lives inside the developer's app
- **Backend API** (Node.js/Express + PostgreSQL) — receives data, classifies, serves portal
- **Web Portal** (React) — dashboard for developers to view reports

---

## Problem Statement

- Apps accumulate features over months/years — some become unused
- Developers have **no visibility** into which UI elements are never touched
- Traditional analytics (Firebase, Mixpanel) require **manual tagging** per element — nobody does this for ALL elements
- Dead features → bloated APK, confusing UX, wasted maintenance
- **No existing tool solves this automatically**

---

## How It Works

### Step 1: Initialization (One Line)

```kotlin
// Developer adds this in their Application class:
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FeaturePulse.init(this)
    }
}
```

Under the hood:
- Calls `app.registerActivityLifecycleCallbacks(...)` — Android OS-level API
- From this moment, the SDK is notified every time ANY Activity opens/closes
- Also registers `FragmentLifecycleCallbacks` for Fragment tracking
- This is the same mechanism Firebase/Mixpanel use — official, stable since API 14

### Step 2: Auto-Discovery (View Tree Scanning)

When an Activity/Fragment appears on screen:

```
Activity.onResumed()
    │
    ▼
SDK gets: activity.window.decorView (= root of entire UI tree)
    │
    ▼
Recursive traversal of ViewGroup children:
    │
    ├── LinearLayout
    │   ├── Button ("btn_share")        ← INTERACTIVE → track it
    │   ├── TextView ("txt_title")      ← NOT interactive → skip
    │   └── ImageButton ("btn_menu")    ← INTERACTIVE → track it
    │
    ├── RecyclerView
    │   └── (ViewHolders)               ← scan each as it binds
    │
    └── FrameLayout
        └── FloatingActionButton        ← INTERACTIVE → track it
```

**How we identify "interactive" elements:**
- `view.isClickable == true`
- `view.hasOnClickListeners() == true`
- View is instance of: `Button`, `ImageButton`, `Switch`, `CheckBox`, `ToggleButton`, `Tab`, `MenuItem`, `FAB`
- Has `onTouchListener` set

**How we identify WHICH element it is (fingerprinting):**
```
fingerprint = hash(
    screenName,           // "MainActivity" or "ProfileFragment"
    resourceName,         // "btn_share" (from view.id → resources.getResourceEntryName())
    viewClass,            // "MaterialButton"
    hierarchyPath         // "LinearLayout[0]/ConstraintLayout[1]/Button[0]"
)
```

### Step 3: Interaction Tracking (Touch Interception)

We wrap the Activity's `Window.Callback` to intercept ALL touch events:

```kotlin
val originalCallback = activity.window.callback
activity.window.callback = PulseWindowCallback(originalCallback) // Proxy pattern

class PulseWindowCallback(private val original: Window.Callback) : Window.Callback by original {
    override fun dispatchTouchEvent(event: MotionEvent): Boolean {
        if (event.action == MotionEvent.ACTION_UP) {
            // Find which View was touched using hit-testing
            val touchedView = findViewAt(rootView, event.x, event.y)
            if (touchedView != null && isTracked(touchedView)) {
                recordInteraction(touchedView, eventType = TAP)
            }
        }
        return original.dispatchTouchEvent(event) // don't break anything
    }
}
```

**Event types tracked:**
- `TAP` — single click/tap
- `LONG_PRESS` — held for 500ms+
- `SWIPE` — directional gesture on the element
- `IMPRESSION` — element was visible on screen (tracked via `getGlobalVisibleRect()`)

### Step 4: Buffering & Batching

Events are NOT sent immediately. They're buffered locally:

```
┌─────────────────────────────────────────────┐
│  In-Memory Circular Buffer (max 500 events) │
│                                             │
│  Event → Event → Event → Event → ...       │
│                                             │
│  Flush triggers:                            │
│  • Buffer full (500 events)                 │
│  • Timer fires (every 30 minutes)           │
│  • App goes to background                   │
│  • WorkManager periodic sync                │
└─────────────────────────────────────────────┘
         │
         ▼ (single HTTP batch request)
    POST /api/events/batch
    Body: { events: [...500 events...] }
```

**Battery safety:**
- Uses WorkManager for guaranteed delivery even if app is killed
- Respects `ConnectivityManager` — only syncs on WiFi if configured
- Persists buffer to SharedPreferences on `onTrimMemory()` / app kill

### Step 5: Server Classification (Nightly Cron)

Server runs a nightly job (2:00 AM) that:

```
For each feature (element) in the app:
    1. Count interactions in last 7 days
    2. Count impressions in last 7 days
    3. Calculate interaction_rate = interactions / impressions
    4. Compare to previous periods
    5. Classify state:
       
       THRIVING  → interaction_rate > 5% AND stable/growing
       DECLINING → interaction_rate dropping >20% week-over-week
       DORMANT   → interaction_rate < 1% for 14+ days
       DEAD      → 0 interactions across ALL users for 30+ days
```

### Step 6: Developer Views Report

Developer opens portal → sees:

```
╔══════════════════════════════════════════════════════════╗
║  MyApp — Feature Health                                 ║
║                                                         ║
║  342 Total Features  │  12 Dead  │  28 Declining        ║
║                                                         ║
║  Element          Screen              State    Last Use ║
║  ─────────────────────────────────────────────────────  ║
║  btn_share        ProfileFragment     DEAD     45d ago  ║
║  menu_export      MainActivity        DECLINING 12d ago ║
║  tab_explore      HomeActivity        THRIVING  today   ║
║  btn_dark_mode    SettingsActivity     DORMANT  33d ago  ║
╚══════════════════════════════════════════════════════════╝
```

---

## Architecture

```
┌──────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│   Android SDK    │  batch  │    API Server         │  r/w    │   PostgreSQL    │
│                  │ events  │                       │         │                 │
│  ViewTree Crawler├────────►│  Node.js / Express    ├────────►│  RawEvents      │
│  Fingerprinter   │         │                       │         │  Features       │
│  Event Buffer    │◄────────┤  Authentication       │         │  DailyAggregates│
│  Sync Worker     │  config │  Rate Limiting        │         │  Apps           │
│  Visibility Track│         │  Validation           │         │                 │
│  Lifecycle Hooks │         │  REST Endpoints       │         └────────┬────────┘
└──────────────────┘         │  Batch Processing     │                  │
                             └──────────┬───────────┘                  │
                                        │                              │
                             ┌──────────┴───────────┐         ┌───────┴────────┐
                             │    Web Portal         │         │  Cron Worker   │
                             │                       │         │                │
                             │  React Dashboard      │         │  Nightly agg   │
                             │  Feature list         │         │  State classify│
                             │  Trends/charts        │         │  State classify│
                             │  Settings             │         └────────────────┘
                             └───────────────────────┘
```

---

## SDK (Android Library)

### Exposed API (Developer-Facing)

```kotlin
// === Initialization ===
FeaturePulse.init(application: Application)
FeaturePulse.init(application: Application, config: PulseConfig)

// === Configuration ===
PulseConfig.Builder()
    .setApiKey("fp_xxxxx")
    .setAppId("com.example.myapp")
    .setBatchSize(500)                    // events per batch (default: 500)
    .setSyncInterval(30, TimeUnit.MINUTES) // sync frequency (default: 30min)
    .setSyncOnWifiOnly(false)             // default: false
    .setExcludedScreens(listOf("SplashActivity"))
    .setMinImpressionDuration(1000)       // ms visible to count as impression
    .setEnabled(true)                     // kill switch
    .build()

// === Manual Controls ===
FeaturePulse.pause()                      // stop tracking temporarily
FeaturePulse.resume()                     // resume tracking
FeaturePulse.flush()                      // force-send buffered events now
FeaturePulse.disable()                    // opt-out completely (GDPR)

// === Exclusions ===
FeaturePulse.ignore(viewId: Int)          // ignore specific view by R.id
FeaturePulse.ignoreScreen(name: String)   // ignore entire screen

// === Callbacks (optional) ===
FeaturePulse.setOnSyncListener { result ->
    // called after each batch sync (success/failure)
}

// === Debug ===
FeaturePulse.setDebugMode(true)           // verbose logging
FeaturePulse.getDiscoveredFeatures(): List<FeatureInfo>  // for debugging
```

### Internal Functions (Not exposed to developer)

```kotlin
// --- Lifecycle Management ---
internal fun registerLifecycleCallbacks(app: Application)
internal fun onActivityResumed(activity: Activity)
internal fun onActivityPaused(activity: Activity)
internal fun onFragmentResumed(fragment: Fragment)

// --- View Tree Scanning ---
internal fun scanViewTree(rootView: View): List<DiscoveredElement>
internal fun isInteractiveView(view: View): Boolean
internal fun traverseViewGroup(viewGroup: ViewGroup, depth: Int)
internal fun handleRecyclerView(rv: RecyclerView)

// --- Fingerprinting ---
internal fun generateFingerprint(view: View, screen: String): String
internal fun getResourceName(view: View): String?
internal fun getHierarchyPath(view: View): String
internal fun computeHash(components: List<String>): String

// --- Event Recording ---
internal fun recordInteraction(view: View, type: EventType)
internal fun recordImpression(view: View, durationMs: Long)
internal fun createEvent(featureId: String, type: EventType): RawEvent

// --- Touch Interception ---
internal fun wrapWindowCallback(activity: Activity)
internal fun findViewAtCoordinates(root: View, x: Float, y: Float): View?

// --- Visibility Tracking ---
internal fun startVisibilityTracking(activity: Activity)
internal fun checkVisibleElements(): List<VisibleElement>
internal fun isViewVisibleOnScreen(view: View): Boolean

// --- Buffering & Sync ---
internal fun addToBuffer(event: RawEvent)
internal fun shouldFlush(): Boolean
internal fun flushBuffer()
internal fun persistBufferToDisk()
internal fun restoreBufferFromDisk()

// --- Network ---
internal fun sendBatch(events: List<RawEvent>): Result
internal fun fetchConfig(): RemoteConfig
internal fun handleSyncFailure(error: Throwable)

// --- Storage ---
internal fun saveToSharedPreferences(key: String, data: String)
internal fun getFromSharedPreferences(key: String): String?
```

---

## Backend Server (API)

### Tech Stack
- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Database:** PostgreSQL 15
- **ORM:** Prisma or raw SQL with pg
- **Auth:** API key-based (X-API-Key header)
- **Job scheduler:** node-cron (nightly aggregation)
- **Rate limiting:** express-rate-limit
- **Validation:** Zod schemas

### Server Functions

```javascript
// === Event Ingestion ===
async function ingestBatch(appId, events[])      // validate & insert raw events
async function validateEvent(event)               // schema validation
async function deduplicateEvents(events[])        // prevent duplicate inserts
async function upsertFeature(featureData)         // create/update feature record

// === Aggregation (Cron) ===
async function runNightlyAggregation()            // main cron job
async function aggregateDay(appId, date)          // compute daily stats per feature
async function computeInteractionRate(featureId, date)
async function classifyFeatureState(featureId)    // apply classification rules
async function updateFeatureState(featureId, newState)
async function cleanExpiredRawEvents()            // delete events older than 7 days

// === Classification Logic ===
function calculateDecayRate(weeklyRates[])        // week-over-week change
function determineState(interactionRate, decayRate, daysSinceLastUse)
function shouldTriggerAlert(oldState, newState)   // state transition alert

// === Portal API ===
async function getFeatureList(appId, filters)     // paginated feature list
async function getFeatureTimeline(featureId)      // daily stats over time
async function getDeadFeatures(appId)             // just the dead ones
async function getDashboardStats(appId)           // summary cards
async function getAppOverview(appId)              // general app info

// === Management ===
async function createApp(name, apiKey)            // register new app
async function rotateApiKey(appId)                // security
async function setIgnoreFlag(featureId, ignore)   // mark as expected-low-use
async function configureAlerts(appId, config)     // alert rules settings
```

---

## Web Portal

### Pages & Functions

```
Portal Structure:
├── Login / Register
├── Dashboard (per app)
│   ├── Summary cards (total features, dead, declining, thriving)
│   ├── Feature health distribution chart
│   └── Recent state changes feed
├── Features List
│   ├── Table: element, screen, state, last used, interaction rate
│   ├── Filters: by state, by screen, by date range
│   ├── Sort: by last used, by interaction rate, by name
│   └── Bulk actions: ignore, export
├── Feature Detail
│   ├── Interaction timeline chart (daily)
│   ├── State history (when it transitioned)
│   ├── Screen context (which screen it belongs to)
│   └── Ignore toggle
├── Reports
│   ├── Dead features report (exportable CSV/JSON)
│   ├── Weekly digest (state changes this week)
│   └── Decay watchlist (features trending toward dead)
├── Alerts
│   └── Alert rules (notify on: new dead, new declining, etc.)
├── Settings
│   ├── API key management
│   ├── App configuration
│   ├── Data retention settings
│   └── Team members
└── Apps Switcher (multi-app support)
```

### Portal Functions (Frontend)

```javascript
// === Dashboard ===
function renderDashboard(appId)
function renderSummaryCards(stats)
function renderHealthDistributionChart(data)
function renderRecentChanges(changes)

// === Feature List ===
function renderFeatureTable(features, pagination)
function filterFeatures(state, screen, dateRange)
function sortFeatures(column, direction)
function exportFeatures(format: 'csv' | 'json')

// === Feature Detail ===
function renderFeatureTimeline(featureId)
function renderStateHistory(featureId)
function toggleIgnoreFeature(featureId)

// === Alerts ===
function setAlertRules(appId, rules)

// === Auth ===
function login(email, password)
function register(email, password, appName)
function refreshToken()
```

---

## Data Models

### PostgreSQL Schema

```sql
-- Apps table
CREATE TABLE apps (
    app_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    package_name VARCHAR(255) NOT NULL,
    api_key     VARCHAR(64) NOT NULL UNIQUE,
    owner_email VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW(),
    config      JSONB DEFAULT '{}'
);

-- Features table (~100-500 rows per app)
CREATE TABLE features (
    feature_id      VARCHAR(64) PRIMARY KEY,  -- fingerprint hash
    app_id          UUID NOT NULL REFERENCES apps(app_id),
    element_type    VARCHAR(50) NOT NULL,      -- "Button", "ImageButton", "Switch"
    resource_name   VARCHAR(255),             -- "btn_share" (nullable - some views have no ID)
    screen_name     VARCHAR(255) NOT NULL,    -- "MainActivity" or "ProfileFragment"
    hierarchy_path  TEXT,                     -- "LinearLayout[0]/Button[2]"
    first_seen      TIMESTAMP NOT NULL DEFAULT NOW(),
    last_interaction TIMESTAMP,
    state           VARCHAR(20) NOT NULL DEFAULT 'THRIVING',
                    -- THRIVING | DECLINING | DORMANT | DEAD
    is_ignored      BOOLEAN DEFAULT FALSE,
    metadata        JSONB DEFAULT '{}',
    
    INDEX idx_features_app_state (app_id, state),
    INDEX idx_features_app_screen (app_id, screen_name)
);

-- Raw events (append-only, 7-day TTL)
CREATE TABLE raw_events (
    event_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_id  VARCHAR(64) NOT NULL,
    app_id      UUID NOT NULL,
    event_type  VARCHAR(20) NOT NULL,  -- TAP | LONG_PRESS | SWIPE | IMPRESSION
    timestamp   TIMESTAMP NOT NULL,
    session_id  VARCHAR(64),
    device_id   VARCHAR(64),           -- anonymous device hash
    
    INDEX idx_events_feature_time (feature_id, timestamp),
    INDEX idx_events_app_time (app_id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Auto-delete events older than 7 days (pg_cron or application-level)
-- CREATE POLICY / TTL handled by nightly cleanup job

-- Daily aggregates (pre-computed, partitioned by month)
CREATE TABLE daily_aggregates (
    feature_id      VARCHAR(64) NOT NULL,
    date            DATE NOT NULL,
    impressions     INTEGER DEFAULT 0,
    interactions    INTEGER DEFAULT 0,
    unique_users    INTEGER DEFAULT 0,
    interaction_rate FLOAT DEFAULT 0.0,
    
    PRIMARY KEY (feature_id, date),
    INDEX idx_agg_date (date),
    INDEX idx_agg_feature (feature_id)
) PARTITION BY RANGE (date);

-- State history (audit trail)
CREATE TABLE state_transitions (
    id          SERIAL PRIMARY KEY,
    feature_id  VARCHAR(64) NOT NULL,
    old_state   VARCHAR(20),
    new_state   VARCHAR(20) NOT NULL,
    changed_at  TIMESTAMP DEFAULT NOW(),
    reason      TEXT  -- "0 interactions for 30 days"
);
```

### SDK-Side Models (Kotlin)

```kotlin
data class DiscoveredElement(
    val featureId: String,          // fingerprint hash
    val viewClass: String,          // "MaterialButton"
    val resourceName: String?,      // "btn_share" or null
    val screenName: String,         // "ProfileFragment"
    val hierarchyPath: String,      // "LinearLayout[0]/Button[2]"
    val isClickable: Boolean,
    val discoveredAt: Long          // timestamp
)

data class RawEvent(
    val eventId: String,            // UUID
    val featureId: String,
    val eventType: EventType,       // TAP, LONG_PRESS, SWIPE, IMPRESSION
    val timestamp: Long,
    val sessionId: String,
    val deviceId: String
)

enum class EventType {
    TAP, LONG_PRESS, SWIPE, IMPRESSION
}

data class PulseConfig(
    val apiKey: String,
    val appId: String,
    val batchSize: Int = 500,
    val syncIntervalMs: Long = 30 * 60 * 1000,  // 30 min
    val syncOnWifiOnly: Boolean = false,
    val excludedScreens: List<String> = emptyList(),
    val minImpressionDurationMs: Long = 1000,
    val enabled: Boolean = true
)

data class BatchPayload(
    val appId: String,
    val deviceId: String,
    val sdkVersion: String,
    val events: List<RawEvent>
)
```

---

## API Endpoints

### SDK → Server

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/events/batch` | Upload batch of events |
| GET | `/api/v1/config` | Fetch remote config (sync interval, enabled, etc.) |
| POST | `/api/v1/features/discover` | Report newly discovered features |

### Portal → Server

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/apps/:appId/dashboard` | Dashboard summary stats |
| GET | `/api/v1/apps/:appId/features` | List features (paginated, filterable) |
| GET | `/api/v1/apps/:appId/features/:featureId` | Feature detail + timeline |
| GET | `/api/v1/apps/:appId/features/:featureId/timeline` | Daily aggregates |
| GET | `/api/v1/apps/:appId/dead` | Dead features only |
| GET | `/api/v1/apps/:appId/declining` | Declining features |
| PATCH | `/api/v1/features/:featureId/ignore` | Toggle ignore flag |
| GET | `/api/v1/apps/:appId/export` | Export report (CSV/JSON) |
| POST | `/api/v1/apps` | Register new app |
| PUT | `/api/v1/apps/:appId/config` | Update app config |
| POST | `/api/v1/apps/:appId/alerts` | Configure alert rules |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/register` | Register |

### Request/Response Examples

**POST /api/v1/events/batch**
```json
// Request
{
  "appId": "com.example.myapp",
  "deviceId": "a1b2c3d4",
  "sdkVersion": "1.0.0",
  "events": [
    {
      "eventId": "uuid-1",
      "featureId": "hash_btn_share_profile",
      "eventType": "TAP",
      "timestamp": 1717500000000,
      "sessionId": "session_xyz"
    },
    {
      "eventId": "uuid-2",
      "featureId": "hash_fab_add",
      "eventType": "IMPRESSION",
      "timestamp": 1717500001000,
      "sessionId": "session_xyz"
    }
  ]
}

// Response
{
  "accepted": 2,
  "rejected": 0,
  "errors": []
}
```

**GET /api/v1/apps/:appId/features?state=DEAD&page=1&limit=20**
```json
{
  "data": [
    {
      "featureId": "hash_btn_share_profile",
      "elementType": "Button",
      "resourceName": "btn_share",
      "screenName": "ProfileFragment",
      "state": "DEAD",
      "lastInteraction": "2026-04-20T10:30:00Z",
      "daysSinceLastUse": 45,
      "interactionRate": 0.0,
      "firstSeen": "2025-12-01T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12
  }
}
```

---

## Detection & Classification Algorithm

### Fingerprinting Algorithm

```
Input: View object + screen context
Output: Stable 64-char hash

Components:
1. screenName = activity.javaClass.simpleName OR fragment.javaClass.simpleName
2. resourceName = view.resources.getResourceEntryName(view.id) OR null
3. viewClass = view.javaClass.simpleName (e.g., "MaterialButton")
4. hierarchyPath = walk up from view to root, recording index at each level
   Example: "DecorView/LinearLayout[0]/FrameLayout[1]/ConstraintLayout[0]/Button[2]"

If resourceName exists:
    fingerprint = SHA256(screenName + resourceName)
Else:
    fingerprint = SHA256(screenName + viewClass + hierarchyPath)

// Resource name is preferred because it survives layout changes.
// Hierarchy path is fallback for views without an ID.
```

### Classification Rules

```
┌─────────────────────────────────────────────────────────────────────┐
│  State Machine:                                                     │
│                                                                     │
│  THRIVING ──(rate drops >20% WoW)──► DECLINING                      │
│                                                                     │
│  DECLINING ──(rate < 1% for 14d)──► DORMANT                        │
│  DECLINING ──(rate recovers)──► THRIVING                            │
│                                                                     │
│  DORMANT ──(0 interactions for 30d)──► DEAD                         │
│  DORMANT ──(any interaction)──► DECLINING (recovery check)          │
│                                                                     │
│  DEAD ──(interaction detected)──► DORMANT (unexpected resurrection) │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

Thresholds (configurable per app):
- THRIVING: interaction_rate > 5% AND NOT declining
- DECLINING: interaction_rate drop > 20% week-over-week for 2+ weeks
- DORMANT: interaction_rate < 1% sustained for 14+ days
- DEAD: zero interactions across ALL users for 30+ days
```

### Nightly Aggregation Job

```
Runs at: 02:00 AM UTC daily

Steps:
1. For each app:
   a. Query raw_events from yesterday (24h window)
   b. GROUP BY feature_id:
      - COUNT(*) WHERE event_type != 'IMPRESSION' → interactions
      - COUNT(*) WHERE event_type == 'IMPRESSION' → impressions
      - COUNT(DISTINCT device_id) → unique_users
      - interactions / NULLIF(impressions, 0) → interaction_rate
   c. INSERT INTO daily_aggregates

2. For each feature with new data:
   a. Fetch last 14 daily_aggregates
   b. Calculate trend (linear regression or simple WoW comparison)
   c. Apply classification rules
   d. If state changed → UPDATE features SET state = new_state
   e. If state changed → INSERT INTO state_transitions
   f. If state changed to DEAD/DECLINING → record in state_transitions

3. Cleanup:
   a. DELETE FROM raw_events WHERE timestamp < NOW() - INTERVAL '7 days'
```

---

## Design Patterns Used

| Pattern | Where | Purpose |
|---------|-------|---------|
| **Singleton** | `FeaturePulse.getInstance()` | Single SDK entry point, one instance per app |
| **Builder** | `PulseConfig.Builder()` | Flexible configuration with sensible defaults |
| **Observer** | Lifecycle callbacks, ViewTreeObserver, sync callbacks | React to system events without coupling |
| **Strategy** | Classification algorithm | Pluggable rules for state detection (different algorithms possible) |
| **Proxy** | `PulseWindowCallback` wrapping `Window.Callback` | Intercept touches transparently without breaking existing behavior |
| **Repository** | `EventRepository` | Abstracts local buffer vs. remote sync — single interface for data |

---

## Technical Research

### Android APIs Used

| API | Purpose | Since |
|-----|---------|-------|
| `Application.registerActivityLifecycleCallbacks()` | Detect all Activity opens | API 14 |
| `FragmentManager.registerFragmentLifecycleCallbacks()` | Detect all Fragment opens | Support lib |
| `View.getId()` + `Resources.getResourceEntryName()` | Get resource name ("btn_share") | API 1 |
| `ViewTreeObserver.OnGlobalLayoutListener` | Detect when views are laid out/added | API 16 |
| `View.getGlobalVisibleRect()` | Check if view is actually visible on screen | API 1 |
| `Window.Callback` | Intercept all touch events | API 1 |
| `ViewGroup.getChildAt()` / `getChildCount()` | Traverse view tree recursively | API 1 |
| `WorkManager` | Battery-safe background sync | Jetpack |
| `SharedPreferences` | Persist event buffer on app kill | API 1 |
| `ConnectivityManager` | Check network state before sync | API 1 |
| `ActivityLifecycleCallbacks.onActivityResumed()` | Know when a screen is visible | API 14 |

### Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| RecyclerView items don't exist until scrolled | Observe `RecyclerView.Adapter` via `registerAdapterDataObserver()`, scan new ViewHolders on bind |
| Views without resource ID | Fallback to class + hierarchy path fingerprint |
| ProGuard/R8 obfuscation | Resource names survive in `resources.arsc` (not obfuscated). Class names in hierarchy path may change — but resource name is primary identifier |
| Battery drain from tracking | WorkManager + 30-min batching = 1 HTTP call per 30 min maximum |
| Threading / ANR risk | All scanning + fingerprinting on background thread via Coroutines |
| Memory pressure | Circular buffer with fixed max size (500 events), flush when full |
| App killed unexpectedly | Persist buffer to SharedPreferences on `onTrimMemory()` |
| Fragment inside Fragment (nested) | Recursive fragment callback registration |
| Same element appearing on multiple screens | Screen name is part of fingerprint → different feature IDs |
| ViewPager/Tabs (lazy loading) | Listen to `ViewPager.OnPageChangeListener`, scan each page on select |

---

## Coverage Strategy

| Layer | Coverage | Complexity |
|-------|----------|-----------|
| ViewTree scan (Activities) | ~90% | Low — required |
| + Fragment callbacks | ~93% | Low — easy add |
| + ViewTreeObserver (layout changes) | ~96% | Low — easy add |
| + Compose Semantics tree | ~98% | Medium — nice to have |
| + OnHierarchyChangeListener | ~99% | Medium — uses reflection |
| + Gradle plugin (compile-time) | 100% | High — future work |
| + Tap coordinate clustering (canvas) | ~99.5% | High — future work |

**For this project:** Implement first 3 layers (~96% coverage). Mention rest as future work.

---

## Data Efficiency & Storage

### Why This Design Is Efficient

**Raw Events (7-day TTL):**
- Append-only writes (fastest possible)
- Never queried by portal users directly
- Auto-deleted after 7 days → no unbounded growth
- Only used by nightly aggregation job

**Daily Aggregates (pre-computed):**
- Portal reads are instant (no expensive COUNT queries)
- ~500 features × 365 days = 182,000 rows/year per app → trivial for PostgreSQL
- Partitioned by month for fast range queries

**Features table:**
- ~100-500 rows per app (tiny)
- Indexed on (app_id, state) → instant lookups for "show me all DEAD features"

### Without Batching vs. With Batching

| Metric | Without Batching | With Batching |
|--------|-----------------|---------------|
| HTTP calls / 30 min | ~1000 (per event) | 1 |
| Battery impact | High | Minimal |
| Network usage | High (header overhead per request) | Low (one payload) |
| Server load | 1000 req/30min/user | 1 req/30min/user |

### Query Performance

```sql
-- "Show me dead features" → index scan, <5ms
SELECT * FROM features WHERE app_id = ? AND state = 'DEAD';

-- "Feature timeline last 30 days" → partition scan, <10ms
SELECT * FROM daily_aggregates 
WHERE feature_id = ? AND date >= CURRENT_DATE - 30
ORDER BY date;

-- "Dashboard stats" → index scan + count, <5ms
SELECT state, COUNT(*) FROM features WHERE app_id = ? GROUP BY state;
```

---

## Pricing Model

| Tier | Price | Features Tracked | Events/month | Retention |
|------|-------|-----------------|--------------|-----------|
| **Free** | $0 | Up to 50 | 10K | 7 days aggregates |
| **Pro** | $29/mo | Up to 500 | 500K | 90 days aggregates |
| **Team** | $79/mo | Unlimited | 5M | 1 year aggregates |
| **Enterprise** | Custom | Unlimited | Unlimited | Custom + SLA |

**Additional:**
- In-portal alert rules: included in Pro+
- CSV export: included in Pro+
- Multi-app support: included in Team+
- SSO / SAML: Enterprise only

---

## Target Apps

| Category | Why They Need FeaturePulse | Example |
|----------|---------------------------|---------|
| E-Commerce | Dozens of filters, buttons, tabs accumulate unused | SHEIN, AliExpress |
| Social Media | Features ship fast — some flop silently | Any social app |
| Banking / Fintech | Regulatory pressure to simplify UI | Bank apps |
| Enterprise / SaaS | Feature bloat is the #1 UX problem | CRM tools |
| News / Content | Tabs, categories, share options — which are dead? | News apps |
| Health & Fitness | Many tracking features, users only use some | Workout apps |
| Any app with 20+ screens | The more features exist, the more will die | — |

---

## Development Plan

### Phase 1: Core SDK (Weeks 1-3)

```
Week 1:
├── Project setup (Kotlin library module, Gradle config)
├── FeaturePulse singleton + PulseConfig Builder
├── ActivityLifecycleCallbacks registration
├── Basic ViewTree traversal (find clickable views)
└── Fingerprinting algorithm (hash generation)

Week 2:
├── Window.Callback proxy (touch interception)
├── Event recording (create RawEvent objects)
├── In-memory circular buffer
├── Impression tracking (visibility detection)
└── Fragment lifecycle support

Week 3:
├── WorkManager integration (periodic sync)
├── SharedPreferences persistence (buffer on kill)
├── HTTP client (Retrofit/OkHttp) for batch upload
├── Offline queue + retry logic
└── SDK configuration (exclude screens, wifi-only, etc.)
```

### Phase 2: Backend (Weeks 3-5)

```
Week 3-4:
├── Express.js project setup
├── PostgreSQL schema + migrations
├── POST /events/batch endpoint (ingestion)
├── API key authentication middleware
├── Rate limiting + request validation (Zod)
├── App registration endpoint
└── Basic health check

Week 4-5:
├── Nightly cron job (node-cron)
├── Daily aggregation logic
├── Classification algorithm implementation
├── State transition logic + history logging
├── GET /features endpoints (list, detail, timeline)
├── GET /dashboard endpoint
└── State transition logging
```

### Phase 3: Portal (Weeks 5-7)

```
Week 5-6:
├── React project setup (Vite + TypeScript)
├── Auth pages (login/register)
├── Dashboard page (summary cards, charts)
├── Features list page (table + filters)
├── Feature detail page (timeline chart)
└── Navigation + layout

Week 6-7:
├── Alerts configuration page
├── Settings page (API key, config)
├── Export functionality (CSV/JSON)
├── Multi-app switcher
├── Responsive design polish
└── Error handling + loading states
```

### Phase 4: Integration & Polish (Weeks 7-8)

```
Week 7-8:
├── End-to-end testing (SDK → Server → Portal)
├── Sample demo app (with intentionally dead features)
├── Documentation (README, API docs, integration guide)
├── Publish SDK to JitPack/Maven Central
├── Deploy server (Railway/Render/Heroku)
├── Deploy portal (Vercel/Netlify)
└── Presentation preparation
```

---

## Future Work

- **Jetpack Compose support** — scan Semantics tree instead of View tree
- **Gradle plugin** — compile-time instrumentation for 100% coverage
- **ML-based classification** — train a model on feature decay patterns instead of rule-based thresholds
- **Cohort analysis** — "new users vs. returning users" interaction patterns
- **A/B testing integration** — correlate dead features with specific A/B variants
- **iOS SDK** — same concept for UIKit/SwiftUI
- **Slack bot** — interactive dead feature reports in Slack
- **Auto-generated PR suggestions** — "Remove btn_share from ProfileFragment"
- **Heatmap visualization** — show tap density on a screen mockup

---

## Security & Privacy

### Data Anonymization

```
What we COLLECT:                    What we NEVER collect:
─────────────────                   ──────────────────────
• Element fingerprint (hash)        • User names / emails
• Event type (TAP/IMPRESSION)       • Personal identifiers
• Timestamp                         • Screen content / text
• Anonymous device hash             • Location data
• Screen name (class name)          • Contacts / photos
• Session ID (random UUID)          • IP address (stripped at ingress)
```

### Device ID Generation (Anonymous)

```kotlin
// We generate a random UUID on first launch and persist it.
// NOT tied to IMEI, Android ID, Ad ID, or any hardware identifier.

fun getOrCreateDeviceId(context: Context): String {
    val prefs = context.getSharedPreferences("fp_internal", MODE_PRIVATE)
    var deviceId = prefs.getString("device_id", null)
    if (deviceId == null) {
        deviceId = UUID.randomUUID().toString().take(16) // short random hash
        prefs.edit().putString("device_id", deviceId).apply()
    }
    return deviceId
}

// If user clears app data → new device ID → we treat them as a new device.
// This is intentional: we don't track users, we track elements.
```

### API Key Security

```
SDK-side:
• API key stored in BuildConfig (compile-time constant)
• Transmitted via X-API-Key header over HTTPS only
• Never logged in debug output
• Key is app-scoped (one key per registered app)

Server-side:
• Keys stored hashed (bcrypt) in the database
• Compared via constant-time comparison (prevent timing attacks)
• Rotatable via portal without SDK update (grace period: 48h both keys valid)
• Rate-limited per key: 100 requests/minute
```

### GDPR / Privacy Compliance

```
┌─────────────────────────────────────────────────────────────────┐
│  GDPR Compliance Checklist:                                     │
│                                                                 │
│  ✓ No PII collected (no names, emails, phone numbers)           │
│  ✓ Device ID is random UUID (not hardware-based)                │
│  ✓ Developer can call FeaturePulse.disable() for opt-out        │
│  ✓ 7-day raw event TTL (data minimization)                      │
│  ✓ All data transmitted over HTTPS/TLS 1.3                      │
│  ✓ Data deletion API: DELETE /apps/:appId/data (purge all)      │
│  ✓ No cross-app tracking (device ID is per-app)                 │
│  ✓ SDK doesn't read clipboard, contacts, location, camera       │
│  ✓ Legitimate interest basis (product improvement, no consent   │
│    banner needed — but developer should mention in privacy policy)│
└─────────────────────────────────────────────────────────────────┘
```

### Server Security

| Layer | Protection |
|-------|-----------|
| Transport | HTTPS only, TLS 1.3, HSTS headers |
| Authentication | API key (SDK), JWT (Portal) |
| Authorization | App-scoped — can only see own data |
| Input validation | Zod schemas, reject malformed payloads |
| Rate limiting | 100 req/min per API key, 429 on exceed |
| SQL injection | Parameterized queries (never string concat) |
| Dependency audit | `npm audit` in CI, Snyk/Dependabot alerts |
| Secrets management | Environment variables, never in code |
| CORS | Portal domain whitelist only |
| Logging | No sensitive data in logs, structured JSON logging |

### Permissions Required

```xml
<!-- AndroidManifest.xml — SDK requires ONLY: -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- That's it. No dangerous permissions. No location, camera, storage, etc. -->
```

---

## SDK Integration Guide

### Step 1: Add Dependency

```kotlin
// settings.gradle.kts (project level)
dependencyResolutionManagement {
    repositories {
        maven { url = uri("https://jitpack.io") }
    }
}

// build.gradle.kts (app module)
dependencies {
    implementation("com.github.featurepulse:sdk:1.0.0")
}
```

### Step 2: Initialize in Application

```kotlin
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        
        val config = PulseConfig.Builder()
            .setApiKey("fp_your_api_key_here")
            .setAppId("com.example.myapp")
            .build()
        
        FeaturePulse.init(this, config)
    }
}
```

### Step 3: Register Application in AndroidManifest

```xml
<application
    android:name=".MyApp"
    ... >
```

### Step 4: (Optional) ProGuard / R8 Rules

```proguard
# FeaturePulse SDK — keep public API
-keep class com.featurepulse.FeaturePulse { *; }
-keep class com.featurepulse.PulseConfig { *; }
-keep class com.featurepulse.PulseConfig$Builder { *; }

# Keep model classes for JSON serialization
-keep class com.featurepulse.internal.model.** { *; }
```

### Step 5: Verify Integration

```kotlin
// In debug builds, enable debug mode to see logs:
FeaturePulse.setDebugMode(true)

// Logcat output:
// [FeaturePulse] Initialized with appId: com.example.myapp
// [FeaturePulse] Scanning MainActivity — found 14 interactive elements
// [FeaturePulse] Recorded TAP on btn_checkout (MainActivity)
// [FeaturePulse] Buffer at 23/500 — next sync in 28 min
```

### Minimum Requirements

| Requirement | Value |
|-------------|-------|
| Min SDK | API 21 (Android 5.0) |
| Target SDK | API 34+ |
| Language | Kotlin 1.9+ (Java-compatible) |
| Dependencies | OkHttp 4.x, WorkManager 2.9+, Coroutines 1.7+ |
| Size impact | ~120 KB (AAR) |

---

## Error Handling & Resilience

### SDK-Side Error Handling

```
┌──────────────────────────────────────────────────────────────────┐
│  Principle: SDK must NEVER crash the host app.                   │
│  All operations are wrapped in try-catch.                        │
│  On any error → log + skip + continue.                           │
└──────────────────────────────────────────────────────────────────┘
```

| Scenario | Behavior |
|----------|----------|
| Network unavailable | Buffer locally, retry on next sync cycle |
| Server returns 5xx | Exponential backoff: 1min → 2min → 4min → ... max 30min |
| Server returns 429 (rate limit) | Back off, respect `Retry-After` header |
| Server returns 401 (bad API key) | Stop syncing, log error, don't crash |
| Disk full (can't persist buffer) | Keep in-memory only, lose on kill |
| Buffer overflow (>500 events) | Drop oldest events (circular buffer) |
| ViewTree scan throws exception | Catch, log, skip that screen |
| Activity destroyed mid-scan | Check `isFinishing()` / `isDestroyed()` before accessing views |
| OOM during batch serialization | Reduce batch size, retry with fewer events |
| Corrupted SharedPreferences | Clear and restart fresh (lose buffered events) |

### Retry Strategy

```kotlin
class RetryPolicy {
    private var attempt = 0
    private val maxAttempts = 5
    private val baseDelayMs = 60_000L // 1 minute
    
    fun nextDelay(): Long? {
        if (attempt >= maxAttempts) return null // give up
        val delay = baseDelayMs * (1 shl attempt) // exponential: 1, 2, 4, 8, 16 min
        attempt++
        return delay.coerceAtMost(30 * 60_000L) // cap at 30 min
    }
    
    fun reset() { attempt = 0 }
}
```

### Server-Side Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid event in batch | Reject that event, accept the rest (partial success) |
| Database connection lost | Return 503, SDK will retry |
| Cron job fails mid-aggregation | Idempotent design — safe to re-run for same date |
| Duplicate events received | Idempotent insert (ON CONFLICT DO NOTHING on event_id) |
| Duplicate events received | Idempotent insert (ON CONFLICT DO NOTHING on event_id) |

---

## Session Management

### How Sessions Work

```
┌────────────────────────────────────────────────────────────┐
│  Session Definition:                                       │
│                                                            │
│  A session starts when: app comes to foreground            │
│  A session ends when:   app goes to background for >30s    │
│                                                            │
│  Same session if user switches apps and returns within 30s │
│  New session if gap > 30 seconds                           │
└────────────────────────────────────────────────────────────┘

Timeline:
──────────────────────────────────────────────────────────────
  App opens     User browses     Lock screen     App opens again
      │              │                │                │
      ▼              ▼                ▼                ▼
  Session A ──────────────────► (gap: 5 min) ──► Session B
  ID: "sess_abc123"                             ID: "sess_def456"
```

### Implementation

```kotlin
object SessionManager {
    private var currentSessionId: String? = null
    private var lastActivityTime: Long = 0
    private val SESSION_TIMEOUT_MS = 30_000L // 30 seconds
    
    fun getOrCreateSession(): String {
        val now = System.currentTimeMillis()
        if (currentSessionId == null || (now - lastActivityTime) > SESSION_TIMEOUT_MS) {
            currentSessionId = "sess_" + UUID.randomUUID().toString().take(12)
        }
        lastActivityTime = now
        return currentSessionId!!
    }
    
    fun onAppBackground() {
        lastActivityTime = System.currentTimeMillis()
    }
    
    fun onAppForeground() {
        // If gap > 30s, getOrCreateSession() will generate new ID
    }
}
```

### Why Sessions Matter

- **Unique users per day** = COUNT(DISTINCT session_id) grouped by date
- **Session depth** = how many screens visited per session (engagement signal)
- **Allows deduplication** = same element tapped 10 times in 1 session counts as 1 meaningful interaction (configurable)

---

## Impression Tracking Details

### What Counts as an "Impression"

```
┌─────────────────────────────────────────────────────────────┐
│  An impression is recorded when:                            │
│                                                             │
│  1. View is at least 50% visible on screen                  │
│     (checked via getGlobalVisibleRect())                    │
│                                                             │
│  2. View has been visible for ≥ 1 second (configurable)     │
│     (prevents counting scroll-past as impression)           │
│                                                             │
│  3. View has not already been counted in this session        │
│     (one impression per element per session)                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Visibility Calculation

```kotlin
fun isViewSufficientlyVisible(view: View): Boolean {
    val visibleRect = Rect()
    val isVisible = view.getGlobalVisibleRect(visibleRect)
    
    if (!isVisible) return false
    
    val viewArea = view.width * view.height
    if (viewArea == 0) return false
    
    val visibleArea = visibleRect.width() * visibleRect.height()
    val visibilityRatio = visibleArea.toFloat() / viewArea.toFloat()
    
    return visibilityRatio >= 0.5f // at least 50% visible
}
```

### Polling Strategy

```
We DON'T poll constantly. We check visibility:
• Once when screen first loads (after layout pass)
• On scroll events (via OnScrollListener)
• On ViewTreeObserver.onGlobalLayout (any layout change)
• Debounced: max 1 check per 500ms to avoid CPU waste

For each visible element, start a timer.
If still visible after 1000ms → record impression.
If scrolled away before 1000ms → discard, no impression.
```

---

## Performance Overhead

### Benchmarks (Target)

| Metric | Impact | Acceptable? |
|--------|--------|-------------|
| APK size increase | +120 KB | ✅ Negligible |
| App startup time | +15-30ms (one-time registration) | ✅ Unnoticeable |
| Screen transition | +5-10ms (ViewTree scan) | ✅ Unnoticeable |
| Memory (steady state) | +500 KB (buffer + tracking maps) | ✅ Trivial |
| Memory (peak scan) | +2 MB briefly during tree traversal | ✅ Fine |
| CPU (tap recording) | <1ms per tap | ✅ Instant |
| CPU (visibility check) | ~3ms per check, max 2x/sec | ✅ Fine |
| Battery (30-min sync) | ~0.1% per sync (one small HTTP call) | ✅ Negligible |
| Network (per sync) | ~5-20 KB (500 events compressed) | ✅ Tiny |

### Why It's Lightweight

```
Traditional analytics (Firebase/Mixpanel):
• Developer manually adds tracking everywhere
• Each event = separate processing
• Real-time streaming = constant network

FeaturePulse:
• ONE scan per screen open (cached after first scan)
• Events are just tiny structs added to array (~50 bytes each)
• ONE HTTP call every 30 minutes
• No real-time requirement
• No UI rendering (unlike heatmap tools)
```

### Safeguards

```kotlin
// Kill switch if performance degrades:
if (Runtime.getRuntime().freeMemory() < 5_000_000) { // < 5MB free
    pauseTracking() // back off until memory recovers
}

// Scan timeout:
withTimeoutOrNull(100) { // 100ms max for ViewTree scan
    scanViewTree(rootView)
} ?: logWarning("Scan timed out — skipping this screen")

// Main thread protection:
// All scanning happens on Dispatchers.Default (background)
// Only reading view properties touches main thread (unavoidable)
// View property reads are <1μs each
```

---

## Comparison vs. Alternatives

| Feature | FeaturePulse | Firebase Analytics | Mixpanel | Amplitude | Heap |
|---------|-------------|-------------------|----------|-----------|------|
| Auto-instruments ALL elements | ✅ | ❌ Manual events | ❌ Manual events | ❌ Manual events | ⚠️ Partial (web only) |
| Zero code per element | ✅ | ❌ | ❌ | ❌ | ⚠️ Web only |
| Detects DEAD features specifically | ✅ | ❌ | ❌ | ❌ | ❌ |
| Feature lifecycle states | ✅ | ❌ | ❌ | ❌ | ❌ |
| Decay detection & alerts | ✅ | ❌ | ❌ | ❌ | ❌ |
| Kill-list report | ✅ | ❌ | ❌ | ❌ | ❌ |
| Works on Android native | ✅ | ✅ | ✅ | ✅ | ❌ |
| Impression tracking (seen but not tapped) | ✅ | ❌ | ❌ | ❌ | ⚠️ |
| Privacy-first (no PII) | ✅ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| Purpose | Find dead features | General analytics | User behavior | Product analytics | Session replay |

### Key Differentiator

```
Firebase/Mixpanel answer: "How many users clicked btn_share?"
  → But only if developer manually tagged btn_share.

FeaturePulse answers: "Which elements exist that NOBODY clicks?"
  → Automatically, for ALL elements, with no manual work.

They're complementary, not competing.
Analytics = what users DO.
FeaturePulse = what users NEVER DO.
```

---

## Edge Cases

| Edge Case | How We Handle It |
|-----------|-----------------|
| **Multi-process app** | SDK initializes per-process. Each process gets its own buffer. Events merge on server via same appId. |
| **WebView content** | WebView is treated as a single View (one element). We can't see inside web content. Listed as limitation. |
| **Dynamic Feature Modules** | When module loads, its Activities still trigger lifecycle callbacks. Works automatically. |
| **App Bundles (AAB)** | No impact — resource names are preserved in split APKs. |
| **Instant Apps** | Works normally — same lifecycle, same APIs. |
| **Work profiles (enterprise)** | Separate app instance = separate device ID = tracked independently. |
| **Screen rotation** | Same elements get same fingerprint (resourceName doesn't change). Activity recreated → re-scanned. |
| **Dark mode toggle** | No impact — we track elements, not their visual appearance. |
| **Accessibility services** | Our View traversal doesn't conflict with TalkBack. We read, never modify. |
| **Multiple Activities visible** (split screen) | Both get lifecycle callbacks. Both scanned independently. |
| **Custom Views (extends View)** | If `isClickable == true`, we track them. Works for any custom View. |
| **Toolbar menu items** | Detected via `Activity.onCreateOptionsMenu()` hook + menu item iteration. |
| **Navigation Component** | Fragments are tracked via FragmentLifecycleCallbacks. NavGraph destinations = fragments. |
| **Bottom Navigation / Tabs** | Each tab's fragment is scanned on selection via FragmentLifecycleCallbacks. |
| **Dialogs and BottomSheets** | DialogFragment → FragmentLifecycleCallbacks catches it. AlertDialog → tracked if we observe Window additions. |
| **App in background for days** | Buffer persisted. On next open, sends stale events (server accepts any timestamp within 7 days). |
| **Clock manipulation** | We use `System.currentTimeMillis()`. If user changes clock, timestamps may be off. Server validates: rejects events >7 days old or in the future. |
| **Emulators / Test devices** | Tracked normally. Developer can filter by device count in portal (1-device = likely dev). |
| **No internet for weeks** | Buffer fills → oldest events dropped (circular). When internet returns, sends what's in buffer. |

---

## Testing Strategy

### Unit Tests (SDK)

```kotlin
// What to test:
// ─────────────────────────────────────────────────────

// Fingerprinting:
@Test fun `fingerprint is stable across sessions`()
@Test fun `fingerprint changes when screen changes`()
@Test fun `fingerprint uses resourceName when available`()
@Test fun `fingerprint falls back to hierarchy when no ID`()

// Interactive detection:
@Test fun `Button is detected as interactive`()
@Test fun `TextView is NOT detected as interactive`()
@Test fun `Clickable LinearLayout IS detected`()
@Test fun `View with onClickListener IS detected`()

// Buffer:
@Test fun `buffer accepts events up to max size`()
@Test fun `buffer drops oldest when full`()
@Test fun `buffer persists to SharedPreferences`()
@Test fun `buffer restores from SharedPreferences on restart`()

// Session:
@Test fun `new session after 30s gap`()
@Test fun `same session within 30s`()

// Visibility:
@Test fun `50 percent visible counts as impression`()
@Test fun `less than 50 percent does not count`()
@Test fun `impression requires 1 second duration`()
```

### Integration Tests (SDK → Server)

```kotlin
// Use MockWebServer (OkHttp) to verify:
@Test fun `batch upload sends correct JSON format`()
@Test fun `retry on 5xx with exponential backoff`()
@Test fun `stops retrying after max attempts`()
@Test fun `respects wifi-only configuration`()
@Test fun `sends events even after app restart`()
```

### Server Tests

```javascript
// Unit tests (Jest):
test('aggregation computes correct interaction rate')
test('classification: 0 interactions for 30 days = DEAD')
test('classification: rate drop >20% WoW = DECLINING')
test('state transition: DEAD → DORMANT on new interaction')
test('batch ingestion deduplicates by eventId')
test('invalid events are rejected, valid ones accepted')

// Integration tests (Supertest + test DB):
test('POST /events/batch returns 200 with valid payload')
test('POST /events/batch returns 401 with bad API key')
test('POST /events/batch returns 429 when rate limited')
test('GET /features returns paginated results')
test('GET /features?state=DEAD filters correctly')
test('nightly cron updates feature states')
```

### End-to-End Test

```
1. Start demo app with SDK integrated
2. Tap some buttons, ignore others
3. Wait for sync (or force flush)
4. Verify events appear in server DB
5. Trigger nightly cron manually
6. Verify features are classified correctly
7. Open portal, verify dashboard shows correct stats
8. Verify dead features appear in dead list
```

---

## Demo App Specification

### Purpose
A sample Android app with **intentionally unused features** to demonstrate FeaturePulse detecting them.

### Screens & Elements

```
┌────────────────────────────────────────────────────────┐
│  Demo App: "ShopDemo" (fake e-commerce app)            │
│                                                        │
│  HomeActivity:                                         │
│  ├── btn_search        (THRIVING — users tap often)    │
│  ├── btn_cart          (THRIVING — users tap often)    │
│  ├── btn_categories    (DECLINING — rarely tapped)     │
│  ├── btn_deals         (DEAD — never tapped)           │
│  ├── fab_scan_barcode  (DEAD — never tapped)           │
│  └── tab_trending      (DORMANT — tapped once, never again) │
│                                                        │
│  ProductFragment:                                      │
│  ├── btn_add_to_cart   (THRIVING)                      │
│  ├── btn_share         (DEAD — never tapped)           │
│  ├── btn_compare       (DEAD — never tapped)           │
│  └── btn_wishlist      (DECLINING)                     │
│                                                        │
│  ProfileActivity:                                      │
│  ├── btn_edit_profile  (THRIVING)                      │
│  ├── btn_export_data   (DEAD — nobody uses this)       │
│  ├── btn_dark_mode     (DORMANT)                       │
│  └── switch_notifications (THRIVING)                   │
│                                                        │
│  SettingsActivity:                                     │
│  ├── btn_clear_cache   (DORMANT)                       │
│  ├── btn_rate_app      (DEAD — old rating prompt)      │
│  ├── btn_legacy_invite (DEAD — referral feature died)  │
│  └── switch_analytics  (DEAD — nobody opts out)        │
│                                                        │
│  Total: ~16 tracked elements                           │
│  Expected: 6 DEAD, 2 DORMANT, 2 DECLINING, 6 THRIVING │
└────────────────────────────────────────────────────────┘
```

### Demo Script (for presentation)

```
1. Show the app running normally — user interacts with some buttons
2. Show Logcat: "FeaturePulse: Discovered 16 elements on 4 screens"
3. After some interactions, force flush
4. Switch to portal → Dashboard shows: "6 Dead Features detected"
5. Click into dead feature list → show btn_share, btn_deals, etc.
6. Click btn_share → show timeline: "Last interaction: never"
7. Show portal alert log: "🚨 btn_legacy_invite is now DEAD"
```

---

## Deployment Guide

### Server Deployment

```
┌─────────────────────────────────────────────────────────┐
│  Recommended: Railway.app (free tier for course project)│
│  Alternative: Render.com, Heroku, DigitalOcean          │
│                                                         │
│  Stack:                                                 │
│  • Node.js 20 runtime                                   │
│  • PostgreSQL (Railway provides managed DB)             │
│  • No Redis needed (simple enough without caching)      │
│  • Cron: node-cron (in-process, no external scheduler)  │
└─────────────────────────────────────────────────────────┘

Environment Variables:
DATABASE_URL=postgresql://user:pass@host:5432/featurepulse
PORT=3000
NODE_ENV=production
JWT_SECRET=<random-64-char-string>
CORS_ORIGIN=https://featurepulse-portal.vercel.app

Deployment Steps:
1. Push server/ to GitHub
2. Connect Railway to GitHub repo
3. Set environment variables
4. Railway auto-deploys on push
5. Run schema migration: `npx prisma migrate deploy`
```

### Portal Deployment

```
┌─────────────────────────────────────────────────────────┐
│  Recommended: Vercel (free tier, perfect for React)     │
│  Alternative: Netlify, Cloudflare Pages                 │
└─────────────────────────────────────────────────────────┘

Deployment Steps:
1. Push portal/ to GitHub
2. Connect Vercel to GitHub repo
3. Set env: VITE_API_URL=https://your-server.railway.app
4. Vercel auto-builds and deploys
5. Custom domain (optional): featurepulse.dev
```

### SDK Publishing

```
┌─────────────────────────────────────────────────────────┐
│  Recommended: JitPack (easiest for course project)      │
│  Alternative: Maven Central (production-grade)          │
└─────────────────────────────────────────────────────────┘

JitPack Steps:
1. Push SDK module to GitHub (public repo)
2. Create a GitHub Release (tag: v1.0.0)
3. JitPack auto-builds the AAR
4. Developers add:
   maven { url "https://jitpack.io" }
   implementation 'com.github.youruser:featurepulse-sdk:1.0.0'
```

### CI/CD Pipeline (Optional)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  server-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_db
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: cd server && npm ci && npm test

  sdk-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: '17' }
      - run: cd sdk && ./gradlew build

  portal-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: cd portal && npm ci && npm run build
```

---

## Remote Config Details

### How Remote Config Works

```
┌─────────────────────────────────────────────────────────────┐
│  On SDK init and every 6 hours, SDK calls:                  │
│  GET /api/v1/config?appId=com.example.myapp                 │
│                                                             │
│  Server returns:                                            │
│  {                                                          │
│    "enabled": true,          // kill switch                  │
│    "syncIntervalMs": 1800000, // 30 min                     │
│    "batchSize": 500,                                        │
│    "minImpressionMs": 1000,                                 │
│    "excludeScreens": [],     // server-side exclusions       │
│    "samplingRate": 1.0,      // 1.0 = track all, 0.5 = 50% │
│    "sdkMinVersion": "1.0.0"  // force-update signal         │
│  }                                                          │
│                                                             │
│  SDK caches this locally. If network fails, uses cached.    │
│  If no cache exists, uses hardcoded defaults.               │
└─────────────────────────────────────────────────────────────┘
```

### Use Cases for Remote Config

| Scenario | Config Change |
|----------|--------------|
| SDK causing crashes in production | Set `enabled: false` → instant kill switch |
| Too many events overwhelming server | Reduce `samplingRate` to 0.5 (track 50% of devices) |
| Need faster data collection | Reduce `syncIntervalMs` to 5 minutes |
| New screen should be excluded | Add to `excludeScreens` array |
| Old SDK version has a bug | Set `sdkMinVersion` to "1.1.0" → SDK shows upgrade notice |

### Caching Strategy

```kotlin
object RemoteConfigCache {
    private const val CACHE_KEY = "fp_remote_config"
    private const val CACHE_TTL_MS = 6 * 60 * 60 * 1000L // 6 hours
    
    fun getCachedOrFetch(context: Context): RemoteConfig {
        val cached = readFromPrefs(context)
        if (cached != null && !isExpired(cached.fetchedAt)) {
            return cached.config
        }
        
        return try {
            val fresh = apiClient.fetchConfig()
            saveToPrefs(context, fresh)
            fresh
        } catch (e: Exception) {
            cached?.config ?: RemoteConfig.DEFAULTS
        }
    }
}
```

---

## Versioning & Backward Compatibility

### SDK Versioning

```
Version format: MAJOR.MINOR.PATCH (Semantic Versioning)

1.0.0 → Initial release
1.1.0 → Add Compose support (new feature, backward compatible)
1.2.0 → Add custom event recording (new feature)
2.0.0 → Breaking change (e.g., new init() signature)

Rule: NEVER break existing API without major version bump.
Developers on 1.x should never need to change their code
when updating from 1.0 → 1.9.
```

### API Versioning

```
All endpoints prefixed with /api/v1/

If breaking changes needed in future:
/api/v2/events/batch  ← new format
/api/v1/events/batch  ← still works (deprecated, sunset in 6 months)

Server supports both v1 and v2 simultaneously during migration period.
```

### Backward Compatibility Guarantees

```
┌───────────────────────────────────────────────────────────────┐
│  SDK v1.0 sends events to server                              │
│  Server gets updated with new fields                          │
│                                                               │
│  Rule: Server MUST accept payloads from ANY SDK v1.x          │
│  • New optional fields are ignored if missing                 │
│  • Old required fields are always expected                    │
│  • Server adds defaults for anything new                      │
│                                                               │
│  Example:                                                     │
│  SDK v1.0 sends: { featureId, eventType, timestamp }          │
│  SDK v1.2 sends: { featureId, eventType, timestamp, osVersion}│
│  Server accepts both — osVersion defaults to "unknown" if     │
│  missing.                                                     │
└───────────────────────────────────────────────────────────────┘
```

### Database Migration Strategy

```
Migrations are forward-only, never destructive:

✅ ADD COLUMN (with default value)
✅ ADD INDEX
✅ ADD TABLE
✅ ADD CONSTRAINT (if existing data satisfies it)

❌ Never DROP COLUMN (might break old SDK versions)
❌ Never RENAME COLUMN (breaks existing queries)
❌ Never change column type without migration

Tool: Prisma Migrate (generates migration files, tracks applied migrations)
```

---

## File Structure (Project)

```
featurepulse/
├── sdk/                          # Android library module
│   ├── src/main/kotlin/com/featurepulse/
│   │   ├── FeaturePulse.kt          # Singleton entry point
│   │   ├── PulseConfig.kt           # Builder configuration
│   │   ├── internal/
│   │   │   ├── lifecycle/
│   │   │   │   ├── ActivityTracker.kt
│   │   │   │   └── FragmentTracker.kt
│   │   │   ├── discovery/
│   │   │   │   ├── ViewTreeScanner.kt
│   │   │   │   ├── Fingerprinter.kt
│   │   │   │   └── InteractiveViewFilter.kt
│   │   │   ├── tracking/
│   │   │   │   ├── TouchInterceptor.kt    # Window.Callback proxy
│   │   │   │   ├── VisibilityTracker.kt
│   │   │   │   └── EventRecorder.kt
│   │   │   ├── buffer/
│   │   │   │   ├── EventBuffer.kt         # Circular buffer
│   │   │   │   └── BufferPersistence.kt   # SharedPreferences
│   │   │   ├── sync/
│   │   │   │   ├── SyncWorker.kt          # WorkManager
│   │   │   │   ├── ApiClient.kt           # HTTP client
│   │   │   │   └── RetryPolicy.kt
│   │   │   └── model/
│   │   │       ├── RawEvent.kt
│   │   │       ├── DiscoveredElement.kt
│   │   │       └── EventType.kt
│   │   └── BuildConfig.kt
│   └── build.gradle.kts
│
├── server/                        # Node.js backend
│   ├── src/
│   │   ├── index.ts                  # Express app setup
│   │   ├── routes/
│   │   │   ├── events.ts             # POST /events/batch
│   │   │   ├── features.ts           # GET /features, /features/:id
│   │   │   ├── dashboard.ts          # GET /dashboard
│   │   │   ├── apps.ts               # App management
│   │   │   └── auth.ts               # Login/register
│   │   ├── middleware/
│   │   │   ├── auth.ts               # API key validation
│   │   │   ├── rateLimit.ts
│   │   │   └── validation.ts
│   │   ├── services/
│   │   │   ├── ingestion.ts          # Event processing
│   │   │   ├── aggregation.ts        # Nightly cron logic
│   │   │   ├── classification.ts     # State machine
│   │   │   └── alerts.ts             # In-portal alert logging
│   │   ├── db/
│   │   │   ├── schema.sql
│   │   │   ├── migrations/
│   │   │   └── queries.ts
│   │   └── cron/
│   │       └── nightly.ts            # Scheduled job
│   ├── package.json
│   └── tsconfig.json
│
├── portal/                        # React web dashboard
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── FeatureDetail.tsx
│   │   │   ├── Alerts.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── FeatureTable.tsx
│   │   │   ├── TimelineChart.tsx
│   │   │   ├── StatCard.tsx
│   │   │   └── StatesBadge.tsx
│   │   ├── api/
│   │   │   └── client.ts
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── demo-app/                      # Sample Android app for testing
│   └── ...
│
├── docs/                          # Documentation
│   ├── integration-guide.md
│   ├── api-reference.md
│   └── architecture.md
│
└── README.md
```
