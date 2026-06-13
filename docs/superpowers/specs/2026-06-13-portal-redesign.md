# Portal UI/UX Redesign — Design Spec

**Date:** 2026-06-13  
**Status:** Approved  
**Scope:** Full redesign of all FeaturePulse portal pages to match the `portal-dashboard-mockup.html` design language.

---

## 1. Goals

- Replace the current top-navbar + inline-styles layout with a polished sidebar layout that matches `portal-dashboard-mockup.html` exactly.
- Apply Inter + JetBrains Mono fonts, indigo/slate color palette, and Tailwind CSS throughout.
- Add Chart.js charts on Dashboard and Feature Detail (wired to real API data, with realistic placeholder fallbacks).
- Redesign all pages: Login, Dashboard, Features, Feature Detail, Alerts, Settings, + new Account and Docs (coming soon).
- Keep all existing API integrations and business logic intact — this is a pure UI/UX change.

---

## 2. Design Tokens (Tailwind Config)

Extend `tailwind.config.js` with these custom values:

```js
colors: {
  indigo: {
    DEFAULT: '#4F46E5',
    hover:   '#4338CA',
    light:   '#EEF2FF',
  },
  green:  { DEFAULT: '#16A34A', light: '#DCFCE7' },
  yellow: { DEFAULT: '#CA8A04', light: '#FEF9C3' },
  orange: { DEFAULT: '#EA580C', light: '#FFEDD5' },
  red:    { DEFAULT: '#DC2626', light: '#FEE2E2' },
},
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
},
borderRadius: {
  card: '14px',
},
```

Google Fonts loaded in `index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
```

A `src/design-tokens.ts` file exports hex values for use in Chart.js (which cannot consume Tailwind classes):
```ts
export const COLORS = {
  indigo: '#4F46E5',
  green:  '#16A34A',
  yellow: '#CA8A04',
  orange: '#EA580C',
  red:    '#DC2626',
  slate300: '#CBD5E1',
}

export const STATE_COLORS: Record<string, string> = {
  THRIVING: '#16A34A',
  DECLINING: '#CA8A04',
  DORMANT:  '#EA580C',
  DEAD:     '#DC2626',
}
```

Icon: `icon.png` copied from project root to `portal/public/icon.png` — referenced as `/icon.png` in JSX.

---

## 3. Architecture Change: Layout Shell

### Current
Each page independently renders `<NavBar />` at the top. NavBar is a horizontal top bar with links.

### New
React Router v6 nested routing. All authenticated routes wrapped in a single `<Layout>` component that renders the sidebar + topbar + `<Outlet>`.

```
App.tsx
├── /login          → <Login />          (no Layout)
└── <Layout>        → sidebar + topbar
    ├── /dashboard  → <Dashboard />
    ├── /features   → <Features />
    ├── /features/:id → <FeatureDetail />
    ├── /alerts     → <Alerts />
    ├── /settings   → <Settings />
    ├── /account    → <Account />
    └── /docs       → <Docs />
```

`NavBar.tsx` is deleted. `Layout.tsx` replaces it.

### Topbar actions
Pages that need topbar action buttons (e.g. "Export CSV" on Features, "Run Cron Now" on Dashboard) pass them via a `TopbarContext`:
- `Layout` reads from `TopbarContext` and renders buttons on the right side of the topbar.
- Pages call `useTopbar({ actions: [...] })` in a `useEffect`.

---

## 4. Layout Component (`src/components/Layout.tsx`)

### Sidebar (252px, fixed height, white, right border `border-slate-200`)

**Logo area** (padding 18px, bottom border):
- `icon.png` 32×32 in a rounded-9px container
- "FeaturePulse" wordmark, 15px, 800 weight, `text-slate-900`

**Nav sections** (padding 12px 10px, scrollable):

Section "Analytics":
- Dashboard (home icon)
- Features (grid icon) — red badge showing count of DEAD features
- Alerts (bell icon) — amber badge showing count of active alerts

Divider (`h-px bg-slate-100 mx-2.5`)

Section "Settings":
- Settings (cog icon)
- Account (person icon)
- Docs (document icon)

Nav item states:
- Default: `text-slate-600`, hover `bg-slate-100 text-slate-900`
- Active: `bg-indigo-light text-indigo font-semibold`

**Footer** (padding 12px 10px, top border):
- App pill: `bg-slate-50 border border-slate-200 rounded-xl p-3` — shows app name (bold, 13px) + package ID (mono, 11px, `text-slate-400`). Clicking navigates to `/settings`.
- User row: initials avatar (`bg-indigo-light text-indigo` circle, 28px), email (`text-slate-500`, truncated), "Log out" link.

The sidebar fetches dead feature count once on mount via `api.getDashboard(appId)` to populate the Features nav badge. The Alerts badge count comes from the same dashboard response if it includes `alertCount`; otherwise the badge is hidden. These counters are not live-updating.

