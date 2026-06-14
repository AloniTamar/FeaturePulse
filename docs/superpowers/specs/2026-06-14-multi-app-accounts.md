# Multi-App Accounts Design

**Date:** 2026-06-14
**Status:** Approved

## Overview

Allow a single FeaturePulse account to own multiple apps. Each app has its own SDK
integration, event stream, and portal view. App context lives in the URL
(`/apps/:appId/...`) — not in localStorage or server-side session state.

---

## 1. Data Model

### Schema changes (`server/prisma/schema.prisma`)

Replace `App.ownerEmail: String` with a proper FK to `User`:

```prisma
model App {
  id          String   @id @default(uuid())
  name        String
  packageName String
  apiKey      String   @unique
  apiKeyHash  String
  userId      String                  // replaces ownerEmail
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())
  config      Json     @default("{}")
  features    Feature[]
  rawEvents   RawEvent[]
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
  apps         App[]                  // new reverse relation
}
```

**Migration steps:**
1. Add `userId` column (nullable temporarily)
2. Backfill: `UPDATE "App" SET "userId" = u.id FROM "User" u WHERE u.email = "App"."ownerEmail"`
3. Set `userId` NOT NULL
4. Drop `ownerEmail` column

No changes to `Feature`, `RawEvent`, `DailyAggregate`, or `StateTransition` — all are already keyed by `appId`.

---

## 2. Server API

### Registration — removes app creation

**Before:** `POST /auth/register` accepted `{ email, password, appName, packageName }` and created a User + App atomically.

**After:** `POST /auth/register` accepts only `{ email, password }`. Creates a User, returns a JWT. No app is created.

### Login — returns apps list

**Before:** `POST /auth/login` returned `{ token, appId, appName, pkgName, apiKey }` (first app only).

**After:** Returns `{ token, apps: [{ id, name, packageName, apiKey }] }`. Portal redirects to the first app's dashboard, or to `/apps` if the list is empty.

### App management endpoints (all require `jwtAuth`, scoped to authenticated user)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/apps` | List authenticated user's apps |
| `POST` | `/api/v1/apps` | Create new app — body: `{ name, packageName }` |
| `PATCH` | `/api/v1/apps/:appId` | Rename app — body: `{ name }` |
| `DELETE` | `/api/v1/apps/:appId` | Delete app + cascade all features/events |

`GET /api/v1/apps` response shape per app: `{ id, name, packageName, apiKey, createdAt, featureCount }`.
The `featureCount` is fetched via Prisma `_count: { features: true }`.

`DELETE /api/v1/apps/:appId` must delete child records in order before deleting the app (Prisma
defaults to RESTRICT, not CASCADE): `StateTransition` → `DailyAggregate` → `RawEvent` → `Feature` → `App`.
The Prisma schema should add `onDelete: Cascade` to all child relations of `App` and `Feature` to
make this automatic, rather than relying on manual ordering in the route handler.

"Delete account" on the Account page cascades the same chain via `User → App → ...` — same `onDelete: Cascade`
on `User.apps` handles this.

### Ownership guard

All existing `/:appId/*` routes must verify that the app belongs to `req.userId`
before serving data. Return `403` if the app exists but belongs to another user,
`404` if it doesn't exist.

### `GET /api/v1/apps` (existing)

Currently returns all apps with no user filter. Must be scoped to `req.userId`.

---

## 3. Portal Routing

App context moves from localStorage into the URL. All data routes are prefixed
with `/apps/:appId`.

### Route table

| New path | Old path | Notes |
|----------|----------|-------|
| `/login` | `/login` | Unchanged |
| `/apps` | — | New: Apps management page |
| `/account` | `/account` | User-level, no appId |
| `/apps/:appId/dashboard` | `/dashboard` | |
| `/apps/:appId/features` | `/features` | |
| `/apps/:appId/features/:featureId` | `/features/:featureId` | |
| `/apps/:appId/alerts` | `/alerts` | |
| `/apps/:appId/settings` | `/settings` | SDK config for this app |

### `/*` catch-all

Redirects to `/apps` instead of `/dashboard`.

### Active app resolution

`useParams()` from React Router provides `appId` on every data page.
All `localStorage.getItem('fp_appId')` calls are removed.

The `fp_appId`, `fp_appName`, `fp_pkgName`, `fp_apiKey` localStorage keys
are removed entirely. Only `fp_token` and `fp_email` remain.

### Layout with no active app

`/apps` and `/account` share the same Layout component but have no `:appId` in their URL.
The Layout sidebar must handle `appId` being `undefined` — in that case the app switcher
shows the app list with no item highlighted, and the Analytics/App nav group items are
disabled or hidden (since there is no active app to show data for).

---

## 4. Portal UX

### 4a. Apps management page (`/apps`)

A standalone page — no app context required, accessible from the sidebar.

**Content:**
- App cards, each showing: name, package name, API key (masked + copy button), created date, feature count
- **Rename:** click pencil icon → name becomes an inline input; confirm with Enter or blur
- **Delete:** red "Delete" button → confirmation modal requiring the user to type the app name to confirm; on confirm, deletes app + all data
- **New App** button (top-right) → modal with `name` and `packageName` fields; on create, navigates to `/apps/:newAppId/dashboard`
- **Empty state:** centered illustration + "Create your first app to get started" CTA that opens the New App modal

### 4b. Sidebar app switcher

The current app "slot" (footer button showing appName + pkgName) becomes a popover trigger.

**Popover content:**
- List of all user apps; active app is highlighted (indigo left-border or check mark)
- Clicking an app navigates to `/apps/:appId/dashboard`
- "+ New App" shortcut at the bottom opens the same New App modal as the Apps page

**Sidebar nav groups:**

```
Analytics
  Dashboard
  Features
  Alerts

App
  Settings     ← SDK config for the active app

Global
  Apps         ← manage all apps
  Account      ← user profile / password / danger zone
```

### 4c. No-app guard

After login with zero apps:
- Redirect to `/apps` (empty state with CTA)
- Any navigation to `/apps/:appId/*` with an unrecognized or unauthorized appId shows an inline error ("App not found")

### 4d. Account page (`/account`)

User-level, no appId. Sections:
- Email display
- Password change form
- Danger zone: "Delete account" (deletes user + all their apps + all data, requires confirmation)

### 4e. App Settings page (`/apps/:appId/settings`)

Unchanged in content (SDK config toggles, sampling rate, excluded screens).
Now lives under the appId route namespace.

---

## 5. What Does NOT Change

- SDK auth: each app still has its own `apiKey` — no SDK changes required
- `Feature`, `RawEvent`, `DailyAggregate`, `StateTransition` schemas — all already appId-keyed
- Classification cron — already iterates over all features regardless of app
- Portal API client base URL — unchanged
