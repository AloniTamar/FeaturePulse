# FeaturePulse

> Automatically detect unused UI elements in Android apps. Zero instrumentation. One line of code.

FeaturePulse is an Android SDK that intercepts touch events at the window level, fingerprints every interactive UI element, and tracks whether users actually interact with it. Features nobody touches are classified as **DEAD** — giving developers a clear list of what to remove.

---

## Components

| Component | Tech | Description |
|-----------|------|-------------|
| `sdk/` | Kotlin, OkHttp, WorkManager | Android library — auto-detects and tracks UI elements |
| `server/` | Node.js, Express, Prisma, PostgreSQL | API server — receives events, classifies features, serves the portal |
| `portal/` | React 18, TypeScript, Tailwind, Vite | Web dashboard — view feature health, trends, transitions |
| `demo-app/` | Android (Kotlin) | Sample app demonstrating SDK integration |

---

## How It Works

1. **SDK** wraps `Window.Callback` using the Proxy pattern — no code changes needed in the host app
2. Every touch is fingerprinted: `SHA256(screenName + resourceName)`
3. Events are buffered locally (circular buffer, max 500) and flushed every 30 min via WorkManager
4. The **backend** aggregates raw events into daily stats and runs a nightly classification job at 02:00 UTC
5. Classification state machine: `THRIVING → DECLINING → DORMANT → DEAD`
6. The **portal** shows per-app dashboards, feature lists, trend charts, and state transition history

---

## Running Locally

**Prerequisites:** Node.js 18+, PostgreSQL, Android Studio (for SDK/demo-app)

### Server

```bash
cd server
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, PORT, CORS_ORIGIN
npx prisma migrate deploy
npm run dev             # runs on :3000
```

### Portal

```bash
cd portal
npm install
npm run dev             # runs on :5173
```

### Seed demo data

```bash
cd server
npm run seed -- your@email.com   # adds ShopMate Pro + FitTrack with 60 days of data
```

---

## SDK Integration (Android)

```kotlin
// build.gradle.kts
implementation("com.github.featurepulse:sdk:1.0.0")
```

```kotlin
// Application.kt
FeaturePulse.init(this, PulseConfig.Builder()
    .setApiKey("fp_your_api_key")
    .setAppId("your_app_id")
    .build())
```

The API key and App ID are shown in the portal under **Settings** for each app.

---

## Classification States

| State | Meaning |
|-------|---------|
| **THRIVING** | Healthy interaction rate |
| **DECLINING** | Interaction rate falling below 2% for 7+ days |
| **DORMANT** | Interaction rate below 1% for 14+ days |
| **DEAD** | Zero interactions for 30+ days — safe to remove |

Thresholds are configurable per app in the portal Settings page.

---

## API Overview

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
PATCH  /api/v1/auth/me/password
DELETE /api/v1/auth/me

GET    /api/v1/apps
POST   /api/v1/apps
PATCH  /api/v1/apps/:appId
DELETE /api/v1/apps/:appId

GET    /api/v1/apps/:appId/dashboard
GET    /api/v1/apps/:appId/features
GET    /api/v1/apps/:appId/features/:id
GET    /api/v1/apps/:appId/transitions
GET    /api/v1/apps/:appId/export?format=csv|json
GET    /api/v1/apps/:appId/dead

POST   /api/v1/events          (SDK endpoint)
POST   /api/v1/cron            (trigger classification manually)
```

---

## Running Tests

```bash
cd server && npx jest --forceExit --runInBand
```

---

*University seminar project — Cellular Seminar, Year C Semester B*