### Topbar (54px, white, bottom border)

- Left: breadcrumb — app name (text-slate-400) / page name (text-slate-700, font-semibold)
- Right: animated sync pill (green dot with CSS breathe animation + "Synced X min ago") + `TopbarContext` action buttons

The sync pill always shows a static "Synced 2 min ago" — no API call needed.

### Main area
`flex-1 overflow-y-auto bg-slate-50` — full remaining width after sidebar. Pages render inside with `p-7` (26px 28px).

---

## 5. Pages

### 5.1 Login / Register (`src/pages/Login.tsx`)

Centered auth card:
- Full-screen background: `bg-slate-50`
- Card: white, `rounded-card shadow-md border border-slate-200`, 400px wide, centered with `mt-20 mx-auto p-8`
- Logo mark (32px icon.png) + "FeaturePulse" wordmark centered at top
- Tab switcher: "Sign in" / "Register" — `bg-slate-100` pill container, active tab `bg-white shadow-sm rounded`
- Inputs: `border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-indigo focus:border-indigo`
- Primary CTA: full-width, `bg-indigo text-white font-semibold rounded-lg py-2.5 hover:bg-indigo-hover`
- Error message: `text-red text-sm`
- All existing logic (login/register API calls, token storage, redirect) unchanged.

### 5.2 Dashboard (`src/pages/Dashboard.tsx`)

**Page header:**
- Title "Feature Health" (24px, 800 weight, `text-slate-900`)
- Meta line: app name · package ID · "47 features tracked" (`text-slate-500 text-sm`)
- Health score row: "Health score" label + gradient progress bar (red→yellow→green, width = `thriving/total * 100%`) + percentage + note "X features degraded in last 30 days"

Health score = `(thriving / total) * 100`. Color of percentage: green if >70%, yellow if 40–70%, red if <40%.

**Stat cards row** (4-column grid, `gap-3.5`):
- Total Features — slate icon, slate number, delta chip neutral
- Dead — red border `border-red/30`, red value, red delta chip
- Declining — yellow border, yellow value
- Thriving — green border, green value

Each card: white, `rounded-card border hover:shadow-md hover:-translate-y-px transition` with icon square (28px, colored bg), 36px/900-weight value, delta chip.

Delta chips are omitted — the dashboard API does not return week-over-week deltas. Cards show counts only.

**Charts row** (2/3 + 1/3 grid):
- **Line chart** (`LineChart` component): "Interaction Rate — Last 30 Days". Tab switcher All/Dead/Declining. Chart.js line chart, 196px tall. Data from `api.getDashboard()` aggregates. Placeholder: use the same data arrays from the mockup if API returns empty.
- **Donut chart** (`DonutChart` component): "State Distribution". Chart.js doughnut, 74% cutout, 148px tall. Legend below with swatch, label, count, percentage.

**Bottom grid** (1.15fr + 1fr):
- **Recent State Changes table**: Feature (mono name + screen sub-text), Transition (from-badge → arrow → to-badge), When (relative time). "View all" link → `/features`.
- **Dead Features list**: Scrollable list, each row has red-X thumb icon, feature name (mono), location (screen · type), days dead (red, bold), Ignore button. "Manage all" link → `/features?state=DEAD`.

All data from `api.getDashboard(appId)`. On error or empty: show placeholder rows from the mockup data.

**Topbar actions:** "Run Cron Now" (ghost button, calls `POST /api/v1/cron`) + "Export CSV" (primary button, same as Features export).

### 5.3 Features (`src/pages/Features.tsx`)

**Page header:** "Features" title + state filter (styled `<select>` with `border-slate-200 rounded-lg`). Export CSV is a topbar action (injected via `TopbarContext`), not in the page header.

**Table** (`FeatureTable` component):
- Full width, `border border-slate-200 rounded-card overflow-hidden`
- `thead`: 10px uppercase, `text-slate-400`, `bg-slate-50`, bottom border
- `tbody`: rows are clickable (navigate to `/features/:id`), hover `bg-slate-50`
- Columns: Feature (mono name + screen sub), Type, State (StateBadge), Last used (relative), Ignored (toggle), Actions (Ignore/Unignore button)
- Empty state: centered message "No features yet"

**Pagination:** centered row of page number buttons, active page indigo fill.

**Topbar actions:** Export CSV (primary button, same href as current `api.exportFeatures()`).

Page content is full width within the main area — no `max-width` constraint.

### 5.4 Feature Detail (`src/pages/FeatureDetail.tsx`)

Full width layout:
- Back button (breadcrumb style: `← Features` link, no border)
- Hero row: resource name in `font-mono text-2xl font-semibold text-slate-900` + state badge + Ignore button (ghost)
- Sub-text: `screenName · elementType` in `text-slate-500 text-sm`

