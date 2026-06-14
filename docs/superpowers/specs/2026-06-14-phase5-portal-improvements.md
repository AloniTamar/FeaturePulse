# Phase 5 Portal Improvements — Design Spec

**Date:** 2026-06-14  
**Status:** Approved  
**Scope:** Portal UX polish + Transitions page + Settings expansion + Docs area

---

## Overview

Ten improvements across the portal, grouped into six areas:
1. Destructive action confirmations
2. Apps page card UX
3. Last-app context on global pages
4. Features page filter/sort/cron
5. Transitions page (replaces Alerts)
6. Export filename, Settings expansion, Docs area

---

## 1. Destructive Action Confirmations

### Affected flows
- Delete account (`Account.tsx`)
- Delete app (`Apps.tsx` → `DeleteModal`)

### Pattern (both flows identical)

**Step 1 (existing, unchanged):** User types their email / app name to match. The "Delete" button becomes enabled once the input matches.

**Step 2 (new):** Clicking "Delete" opens a second confirmation modal on top of the current one. It contains:
- Title: "Are you absolutely sure?"
- Body (account): "This is permanent. All your apps, features, and event data will be destroyed and cannot be recovered."
- Body (app): "This is permanent. All features, events, and aggregates for **{app name}** will be destroyed and cannot be recovered."
- Two buttons: **Cancel** (secondary) + **Yes, delete forever** (red primary)

Only clicking "Yes, delete forever" fires the actual API call. The first modal (with the name field) stays mounted behind the second.

The second modal has no additional input — it is pure intent confirmation.

---

## 2. Apps Page: Card as Link

### Change
Remove the "Open" button from `AppCard`. The entire card becomes a click target that navigates to `/apps/:appId/dashboard`.

### Interaction rules
- Card `div` gets `cursor-pointer` and an `onClick` that calls `onOpen()`
- Internal action elements stop propagation: rename pencil button, rename `<input>`, Show/Hide button, Copy button, Delete button
- Result: clicking anywhere on the card that is not an action button navigates to the dashboard

---

## 3. Last-App Context on Global Pages

### Problem
When on global pages (`/apps`, `/account`, `/docs`), `appId` is absent from the URL so `hasApp = false` and the per-app nav items (Dashboard, Features, Transitions, Settings) are rendered disabled.

### Solution
Persist the last visited app ID to `localStorage` as `fp_last_app_id`.

**Write:** Any time the user navigates to a route matching `/apps/:appId/*`, write `fp_last_app_id = appId` to localStorage.

**Read:** In `Sidebar`, compute `effectiveAppId = appId ?? localStorage.getItem('fp_last_app_id') ?? null`. Nav items link to `effectiveAppId` and are disabled only when `effectiveAppId` is null (brand-new user who has never opened an app).

**App Switcher:** No change — it continues to show "Select App" when `appId` is not in the URL, since it is scoped to the active URL context.

---

## 4. Features Page Improvements

### 4a. Filter: pill buttons (replaces `<select>`)
Replace the state filter dropdown with a row of pill/chip buttons:

`All · THRIVING · DECLINING · DORMANT · DEAD`

- Each pill is colored to match the existing `StateBadge` colors (green, yellow, slate-400, red)
- Active pill: filled background. Inactive: outlined border.
- Only one pill active at a time. Clicking the active pill resets to All.

### 4b. Sorting
Add a sort control (small `<select>`) next to the pills with options:
- Last interaction — newest first (default)
- Last interaction — oldest first
- Name (A → Z)
- Interaction rate — highest first

The sort value is passed as a `sort` query param to `GET /apps/:appId/features`. The server sorts accordingly. The existing `state` filter param is unchanged.

### 4c. URL state initialization
On mount, Features reads `?state=DEAD` (or any other state) from the URL search params to initialize the active pill filter. This allows the Dashboard "Manage all" button to link to `/apps/:appId/features?state=DEAD` and land with DEAD pre-selected.

### 4d. Run Cron Now button
Extract the cron state machine from `Dashboard.tsx` into a shared custom hook `useCron(appId)`:
- State: `'idle' | 'loading' | 'ok' | 'error'`
- Exposes: `cronState`, `runCron`
- Resets to `'idle'` after 3 seconds

Both `Dashboard` and `Features` use this hook and render the same "Run Cron Now" button in the topbar via `setActions`. No logic duplication.

### 4e. Server changes
`GET /apps/:appId/features` gains an optional `sort` query param:
- `sort=lastInteraction_desc` (default)
- `sort=lastInteraction_asc`
- `sort=name_asc`
- `sort=interactionRate_desc`

---

## 5. Transitions Page (replaces Alerts)

### Nav change
The "Alerts" nav item in the sidebar becomes **"Transitions"** with a history/clock icon. The route path changes from `alerts` to `transitions` (`/apps/:appId/transitions`). `App.tsx` is updated to import the new page and use `path="transitions"`. All existing links from Dashboard that pointed to `alerts` are updated to `transitions`.

### New API endpoint
`GET /api/v1/apps/:appId/transitions?page=1&limit=20&toState=&sort=desc`

Returns:
```json
{
  "data": [
    {
      "id": 1,
      "oldState": "THRIVING",
      "newState": "DECLINING",
      "changedAt": "2026-06-14T02:00:00Z",
      "feature": {
        "id": "...",
        "resourceName": "btn_checkout",
        "screenName": "CheckoutScreen"
      }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 143 }
}
```

Query params:
- `toState` — filter by `newState` (optional)
- `sort` — `desc` (newest first, default) or `asc`

### Page UI
Mirrors the Features page structure:

**Filter pills:** `All · THRIVING · DECLINING · DORMANT · DEAD` — filters by `newState` (what the feature transitioned **to**)

**Sort control:** Date — newest first / oldest first

