# FeaturePulse Presentation Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `FeaturePulse_Presentation.html` from 20 slides to 10, clean minimal "Spotlight" design with all instructor-required content preserved.

**Architecture:** Single self-contained HTML file. Full rewrite — keep the CSS variables/fonts/nav/JS skeleton from the existing file, add 3 new utility classes, replace all 20 slide blocks with 10 new ones. No external dependencies beyond Google Fonts.

**Tech Stack:** HTML5, CSS3 (Grid, Flexbox), Vanilla JS, Google Fonts (Inter + JetBrains Mono)

> **Note:** This directory is not a git repo. Run `git init && git add . && git commit -m "initial"` once before Task 1 if you want version control. Commit steps in each task are optional but recommended.

---

### Task 1: CSS Foundation — Add New Utility Classes

The existing CSS in `FeaturePulse_Presentation.html` is mostly correct (same colors, fonts, nav). This task adds only the 3 missing utility classes needed by the new slides.

**Files:**
- Modify: `FeaturePulse_Presentation.html` (the `<style>` block)

- [ ] **Step 1: Open `FeaturePulse_Presentation.html` and locate the end of the `<style>` block**

Find the line: `</style>` (line ~182). Insert the following CSS immediately before it:

```css
/* ── YOU / AUTO step labels (Slide 4) ── */
.step-label{display:inline-block;padding:2px 9px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-bottom:5px}
.sl-you{background:var(--indigo);color:#fff}
.sl-auto{background:#E2E8F0;color:var(--text2)}

/* ── stat anchor (Slide 2) ── */
.stat-anchor{text-align:center;padding:20px 0}
.stat-anchor .snum{font-size:68px;font-weight:900;line-height:1}
.stat-anchor .slbl{font-size:15px;font-weight:600;color:var(--text);margin-top:8px;line-height:1.4}
.stat-anchor .ssrc{font-size:12px;color:var(--text2);font-style:italic;margin-top:5px}

/* ── 4-column grid (Slide 6) ── */
.cols4{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;flex:1;align-items:start}
```

- [ ] **Step 2: Open the file in a browser to confirm it still looks correct** (existing slides should be unchanged since we only added new CSS classes)

---

### Task 2: Wipe Existing Slides, Add Slide 1 (Title) and Slide 2 (Problem)

**Files:**
- Modify: `FeaturePulse_Presentation.html` (the deck div — slides 1–20)

- [ ] **Step 1: Delete all 20 existing slide blocks**

Find the entire content between `<div class="deck" id="deck">` and `</div><!-- /deck -->` and replace it with just the two new slides below plus a placeholder comment. 

Replace the inner content of `<div class="deck" id="deck">` with:

```html

<!-- ══ SLIDE 1 — Title ══ -->
<div class="slide slide-title active" data-index="0">
  <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px">
    <div style="width:56px;height:56px;background:var(--indigo);border-radius:14px;display:flex;align-items:center;justify-content:center">
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M3 16 L8 16 L12 7 L16 25 L20 11 L24 16 L29 16" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <span style="font-size:26px;font-weight:800;color:var(--text)">FeaturePulse</span>
  </div>
  <h1>Dead Feature<br>Detector SDK</h1>
  <p class="tagline">Automatically detect unused UI elements in Android apps.<br>Zero instrumentation. One line of code.</p>
  <div style="display:flex;gap:10px;margin-top:32px;flex-wrap:wrap">
    <span class="pill p-g">THRIVING</span>
    <span class="pill p-y">DECLINING</span>
    <span class="pill p-o">DORMANT</span>
    <span class="pill p-r">DEAD</span>
  </div>
</div>

<!-- ══ SLIDE 2 — Problem ══ -->
<div class="slide" data-index="1">
  <div class="tag">The Problem</div>
  <h2>Most features ship. Most are never used.<br>Nobody knows which ones.</h2>
  <div class="cols3" style="margin-bottom:28px">
    <div class="stat-anchor">
      <div class="snum" style="color:var(--r)">80%</div>
      <div class="slbl">of features are rarely or<br>never used</div>
      <div class="ssrc">Pendo, 2019 — 615 products</div>
    </div>
    <div class="stat-anchor">
      <div class="snum" style="color:var(--o)">$29.5B</div>
      <div class="slbl">wasted annually building<br>features users ignore</div>
      <div class="ssrc">Pendo, 2019</div>
    </div>
    <div class="stat-anchor">
      <div class="snum" style="color:var(--indigo)">Zero</div>
      <div class="slbl">tools auto-detect dead UI<br>elements on Android native</div>
      <div class="ssrc">&nbsp;</div>
    </div>
  </div>
  <ul class="blist">
    <li>Every existing analytics tool requires <strong>manual per-element developer tagging</strong></li>
    <li>Dead features bloat APK size, confuse users, and waste <strong>ongoing maintenance</strong></li>
  </ul>
</div>

```

