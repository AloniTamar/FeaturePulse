# FeaturePulse Presentation Redesign — Design Spec
Date: 2026-06-12

## Context

The existing `FeaturePulse_Presentation.html` is 20 slides. The user found it too text-heavy, visually generic, and poorly structured for an idea pitch. This spec defines the redesigned presentation: 10 slides, clean minimal light aesthetic, all instructor-required content preserved.

## Audience & Purpose

University seminar in-person approval meeting. Instructors evaluate: problem/novelty, features & functions (exposed vs internal), architecture & data efficiency, portal wireframes, feasibility research, use cases.

## Visual Design System

**Approach:** "Spotlight" — each slide has one big idea statement as the headline, technical detail lives below in a compact secondary zone.

**Background:** White (`#FFFFFF`), generous padding (80–90px sides)

**Font:** Inter throughout
- Slide tag: 11px, uppercase, letter-spacing, indigo
- H2 headline: 44–52px, weight 800, tight letter-spacing, dark (`#0F172A`)
- Body / bullets: 16–18px, `#475569`
- Code: JetBrains Mono, 13px, subtle dark background

**Color palette:**
- Primary accent: Indigo `#4F46E5` — used sparingly (tags, left-border accents, icons only)
- State system (only color used prominently):
  - THRIVING: green `#16A34A` / `#DCFCE7`
  - DECLINING: yellow `#CA8A04` / `#FEF9C3`
  - DORMANT: orange `#EA580C` / `#FFEDD5`
  - DEAD: red `#DC2626` / `#FEE2E2`

**Cards:** Minimal — thin left-border accent (`3px solid indigo`) + light background (`#F8FAFC`). No heavy shadow. Generous internal padding.

**Code blocks:** Light gray background (`#F1F5F9`), monochrome text, minimal syntax highlighting (only keywords and strings).

**Layout:** Two-column (`1fr 1fr`) or three-column (`1fr 1fr 1fr`) grids where needed. Space and thin dividers instead of boxing everything in cards.

**Navigation:** Same bottom pill nav, progress bar at top.

**Transitions:** Same slide-in/slide-out animation.

---

## Slide Structure — 10 Slides

### Slide 1 — Title
- Logo icon + "FeaturePulse" name
- H1: "Dead Feature Detector SDK"
- Tagline (1 sentence): "Automatically detect unused UI elements in Android apps. Zero instrumentation. One line of code."
- 4 state pills only: THRIVING · DECLINING · DORMANT · DEAD
- Background: subtle gradient (indigo tint top-left, green tint bottom-right)

### Slide 2 — The Problem
- Tag: "The Problem"
- H2: "Most features ship. Most are never used. Nobody knows which ones."
- 3 large stat anchors (bold, large number + short label + source):
  - **80%** of features are rarely or never used *(Pendo, 2019 — 615 products)*
  - **$29.5B** wasted annually building features users ignore *(Pendo, 2019)*
  - **Zero** tools auto-detect dead UI elements on Android native
- 2 tight bullets:
  - Every existing analytics tool requires manual per-element developer tagging
  - Dead features bloat APK size, confuse users, and waste ongoing maintenance

### Slide 3 — The Solution
- Tag: "The Solution"
- H2: "One SDK. Three components. Complete visibility."
- 3 component cards (icon + name + 2-line description + one code/endpoint line):
  - **Android SDK** — Auto-discovers all interactive UI elements. Zero manual tagging. `FeaturePulse.init(this)`
  - **Backend API** — Node.js + Express + PostgreSQL. Batched events, nightly classification. `POST /api/v1/events/batch`
  - **Web Portal** — React dashboard. Feature health, dead lists, timelines, alerts. *(state pills)*
- Callout note: "Firebase tells you what users click. FeaturePulse tells you what they never do."

### Slide 4 — How It Works
- Tag: "How It Works"
- H2: "You write one line. We handle the rest."
- 5-step numbered flow, each step has a small label tag (YOU or AUTO) + bold step name + one sentence:
  1. **[YOU] Initialize** — `FeaturePulse.init(this)`. SDK registers lifecycle callbacks via Android OS.
  2. **[AUTO] Discover** — View tree scanned on every screen open. All interactive elements fingerprinted.
  3. **[AUTO] Track** — Touch events intercepted: TAP, LONG_PRESS, SWIPE, IMPRESSION. No host app changes.
  4. **[AUTO] Batch & Sync** — Events buffer locally (max 500). One HTTP call every 30 min via WorkManager.
  5. **[AUTO] Classify** — Nightly server job classifies each feature: THRIVING / DECLINING / DORMANT / DEAD.
- YOU label: indigo background. AUTO label: light gray background.

### Slide 5 — SDK Public API
- Tag: "SDK — Developer-Facing API"
- H2: "Everything a developer needs. Nothing they don't."
- Two columns:
  - Left — **INITIALIZATION & CONFIG** label + code block:
    ```
    FeaturePulse.init(application)
    FeaturePulse.init(application, config)

    PulseConfig.Builder()
      .setApiKey("fp_xxxxx")
      .setBatchSize(500)
      .setSyncInterval(30, MINUTES)
      .setExcludedScreens(...)
      .setEnabled(true)   // kill switch
      .build()
    ```
  - Right — **MANUAL CONTROLS** label + code block:
    ```
    FeaturePulse.pause()     // stop temporarily
    FeaturePulse.resume()
    FeaturePulse.flush()     // force send
    FeaturePulse.disable()   // GDPR opt-out
    FeaturePulse.ignore(viewId)
    FeaturePulse.ignoreScreen(name)
    FeaturePulse.setDebugMode(true)
    ```