**Table columns:** Feature (resourceName + screenName) | Transition (StateBadge oldState → arrow → StateBadge newState) | When (relative time)

**Pagination:** same component/pattern as Features

### Dashboard wiring
- "View all transitions" link → `/apps/:appId/alerts` (Transitions page, no filter)
- "Manage all" link (Dead Features panel) → `/apps/:appId/features?state=DEAD`

---

## 6. Export CSV Filename

In both `Dashboard.tsx` and `Features.tsx`, change:
```ts
a.download = 'features.csv'
```
to:
```ts
a.download = `${activeApp.name}-features.csv`
```

`activeApp` is already available from `useApp()` in both pages.

---

## 7. Settings Page Expansion

Four cards, in order:

### Card 1: SDK Integration (existing, unchanged)
The current code snippet card stays as-is.

### Card 2: Classification Thresholds (new)
Two number inputs with save button:
- **Dead threshold:** "Mark a feature as Dead after X days of zero interactions" (default: 30)
- **Dormant threshold:** "Mark a feature as Dormant after X days below 1% interaction rate" (default: 14)

Save calls `PATCH /apps/:appId` with `{ deadThresholdDays, dormantThresholdDays }`.

Requires adding `deadThresholdDays Int @default(30)` and `dormantThresholdDays Int @default(14)` to the `App` model in `schema.prisma`. The aggregation/cron service reads these fields per-app instead of using hardcoded constants.

### Card 3: Data Retention (new)
One number input with save button:
- **Raw event retention:** "Keep raw events for X days" (default: 7)

Save calls `PATCH /apps/:appId` with `{ eventRetentionDays }`.

Requires adding `eventRetentionDays Int @default(7)` to the `App` model. The cleanup job reads this per-app.

### Card 4: Danger Zone (new)
Two actions:
- **Rename app** — inline text input pre-filled with current name, save on blur or Enter. Calls existing `PATCH /apps/:appId` (rename endpoint already exists).
- **Delete app** — "Delete this app" red button, opens the existing `DeleteModal`. Navigates to `/apps` after deletion.

---

## 8. Docs Page

Static content — no new API endpoints. Single page with a sticky left sidebar for navigation and four content sections.

### Sidebar links
- Getting Started
- SDK Integration
- API Reference
- How Classification Works

### Section 1: Getting Started
Step-by-step: register account → create app → copy API key → init SDK in Android project → verify events appear in Dashboard.

### Section 2: SDK Integration
- `implementation("com.github.featurepulse:sdk:1.0.0")` Gradle snippet
- `FeaturePulse.init()` with all `PulseConfig.Builder` options documented (API key, app ID, flush interval, buffer size)
- How touch interception works (Window.Callback proxy, no code changes required in the app)
- How fingerprinting works (SHA256 of screenName + resourceName, fallback to hierarchyPath)

### Section 3: API Reference
Table of all REST endpoints:

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | — | Create account |
| POST | /auth/login | — | Login, returns token + apps |
| PATCH | /auth/me/password | JWT | Change password |
| DELETE | /auth/me | JWT | Delete account |
| GET | /apps | JWT | List apps |
| POST | /apps | JWT | Create app |
| PATCH | /apps/:appId | JWT | Rename / update settings |
| DELETE | /apps/:appId | JWT | Delete app |
| GET | /apps/:appId/dashboard | JWT | Counts + recent transitions |
| GET | /apps/:appId/features | JWT | Paginated features list |
| GET | /apps/:appId/features/:id | JWT | Single feature detail |
| GET | /apps/:appId/transitions | JWT | Paginated transition log |
| GET | /apps/:appId/export | JWT | Export features as CSV |
| POST | /api/v1/cron | JWT | Trigger classification run |

### Section 4: How Classification Works
- State machine diagram: THRIVING → DECLINING → DORMANT → DEAD (inline SVG or styled HTML)
- Rules for each transition:
  - THRIVING: interaction rate > 5% and stable or growing
  - DECLINING: interaction rate dropping > 20% week-over-week
  - DORMANT: interaction rate < 1% for 14+ days
  - DEAD: zero interactions across all users for 30+ days
  - Recovery to THRIVING: interaction rate rises back above 5%
- Cron schedule: nightly at 02:00 UTC (or triggered manually via "Run Cron Now")
- What "interaction rate" means: % of active sessions in which the feature was touched
- What "ignored" means: feature excluded from Dead count and cron reclassification

---

## Files Affected

### Portal
- `pages/Account.tsx` — second confirm modal
- `pages/Apps.tsx` — card-as-link, second confirm modal in DeleteModal
- `pages/Features.tsx` — pill filter, sort, URL state init, Run Cron
- `pages/Dashboard.tsx` — update two link targets, export filename, extract useCron
- `pages/Alerts.tsx` → `pages/Transitions.tsx` (rename + rewrite); route path `alerts` → `transitions` in `App.tsx`
- `pages/Settings.tsx` — three new cards
- `pages/Docs.tsx` — full rewrite with four sections
- `components/Layout.tsx` — last-app localStorage, nav item rename Alerts→Transitions
- `hooks/useCron.ts` — new shared hook (extracted from Dashboard)
- `api/client.ts` — add `getTransitions()` method, add `sort` param to `getFeatures()`
- `context/AppContext.tsx` — write `fp_last_app_id` on route change

### Server
- `routes/dashboard.ts` — add `GET /apps/:appId/transitions` endpoint
- `routes/features.ts` (or equivalent) — add `sort` param handling
- `routes/apps.ts` — accept `deadThresholdDays`, `dormantThresholdDays`, `eventRetentionDays` in PATCH
- `services/aggregation.ts` — read per-app thresholds instead of hardcoded constants
- `prisma/schema.prisma` — add three fields to `App` model + migration