- [ ] **Step 2: Update the nav counter in the JS** — find `'1 / 20'` and replace with `'1 / 10'` (temporary until Task 8 where we'll fix the JS properly)

The counter element is: `<span class="counter" id="ctr">1 / 20</span>` → change to `1 / 10`

- [ ] **Step 3: Verify in browser** — open the file. Slide 1 should show the title with the FeaturePulse logo, big "Dead Feature Detector SDK" headline, tagline, and 4 colored state pills. Slide 2 should show 3 large stat numbers (80%, $29.5B, Zero) in a 3-column row, with 2 bullet points below.

---

### Task 3: Slides 3 and 4 — Solution + How It Works

**Files:**
- Modify: `FeaturePulse_Presentation.html` (append inside deck div)

- [ ] **Step 1: Insert Slide 3 (The Solution) after Slide 2's closing `</div>`**

```html
<!-- ══ SLIDE 3 — Solution ══ -->
<div class="slide" data-index="2">
  <div class="tag">The Solution</div>
  <h2>One SDK. Three components. Complete visibility.</h2>
  <div class="cols3" style="margin-bottom:20px">
    <div class="card card-top">
      <div class="cat-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
      </div>
      <h3>Android SDK</h3>
      <p>Auto-discovers all interactive UI elements. Zero manual tagging. Plugs into any Android app in one line.</p>
      <div class="cb" style="margin-top:12px;font-size:12px">FeaturePulse.<span class="fn">init</span>(this)</div>
    </div>
    <div class="card card-top">
      <div class="cat-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
      </div>
      <h3>Backend API</h3>
      <p>Node.js + Express + PostgreSQL. Receives batched events, runs nightly classification, serves the portal.</p>
      <div class="cb" style="margin-top:12px;font-size:12px">POST /api/v1/events/batch</div>
    </div>
    <div class="card card-top">
      <div class="cat-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      </div>
      <h3>Web Portal</h3>
      <p>React dashboard. Feature health, dead feature lists, interaction timelines, decay trends, webhook alerts.</p>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <span class="pill p-g">THRIVING</span>
        <span class="pill p-r">DEAD</span>
      </div>
    </div>
  </div>
  <div class="note">
    <p>Firebase tells you what users click. FeaturePulse tells you what they <em>never</em> do.</p>
  </div>
</div>
```

- [ ] **Step 2: Insert Slide 4 (How It Works) after Slide 3's closing `</div>`**

```html
<!-- ══ SLIDE 4 — How It Works ══ -->
<div class="slide" data-index="3">
  <div class="tag">How It Works</div>
  <h2>You write one line. We handle the rest.</h2>
  <div class="steps" style="flex:1;max-width:780px;justify-content:center">
    <div class="step">
      <div class="step-n">1</div>
      <div class="step-c">
        <span class="step-label sl-you">YOU</span>
        <h4>Initialize</h4>
        <p><code>FeaturePulse.init(this)</code> — SDK registers lifecycle callbacks via Android OS.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-n">2</div>
      <div class="step-c">
        <span class="step-label sl-auto">AUTO</span>
        <h4>Discover</h4>
        <p>View tree scanned on every screen open. All interactive elements fingerprinted automatically.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-n">3</div>
      <div class="step-c">
        <span class="step-label sl-auto">AUTO</span>
        <h4>Track</h4>
        <p>Touch events intercepted: TAP, LONG_PRESS, SWIPE, IMPRESSION. No host app changes required.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-n">4</div>
      <div class="step-c">
        <span class="step-label sl-auto">AUTO</span>
        <h4>Batch &amp; Sync</h4>
        <p>Events buffer locally (max 500). One HTTP call every 30 min via WorkManager — battery-safe.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-n">5</div>
      <div class="step-c">
        <span class="step-label sl-auto">AUTO</span>
        <h4>Classify</h4>
        <p>Nightly server job classifies each feature: THRIVING / DECLINING / DORMANT / DEAD.</p>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Verify in browser** — navigate to slides 3 and 4. Slide 3: three equal-width cards with top indigo border, icon, name, description, code/endpoint. Slide 4: vertical 5-step list, each step has a numbered circle, a "YOU" (indigo) or "AUTO" (gray) label, bold step name, and one sentence.

---

### Task 4: Slides 5 and 6 — SDK Public API + Internal Functions

**Files:**
- Modify: `FeaturePulse_Presentation.html` (append inside deck div)

- [ ] **Step 1: Insert Slide 5 (SDK Public API) after Slide 4's closing `</div>`**

```html
<!-- ══ SLIDE 5 — SDK Public API ══ -->
<div class="slide" data-index="4">
  <div class="tag">SDK — Developer-Facing API</div>
  <h2>Everything a developer needs. Nothing they don't.</h2>
  <div class="cols2">
    <div>
      <p style="font-size:12px;font-weight:700;color:var(--indigo);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">Initialization &amp; Config</p>
      <div class="cb">
<span class="fn">FeaturePulse</span>.init(application)
<span class="fn">FeaturePulse</span>.init(application, config)

<span class="fn">PulseConfig</span>.Builder()
  .setApiKey(<span class="str">"fp_xxxxx"</span>)
  .setBatchSize(<span class="str">500</span>)
  .setSyncInterval(<span class="str">30</span>, MINUTES)
  .setExcludedScreens(...)
  .setEnabled(<span class="str">true</span>)   <span class="cmt">// kill switch</span>
  .build()
      </div>
    </div>
    <div>
      <p style="font-size:12px;font-weight:700;color:var(--indigo);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">Manual Controls</p>
      <div class="cb" style="margin-bottom:14px">
<span class="fn">FeaturePulse</span>.pause()     <span class="cmt">// stop temporarily</span>
<span class="fn">FeaturePulse</span>.resume()
<span class="fn">FeaturePulse</span>.flush()     <span class="cmt">// force send</span>
<span class="fn">FeaturePulse</span>.disable()   <span class="cmt">// GDPR opt-out</span>
<span class="fn">FeaturePulse</span>.ignore(viewId)
<span class="fn">FeaturePulse</span>.ignoreScreen(name)
<span class="fn">FeaturePulse</span>.setDebugMode(<span class="str">true</span>)
      </div>
      <div class="note">
        <p style="font-size:15px">Only 2 Android permissions required — <code>INTERNET</code> + <code>ACCESS_NETWORK_STATE</code></p>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Insert Slide 6 (Internal Functions) after Slide 5's closing `</div>`**

```html
<!-- ══ SLIDE 6 — Internal Functions ══ -->
<div class="slide" data-index="5">
  <div class="tag">SDK — Internal Library Functions</div>
  <h2>Under the hood — four layers of internal logic.</h2>
  <div class="cols4">
    <div class="card">
      <p style="font-size:11px;font-weight:700;color:var(--indigo);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">SDK Lifecycle</p>
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:2.1;color:#334155">
        registerLifecycleCallbacks()<br>
        onActivityResumed()<br>
        onFragmentResumed()
      </div>
    </div>
    <div class="card">
      <p style="font-size:11px;font-weight:700;color:var(--indigo);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">View &amp; Fingerprinting</p>
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:2.1;color:#334155">
        scanViewTree(rootView)<br>
        isInteractiveView(view)<br>
        generateFingerprint()<br>
        computeHash()
      </div>
    </div>
    <div class="card">
      <p style="font-size:11px;font-weight:700;color:var(--indigo);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">Event Recording &amp; Sync</p>
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:2.1;color:#334155">
        recordInteraction()<br>
        recordImpression()<br>
        addToBuffer(event)<br>
        flushBuffer()<br>
        sendBatch(events)
      </div>
    </div>
    <div class="card">
      <p style="font-size:11px;font-weight:700;color:var(--indigo);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">Server &amp; Portal</p>
      <div style="font-family:'JetBrains Mono',monospace;font-size:12px;line-height:2.1;color:#334155">
        ingestBatch(appId, events[])<br>
        classifyFeatureState()<br>
        runNightlyAggregation()<br>
        getFeatureList(appId)<br>
        renderDashboard(appId)
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 3: Verify in browser** — Slide 5: two-column layout, left column has init/config code block, right has manual controls code block + note. Slide 6: four equal cards in a row, each with a category label and monospace function list.

---

### Task 5: Slide 7 — Architecture & Data

**Files:**
- Modify: `FeaturePulse_Presentation.html` (append inside deck div)

- [ ] **Step 1: Insert Slide 7 (Architecture & Data) after Slide 6's closing `</div>`**

```html
<!-- ══ SLIDE 7 — Architecture & Data ══ -->
<div class="slide" data-index="6">
  <div class="tag">Architecture &amp; Data Design</div>
  <h2>Built to stay fast at scale — by design.</h2>
  <!-- System diagram -->
  <div style="display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-bottom:28px;padding:20px;background:var(--bg);border-radius:14px">
    <div class="arch-box primary">
      <div class="at">Android SDK</div>
      <div class="as">ViewTree · Buffer · WorkManager</div>
    </div>
    <div style="text-align:center">
      <div style="font-size:11px;color:var(--text2);white-space:nowrap">POST batch events →</div>
      <div style="font-size:11px;color:var(--text2);white-space:nowrap">← GET config</div>
    </div>
    <div class="arch-box primary">
      <div class="at">API Server</div>
      <div class="as">Node.js · Express · Auth</div>
    </div>
    <div style="font-size:20px;color:var(--indigo)">⇌</div>
    <div class="arch-box primary">
      <div class="at">PostgreSQL</div>
      <div class="as">Events · Features · Aggregates</div>
    </div>
    <div style="font-size:11px;color:var(--text2)">↑ REST &nbsp; ↑ reads DB &nbsp; ↑ webhooks</div>
    <div style="display:flex;gap:10px">
      <div class="arch-box"><div class="at">Web Portal</div><div class="as">React</div></div>
      <div class="arch-box"><div class="at">Cron Worker</div><div class="as">Nightly</div></div>
      <div class="arch-box"><div class="at">Webhooks</div><div class="as">Slack · Email</div></div>
    </div>
  </div>
  <!-- 3 data efficiency cards -->
  <div class="cols3">
    <div class="card" style="border-left:3px solid var(--indigo)">
      <h3 style="font-size:16px;margin-bottom:7px">Raw events: 7-day TTL</h3>
      <p style="font-size:15px">Deleted after aggregation. Portal never queries raw events. No unbounded growth.</p>
    </div>
    <div class="card" style="border-left:3px solid var(--indigo)">
      <h3 style="font-size:16px;margin-bottom:7px">Pre-computed daily aggregates</h3>
      <p style="font-size:15px">Portal reads pre-computed rows — instant. No expensive COUNT(*) at request time.</p>
    </div>
    <div class="card" style="border-left:3px solid var(--indigo)">
      <h3 style="font-size:16px;margin-bottom:7px">Features table: 100–500 rows, indexed</h3>
      <p style="font-size:15px">Index on <code>(app_id, state)</code> → dead feature list in &lt; 5ms.</p>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Verify in browser** — Slide 7 should show: top section is the system flow diagram (arch boxes with arrows on a light gray background), bottom section is 3 equal cards with left indigo border each describing a data design decision.

---

### Task 6: Slide 8 — Portal Wireframes

**Files:**
- Modify: `FeaturePulse_Presentation.html` (append inside deck div)

- [ ] **Step 1: Insert Slide 8 (Portal Wireframes) after Slide 7's closing `</div>`**

```html
<!-- ══ SLIDE 8 — Portal Wireframes ══ -->
<div class="slide" data-index="7">
  <div class="tag">Web Portal — Wireframes</div>
  <h2>What the developer actually sees.</h2>
  <div class="cols2" style="gap:28px;flex:1">
    <!-- Dashboard wireframe -->
    <div class="wf">
      <div class="wf-hdr"><span>● Dashboard — MyApp</span></div>
      <div class="wf-body">
        <div class="wf-stats">
          <div class="wf-stat"><div class="n" style="color:var(--text)">342</div><div class="l">Total</div></div>
          <div class="wf-stat"><div class="n" style="color:var(--r)">12</div><div class="l">Dead</div></div>
          <div class="wf-stat"><div class="n" style="color:var(--y)">28</div><div class="l">Declining</div></div>
          <div class="wf-stat"><div class="n" style="color:var(--g)">280</div><div class="l">Thriving</div></div>
        </div>
        <div style="background:var(--bg);border-radius:8px;height:72px;display:flex;align-items:center;justify-content:center;margin-bottom:10px">
          <span style="font-size:12px;color:var(--text2)">Feature Health Distribution Chart</span>
        </div>
        <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:6px">Recent State Changes</div>
        <div class="wf-row"><span>btn_share · ProfileFragment</span><span class="pill p-r" style="font-size:10px;padding:2px 8px">DEAD</span><span style="color:var(--text2)">45d ago</span></div>
        <div class="wf-row"><span>tab_explore · HomeActivity</span><span class="pill p-g" style="font-size:10px;padding:2px 8px">THRIVING</span><span style="color:var(--text2)">today</span></div>
        <div class="wf-row"><span>btn_dark_mode · Settings</span><span class="pill p-o" style="font-size:10px;padding:2px 8px">DORMANT</span><span style="color:var(--text2)">33d ago</span></div>
      </div>
    </div>
    <!-- Feature Detail wireframe -->
    <div class="wf">
      <div class="wf-hdr"><span>● Feature Detail — btn_share</span></div>
      <div class="wf-body">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <div>
            <div style="font-size:17px;font-weight:700;color:var(--text)">btn_share</div>
            <div style="font-size:11px;color:var(--text2)">ProfileFragment · MaterialButton</div>
          </div>
          <span class="pill p-r">DEAD</span>
        </div>
        <div style="background:var(--bg);border-radius:8px;height:72px;display:flex;align-items:center;justify-content:center;margin-bottom:10px">
          <span style="font-size:12px;color:var(--text2)">Interaction Timeline (daily, 30d)</span>
        </div>
        <div class="wf-row"><span>Last Interaction</span><span style="color:var(--r);font-weight:600">Never — 0 taps</span></div>
        <div class="wf-row"><span>First Seen</span><span>Dec 1, 2025</span></div>
        <div class="wf-row"><span>Impressions</span><span>4,201 times shown</span></div>
        <div class="wf-row"><span>Interaction Rate</span><span style="color:var(--r);font-weight:600">0.0%</span></div>
      </div>
    </div>
  </div>
  <p style="font-size:13px;color:var(--text2);text-align:center;margin-top:12px;font-style:italic">Schematics — will be replaced with real portal screenshots once the portal is built.</p>
</div>
```

- [ ] **Step 2: Verify in browser** — Slide 8: two side-by-side wireframe panels. Left shows the Dashboard (4 stat counters, chart placeholder, 3 recent change rows). Right shows Feature Detail (feature name + state pill, timeline placeholder, 4 data rows).

---

### Task 7: Slide 9 — Feasibility Research

**Files:**
- Modify: `FeaturePulse_Presentation.html` (append inside deck div)

- [ ] **Step 1: Insert Slide 9 (Feasibility) after Slide 8's closing `</div>`**

```html
<!-- ══ SLIDE 9 — Feasibility Research ══ -->
<div class="slide" data-index="8">
  <div class="tag">Feasibility Research</div>
  <h2>Every technical decision is backed by existing Android APIs.</h2>
  <div style="flex:1;overflow:auto;margin-bottom:20px">
    <table>
      <thead><tr><th>API</th><th>Purpose</th><th>Available Since</th><th>Used For</th></tr></thead>
      <tbody>
        <tr><td><code style="font-size:12px">registerActivityLifecycleCallbacks()</code></td><td>Detect all screen opens</td><td>API 14</td><td>Auto-discovery trigger</td></tr>
        <tr><td><code style="font-size:12px">Window.Callback (Proxy)</code></td><td>Intercept all touch events</td><td>API 1</td><td>Touch interception</td></tr>
        <tr><td><code style="font-size:12px">View.getGlobalVisibleRect()</code></td><td>Check if view is on screen</td><td>API 1</td><td>Impression tracking</td></tr>
        <tr><td><code style="font-size:12px">ViewGroup.getChildAt()</code></td><td>Traverse view tree</td><td>API 1</td><td>Auto-discovery scan</td></tr>
        <tr><td><code style="font-size:12px">Resources.getResourceEntryName()</code></td><td>Get resource name</td><td>API 1</td><td>Fingerprinting</td></tr>
        <tr><td><code style="font-size:12px">WorkManager</code></td><td>Battery-safe background sync</td><td>Jetpack</td><td>Batch upload scheduling</td></tr>
      </tbody>
    </table>
  </div>
  <div class="cols2">
    <div class="card">
      <p style="font-size:13px;font-weight:700;color:var(--r);margin-bottom:5px">RecyclerView items not in DOM until scrolled</p>
      <p style="font-size:14px">Observe <code>AdapterDataObserver</code> — scan new ViewHolders as they bind into view.</p>
    </div>
    <div class="card">
      <p style="font-size:13px;font-weight:700;color:var(--r);margin-bottom:5px">View has no resource ID</p>
      <p style="font-size:14px">Fallback fingerprint: class name + hierarchy path. Resource name takes priority when available.</p>
    </div>
    <div class="card">
      <p style="font-size:13px;font-weight:700;color:var(--r);margin-bottom:5px">App killed unexpectedly</p>
      <p style="font-size:14px">Persist buffer to SharedPreferences on <code>onTrimMemory()</code>. Restore on next app launch.</p>
    </div>
    <div class="card">
      <p style="font-size:13px;font-weight:700;color:var(--r);margin-bottom:5px">Battery drain risk</p>
      <p style="font-size:14px">WorkManager + 30-min batching = 1 HTTP call per 30 min maximum. No polling, no background threads.</p>
    </div>
  </div>
</div>
```

> Note: The `cols2` 4-card grid will auto-flow into a 2×2 layout — CSS Grid does this by default when you have 4 children in a `cols2` container.

- [ ] **Step 2: Verify in browser** — Slide 9: top section is the API table with 6 rows (monospace API names). Bottom section is 4 challenge cards in a 2×2 grid, each with a red challenge label + solution sentence.

---

### Task 8: Slide 10 — Use Cases + Fix Navigation JS

**Files:**
- Modify: `FeaturePulse_Presentation.html` (append last slide + fix JS)

- [ ] **Step 1: Insert Slide 10 (Use Cases) after Slide 9's closing `</div>`**

```html
<!-- ══ SLIDE 10 — Use Cases ══ -->
<div class="slide" data-index="9">
  <div class="tag">Use Cases</div>
  <h2>Any app that ships features needs to know<br>which ones to kill.</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:18px;flex:1;align-items:start">
    <div class="card">
      <div class="cat-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      </div>
      <h3 style="font-size:17px">E-Commerce</h3>
      <p style="font-size:14px">Dozens of filters and promo tabs accumulate over years — which ones do users actually tap?</p>
      <p style="font-size:12px;color:var(--text2);margin-top:6px">SHEIN, AliExpress</p>
    </div>
    <div class="card">
      <div class="cat-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </div>
      <h3 style="font-size:17px">Social Media</h3>
      <p style="font-size:14px">Features that launch with hype and silently die — find them before they bloat the app.</p>
      <p style="font-size:12px;color:var(--text2);margin-top:6px">Instagram, TikTok</p>
    </div>
    <div class="card">
      <div class="cat-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
      </div>
      <h3 style="font-size:17px">Banking &amp; Fintech</h3>
      <p style="font-size:14px">Dead features add regulatory compliance surface area and confuse users in high-stakes flows.</p>
      <p style="font-size:12px;color:var(--text2);margin-top:6px">Revolut, PayPal</p>
    </div>
    <div class="card">
      <div class="cat-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      </div>
      <h3 style="font-size:17px">Enterprise SaaS</h3>
      <p style="font-size:14px">Feature bloat is the #1 UX complaint in CRM and project management tools. Cut what nobody uses.</p>
      <p style="font-size:12px;color:var(--text2);margin-top:6px">Monday.com, Jira mobile</p>
    </div>
    <div class="card">
      <div class="cat-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2z"/></svg>
      </div>
      <h3 style="font-size:17px">News &amp; Content</h3>
      <p style="font-size:14px">Ghost-town tabs and content categories built up over years — data-driven pruning starts here.</p>
      <p style="font-size:12px;color:var(--text2);margin-top:6px">BBC, CNN apps</p>
    </div>
    <div class="card">
      <div class="cat-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </div>
      <h3 style="font-size:17px">Health &amp; Fitness</h3>
      <p style="font-size:14px">Complex tracking flows and goal-setter screens — users use only a fraction. Know which fraction.</p>
      <p style="font-size:12px;color:var(--text2);margin-top:6px">MyFitnessPal, Strava</p>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Fix the navigation JavaScript**

Find the `<script>` block. The current JS references `'1 / 20'` and has `total` derived from `slides.length` (which now = 10, so the math is already correct). Confirm `total` is computed dynamically — yes, it's `slides.length`. The only fix needed is the initial counter label.

Find and replace in the `<span class="counter">` element:
- Old: `<span class="counter" id="ctr">1 / 20</span>`  
- New: `<span class="counter" id="ctr">1 / 10</span>`

The progress bar calculation `(1 / total * 100)` is already dynamic — no change needed.

Also confirm the JS `go()` function uses `total` (not a hardcoded `20`) for boundary checks. It should — it reads `const total = slides.length`. No change needed.

- [ ] **Step 3: Final verification — navigate all 10 slides in browser**

Expected state of each slide:
1. **Title** — logo, big H1, tagline, 4 state pills
2. **Problem** — 3 large stat numbers (80%, $29.5B, Zero) + 2 bullets
3. **Solution** — 3 equal cards, each with icon + name + description + code/pill
4. **How It Works** — 5-step vertical list with YOU/AUTO labels
5. **SDK Public API** — 2-column code blocks, permissions note
6. **Internal Functions** — 4-column card grid with function lists
7. **Architecture & Data** — system flow diagram + 3 efficiency cards
8. **Portal Wireframes** — 2 side-by-side wireframe panels
9. **Feasibility** — API table + 2×2 challenge cards
10. **Use Cases** — 3×2 grid of 6 app category cards

Progress bar must reach 100% on slide 10. Keyboard arrows (← →) must navigate correctly. Counter must show "N / 10" at each slide.

- [ ] **Step 4: Commit**

```bash
git add FeaturePulse_Presentation.html
git commit -m "redesign: rebuild presentation from 20 slides to 10, clean minimal Spotlight design"
```

---

## Open Items (post-plan)

- **Slide 4 layout**: If the 5-step list looks too tight vertically, add `gap:18px` to the `.steps` container on this slide or reduce font size of step text from 16px to 15px.
- **Slide 6 mobile/small-screen**: 4-column grid may overflow on narrow projector screens. If so, change `.cols4` to `repeat(2, 1fr)` and stack 2×2 instead.
- **Slide 8 wireframes**: Placeholder schematics to be replaced with real portal screenshots once the portal is built.
- **Slide 9 challenges**: Currently 4 challenges selected (RecyclerView, no resource ID, app killed, battery drain). The spec listed these as the 4 key ones — if instructor asks about others (ProGuard, threading, ViewPager), they're in the original 20-slide deck for reference.