- Small callout below: "Only 2 Android permissions required — INTERNET + ACCESS_NETWORK_STATE"

### Slide 6 — Internal Functions
- Tag: "SDK — Internal Library Functions"
- H2: "Under the hood — four layers of internal logic."
- 4-column grid (small-caps category label + monospace function list):
  - **SDK LIFECYCLE:** `registerLifecycleCallbacks()`, `onActivityResumed()`, `onFragmentResumed()`
  - **VIEW & FINGERPRINTING:** `scanViewTree(rootView)`, `isInteractiveView(view)`, `generateFingerprint()`, `computeHash()`
  - **EVENT RECORDING & SYNC:** `recordInteraction()`, `recordImpression()`, `addToBuffer(event)`, `flushBuffer()`, `sendBatch(events)`
  - **SERVER & PORTAL:** `ingestBatch(appId, events[])`, `classifyFeatureState()`, `runNightlyAggregation()`, `getFeatureList(appId)`, `renderDashboard(appId)`

### Slide 7 — Architecture & Data
- Tag: "Architecture & Data Design"
- H2: "Built to stay fast at scale — by design."
- Top section — System diagram (horizontal row of arch boxes with arrows):
  - `Android SDK` → POST batch events → `API Server` ⇌ `PostgreSQL`
  - Below: `Web Portal` ↑ REST, `Cron Worker` ↑ reads DB, `Webhooks` ↑ via server
- Bottom section — 3 data efficiency decisions (compact, 3 columns):
  - **Raw events: 7-day TTL** — deleted after aggregation. No unbounded growth.
  - **Pre-computed daily aggregates** — portal queries are instant. No COUNT(*) at request time.
  - **Features table: 100–500 rows, indexed** — dead feature list in < 5ms.
- Small callout: Portal query time: **< 5ms** for dead feature list.

### Slide 8 — Portal Wireframes
- Tag: "Web Portal — Wireframes"
- H2: "What the developer actually sees."
- Two side-by-side wireframe/schematic mockups (detailed HTML/CSS, to be replaced with real screenshots later):
  - **Dashboard:** app name header, 4 stat counters (Total / Dead / Declining / Thriving), chart placeholder, recent state changes table
  - **Feature Detail:** feature name + screen + element type, state pill, interaction timeline placeholder, 4 data rows (Last Interaction / First Seen / Impressions / Interaction Rate)
- Note: These are schematics. Real screenshots will replace them once the portal is built.

### Slide 9 — Feasibility Research
- Tag: "Feasibility Research"
- H2: "Every technical decision is backed by existing Android APIs."
- Compact table (4 columns: API | Purpose | Available Since | Used For):
  - `registerActivityLifecycleCallbacks()` | Detect all screen opens | API 14 | Auto-discovery trigger
  - `Window.Callback (Proxy)` | Intercept all touch events | API 1 | Touch interception
  - `View.getGlobalVisibleRect()` | Check if view is on screen | API 1 | Impression tracking
  - `ViewGroup.getChildAt()` | Traverse view tree | API 1 | Auto-discovery scan
  - `Resources.getResourceEntryName()` | Get resource name | API 1 | Fingerprinting
  - `WorkManager` | Battery-safe background sync | Jetpack | Batch upload scheduling
- 4 key challenges solved (2×2 grid, compact cards):
  - RecyclerView items not in DOM until scrolled → observe `AdapterDataObserver`
  - No resource ID on view → fallback: class name + hierarchy path
  - App killed unexpectedly → persist buffer to SharedPreferences on `onTrimMemory()`
  - Battery drain risk → WorkManager + 30-min batching = 1 HTTP call per 30 min

### Slide 10 — Use Cases
- Tag: "Use Cases"
- H2: "Any app that ships features needs to know which ones to kill."
- 6 use case cards (2×3 grid, icon + category + real app example + 1-sentence description):
  - **E-Commerce** — SHEIN, AliExpress — dozens of filters and promo tabs accumulate over years
  - **Social Media** — Instagram, TikTok — features that launch with hype and silently die
  - **Banking & Fintech** — Revolut, PayPal — dead features add regulatory compliance surface area
  - **Enterprise SaaS** — Monday.com, Jira mobile — feature bloat is the #1 UX complaint
  - **News & Content** — BBC, CNN apps — ghost-town tabs and content categories
  - **Health & Fitness** — MyFitnessPal, Strava — complex tracking flows users partially ignore

---

## Open Items

- Slide 4 (How It Works): YOU/AUTO label layout to be revisited if it doesn't look clean in implementation.
- Slide 5 (SDK API): May trim functions if slide feels too dense once built.
- Slide 8 (Portal Wireframes): Schematic placeholder now; replace with real portal screenshots when built. Portal color scheme TBD.
- Slide 2 (Problem): ~30% stat dropped in favor of Pendo 80% and $29.5B figures (both citable).
