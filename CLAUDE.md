# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FeaturePulse** is a university seminar project (Cellular Seminar) — an Android SDK concept for automatically detecting unused UI elements. The repository currently contains only the specification and a presentation; no application code has been implemented yet.

**Current artifacts:**
- `FEATUREPULSE.md` — complete technical specification (single source of truth for all design decisions)
- `FeaturePulse_Presentation.html` — self-contained presentation (HTML/CSS/JS, no build step)
- `docs/superpowers/specs/` — design specs for in-progress work
- `docs/superpowers/plans/` — implementation plans for in-progress work

## Presentation

The presentation is a single self-contained HTML file. To view it, open it directly in a browser — no server needed. There is no build, lint, or test command.

A redesign from 20 slides to 10 is in progress. The spec is at [docs/superpowers/specs/2026-06-12-presentation-redesign.md](docs/superpowers/specs/2026-06-12-presentation-redesign.md) and the implementation plan is at [docs/superpowers/plans/2026-06-12-presentation-redesign.md](docs/superpowers/plans/2026-06-12-presentation-redesign.md).

## Planned Architecture (Three Components)

| Component | Tech | Role |
|-----------|------|------|
| Android SDK (Kotlin) | OkHttp, WorkManager, Coroutines | Auto-discovers interactive views, intercepts touches, batches events |
| Backend API (Node.js) | Express, PostgreSQL, Prisma, Zod | Ingests events, runs nightly classification cron, serves portal |
| Web Portal (React) | Vite + TypeScript | Developer dashboard showing feature health, dead lists, timelines |

## Core Design Decisions (from spec)

**Fingerprinting:** Each UI element is identified by `SHA256(screenName + resourceName)` when a resource ID exists, falling back to `SHA256(screenName + viewClass + hierarchyPath)`. Resource name is preferred because it survives layout refactors.

**Touch interception:** The SDK wraps `Window.Callback` using the Proxy pattern — intercepts all touch events without modifying the host app's existing listeners.

**Classification state machine:** `THRIVING → DECLINING → DORMANT → DEAD`. Classification runs nightly at 02:00 UTC. Key thresholds: DEAD = zero interactions across all users for 30+ days; DORMANT = interaction rate < 1% for 14+ days.

**Batching:** Events are buffered in a circular buffer (max 500). One HTTP call every 30 minutes via WorkManager. Buffer is persisted to SharedPreferences on `onTrimMemory()` to survive process kills.

**Data efficiency:** Raw events have a 7-day TTL. The portal only reads pre-computed `daily_aggregates` — never raw events. Portal query time target: < 5ms for dead feature list via indexed `(app_id, state)` lookup.

## Planned File Structure (not yet created)

```
sdk/          Android library module
server/       Node.js backend
portal/       React web dashboard
demo-app/     Sample Android app
```

The expected SDK module structure, server routes, and full PostgreSQL schema are all documented in `FEATUREPULSE.md`.
