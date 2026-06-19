# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Style

**Never use git worktrees.** Develop directly on the project in `main` or a regular feature branch. Worktrees cause confusion about where files live and make testing awkward.

## Project Overview

**FeaturePulse** is a university seminar project (Cellular Seminar) — an Android SDK for automatically detecting unused UI elements in Android apps.

**Current artifacts:**
- `FEATUREPULSE.md` — complete technical specification (single source of truth for all design decisions)
- `FeaturePulse_Presentation.html` — self-contained presentation (HTML/CSS/JS, no build step)
- `docs/superpowers/specs/` — design specs for in-progress work
- `docs/superpowers/plans/` — implementation plans for in-progress work

## What Is Built

All three components are implemented and running:

| Component | Tech | Status |
|-----------|------|--------|
| Android SDK (`sdk/`) | Kotlin, OkHttp, WorkManager, Coroutines | Implemented |
| Backend API (`server/`) | Node.js, Express, Prisma, PostgreSQL, Zod, JWT | Implemented |
| Web Portal (`portal/`) | React 18, React Router v6, TypeScript, Tailwind, Vite | Implemented |
| Demo App (`demo-app/`) | Android (Kotlin) | Implemented |

## Running the Project

**Server:**
```bash
cd server && npm run dev        # runs on :3000
```

**Portal:**
```bash
cd portal && npm run dev        # runs on :5173
```

**Server tests:**
```bash
cd server && npx jest --forceExit --runInBand
```

The server requires a `.env` file at `server/.env` with `DATABASE_URL`, `JWT_SECRET`, `PORT`, `NODE_ENV`, and `CORS_ORIGIN`.

After any schema change run `npx prisma generate` inside `server/`.

## Architecture

### Auth & Multi-App

One account can own multiple apps. App context lives in the URL (`/apps/:appId/...`), not localStorage.

- `POST /auth/register` — creates a User only (no app), returns `{ token }`
- `POST /auth/login` — returns `{ token, apps[] }`
- `DELETE /auth/me` — deletes account + cascades all apps
- `PATCH /auth/me/password` — change password

### Apps

- `GET /apps` — list authenticated user's apps (includes `aiInsightsEnabled`, `aiInsightsMode`)
- `POST /apps` — create app (returns `apiKey` starting with `fp_`)
- `PATCH /apps/:appId` — update name, thresholds, retention, or AI insights settings
- `DELETE /apps/:appId` — delete (cascades features, events, aggregates)
- All `:appId` routes enforce ownership (403 if not owner)

### Portal Routing

```
/login
/apps                          ← Apps management page
/account                       ← Profile, password, delete account
/docs
/apps/:appId/dashboard
/apps/:appId/features
/apps/:appId/features/:id
/apps/:appId/alerts
/apps/:appId/analytics
/apps/:appId/settings
```

## Core Design Decisions (from spec)

**Fingerprinting:** Each UI element is identified by `SHA256(screenName + resourceName)` when a resource ID exists, falling back to `SHA256(screenName + viewClass + hierarchyPath)`.

**Touch interception:** The SDK wraps `Window.Callback` using the Proxy pattern.

**Classification state machine:** `THRIVING → DECLINING → DORMANT → DEAD`. Runs nightly at 02:00 UTC. DEAD = zero interactions for 30+ days; DORMANT = interaction rate < 1% for 14+ days.

**Batching:** Events buffered in circular buffer (max 500), flushed every 30 min via WorkManager. Persisted to SharedPreferences on `onTrimMemory()`.

**Data efficiency:** Raw events have 7-day TTL. Nightly cron aggregates into `DailyAggregate` (per-feature), `AppDailyStats` (per-app DAU), and `WeeklyAggregate` (per-feature weekly rates). Classification reads from `WeeklyAggregate` — 3 DB calls for the entire app. Dead feature list target: < 5ms via `(appId, state)` index.

**AI Insights:** Optional per-app feature. When enabled, calls OpenRouter (`google/gemma-4-31b-it:free`) to generate a health summary and action bullets. Two modes: `nightly` (pre-computed by cron, instant load) or `on_demand` (fresh on each Analytics page visit). `OPENROUTER_API_KEY` is required in `server/.env` — never exposed to the portal. Stored in `AppInsight` table.

## Presentation

Single self-contained HTML file — open directly in a browser, no build needed.