**Interaction rate chart:** `LineChart` component, 30 days, wired to `api.getTimeline(featureId, 30)`. Placeholder: flat line at 0% if no data.

**Metadata card:** key-value rows (Last Interaction, First Seen, Element Type, Screen) — `border-b border-slate-50`, label `text-slate-500`, value `text-slate-800 font-semibold`. "Last Interaction" value is red if state is DEAD.

### 5.5 Alerts (`src/pages/Alerts.tsx`)

Max-width 680px centered within the full-width area:
- Section header "Webhook Configuration"
- URL input (`font-mono`, full width) with Save + Test buttons side by side
- Save feedback: inline "✓ Saved" text for 3s (green)
- Test feedback: inline result text (green/red)

Divider, then "Alert Triggers" section with three styled checkboxes (custom checkbox using Tailwind, not browser default).

All existing logic unchanged.

### 5.6 Settings (`src/pages/Settings.tsx`)

Max-width 680px centered:
- App ID + API Key inputs (`font-mono`) with labels
- Save button (indigo primary)
- SDK Integration code block: `bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-sm text-slate-700 overflow-x-auto`

All existing logic unchanged.

### 5.7 Account (coming soon)

Centered placeholder card:
- Indigo person icon (40px)
- "Account" heading
- "Account management is coming soon." subtext in `text-slate-500`

### 5.8 Docs (coming soon)

Centered placeholder card:
- Indigo document icon (40px)
- "Documentation" heading
- "Full SDK and API docs are coming soon." subtext

---

## 6. Components

### Rewritten (same props API, new visual)

| Component | Change |
|-----------|--------|
| `StateBadge` | Tailwind color map: THRIVING=green, DECLINING=yellow, DORMANT=orange, DEAD=red. Pill shape, 10.5px, bold. |
| `StatCard` | Full mockup-match: icon square, 36px/900-weight number, delta chip, hover lift. |
| `FeatureTable` | Proper `<table>` with Tailwind thead/tbody, mono cells, clickable rows. |
| `TimelineChart` | Upgraded from basic canvas to Chart.js via `LineChart` component. |

### Deleted
- `NavBar.tsx` — replaced by `Layout.tsx`

### New

| Component | Purpose |
|-----------|---------|
| `Layout.tsx` | Sidebar + topbar shell + Outlet |
| `LineChart.tsx` | Reusable Chart.js line chart (used on Dashboard + Feature Detail) |
| `DonutChart.tsx` | Chart.js doughnut for state distribution |
| `DeadFeaturesList.tsx` | Dead features panel on Dashboard |
| `TopbarContext.tsx` | Context + hook for pages to inject topbar action buttons |

---

## 7. Dependencies

- **`chart.js`** — already used via CDN in mockup; install as npm package: `npm install chart.js react-chartjs-2`
- **Tailwind CSS** — install + configure: `npm install -D tailwindcss @tailwindcss/vite`
- **Google Fonts** — loaded via `<link>` in `index.html`, no npm package

No other new dependencies.

---

## 8. File Changes Summary

```
portal/
├── public/
│   └── icon.png                  ← copied from project root
├── index.html                    ← add Google Fonts link
├── tailwind.config.js            ← new (design tokens)
├── src/
│   ├── design-tokens.ts          ← new (hex values for Chart.js)
│   ├── index.css                 ← replace with Tailwind directives
│   ├── App.css                   ← delete
│   ├── App.tsx                   ← update routing (nested Layout)
│   ├── components/
│   │   ├── Layout.tsx            ← new (sidebar + topbar + Outlet)
│   │   ├── LineChart.tsx         ← new
│   │   ├── DonutChart.tsx        ← new
│   │   ├── DeadFeaturesList.tsx  ← new
│   │   ├── TopbarContext.tsx     ← new
│   │   ├── StateBadge.tsx        ← rewrite
│   │   ├── StatCard.tsx          ← rewrite
│   │   ├── FeatureTable.tsx      ← rewrite
│   │   ├── TimelineChart.tsx     ← rewrite (delegates to LineChart)
│   │   └── NavBar.tsx            ← delete
│   └── pages/
│       ├── Login.tsx             ← rewrite (visual only)
│       ├── Dashboard.tsx         ← rewrite
│       ├── Features.tsx          ← rewrite
│       ├── FeatureDetail.tsx     ← rewrite
│       ├── Alerts.tsx            ← rewrite (visual only)
│       ├── Settings.tsx          ← rewrite (visual only)
│       ├── Account.tsx           ← new (coming soon)
│       └── Docs.tsx              ← new (coming soon)
```

---

## 9. What Does NOT Change

- All API calls in `src/api/client.ts` — untouched
- All business logic (auth flow, ignore feature, webhook save/test, settings save) — untouched
- Server and SDK code — untouched
- React Router routes structure — only the layout wrapping changes
