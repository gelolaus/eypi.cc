# Phase 3 — Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Analytics worth opening: richer link clicks (device, browser, source app), fast charts from rollups, Frames/Tix/org insights, and a 5-second live view.

**Architecture:** Both click paths parse the user agent into `device`, `browser`, `app` at write time. The hourly cron from Phase 1 also rebuilds yesterday's and today's link and module rollups. Read endpoints combine rollups (before today) with raw rows (today). Small beacons record Frames and org page events. Live endpoints use weak ETags and 304s.

**Tech Stack:** Hono, Turso/libSQL, the Phase 1 hourly cron (`runHourlyRollups`) and SVG chart components, Vue 3.

**Spec:** `docs/superpowers/specs/2026-10-27-eypi-speed-tix-analytics-design.md` §6. Phases 1 and 2 must be merged first.

## Global Constraints

- `device` ∈ `mobile|tablet|desktop`; `browser` ∈ `Chrome|Safari|Firefox|Edge|Samsung|Opera|Other`; `app` ∈ `messenger|facebook|instagram|tiktok|x|line|discord` or NULL. Never store the user-agent string.
- Days are Manila calendar days for analytics rollups. Hour-of-week `how` = 0–167, Monday 00:00 Manila = 0.
- Unique visitors are **per day only** (visitor hashes rotate daily); never claim cross-day uniques.
- Raw `analytics` retention 400 days, deleted by the daily job only after rollups exist for those days.
- Live polling every 5 s while the tab is visible, with `If-None-Match`; no Durable Objects or WebSockets.
- Recent-click lists show time, country, source app only — no visitor ids.
- Privacy policy text changes are drafts for the owner to approve (owner guide 3.3.1).
- TDD every task; `npm run typecheck`, `npm test`, `npm run lint` green; owner-style commits, **no co-author or tool trailers**, on `main`.

## Review Focus

- A link with clicks spanning midnight Manila (16:00 UTC) must split across the right days in rollups and charts (Task 2 test `splits at manila midnight`).
- A rollup run that fails halfway must be repaired by the next hourly run (Task 2 test `rerun repairs partial day`).
- Analytics for a range that includes today must count today's clicks exactly once (Task 3 test `today counted once`).
- Unknown or empty user agents must map to `Other`/`desktop`/NULL without throwing (Task 1 test `empty user agent`).
- Beacon spam from one visitor must not inflate Frames numbers (Task 5 test `rate limits beacons per visitor`).

---

### Task 1: Click enrichment (migration 0012 + UA parsing)

**Files:**
- Create: `backend/migrations/0012_analytics.sql`
- Modify: `shared/linkAnalytics.ts` (+ `shared/linkAnalytics.test.ts`), `worker/index.ts` (+ test), `backend/src/routes/links.ts` resolve/unlock click paths (+ tests)

**Interfaces:**
- Migration: `analytics ADD device TEXT, ADD browser TEXT, ADD app TEXT`; tables `analytics_daily(link_id, day, clicks, uniques, qr, PRIMARY KEY(link_id, day))`, `analytics_daily_dim(link_id, day, dim, value, clicks, PRIMARY KEY(link_id, day, dim, value))`, `module_events(id INTEGER PK AUTOINCREMENT, org_id, module, subject_id, action, visitor_hash, day, created_at DEFAULT CURRENT_TIMESTAMP)` with index `(subject_id, day)`, `module_daily(subject_id, module, action, day, n, uniques, PRIMARY KEY(subject_id, module, action, day))`; index `analytics(created_at)`.
- Produces: `parseUserAgent(ua: string | null): { device: Device; browser: Browser; app: App | null }`; `LinkClickMetadata` gains `device`, `browser`, `app`; `logLinkClick` writes them.

- [x] **Step 1: Failing tests:** table of real UA strings: iPhone Messenger (`FBAN/MessengerForiOS`) → `mobile/Safari/messenger`; Android Facebook (`FB_IAB`/`FBAV`) → `mobile/Chrome/facebook`; Instagram, TikTok (`musical_ly`/`BytedanceWebview`), Line, Discord, X (`Twitter for`); iPad → tablet; Edge desktop (`Edg/`) → `desktop/Edge`; Samsung Internet; `empty user agent` → `desktop/Other/null`. Worker test asserts the inserted row has the three fields.
- [x] **Step 2: Run** `npx vitest run shared/linkAnalytics.test.ts worker/index.test.ts` → FAIL.
- [x] **Step 3: Implement** (ordered regex checks, in-app markers before browser markers).
- [x] **Step 4: Run** → PASS; `npm test`.
- [x] **Step 5: Commit** `feat(links): record device, browser and source app per click`.

### Task 2: Link and module rollups

**Files:**
- Modify: `backend/src/jobs/rollups.ts` (+ test), `backend/src/jobs/retention.ts` (+ test)

**Interfaces:**
- Produces: `rollupLinks(db: Client, days: string[]): Promise<void>`, `rollupModules(db: Client, days: string[]): Promise<void>`, `manilaDay(date: Date): string` (YYYY-MM-DD), `manilaHourOfWeek(date: Date): number`; `runHourlyRollups` calls both for `[yesterday, today]` (Manila).
- Rebuild per day: `DELETE` then `INSERT … SELECT` grouped by link and day from raw rows where `created_at` falls in that Manila day (UTC range `[day-1 16:00, day 16:00)`), in one batch per day. Dims: `country, os, device, browser, app, referrer, how`.

- [x] **Step 1: Failing tests:** `splits at manila midnight` (clicks at 15:59Z and 16:00Z land on different days); uniques = distinct non-null visitor hashes; `how` correct for a Monday 00:30 Manila click (=0); `rerun repairs partial day` (delete half the rollup rows, rerun, equal to fresh); retention deletes raw rows older than 400 days only when `analytics_daily` has that link/day.
- [x] **Step 2–4:** run `npx vitest run backend/src/jobs` → FAIL, implement, PASS.
- [x] **Step 5: Commit** `feat(analytics): roll up link and module events hourly`.

### Task 3: Link analytics API v2

**Files:**
- Modify: `backend/src/routes/links.ts` analytics handler and CSV export (+ `links.analytics.test.ts`)

**Interfaces:**
- Produces: `GET /api/links/:id/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&compare=1` (default last 30 days; max range 400 days) → `{ totals: { clicks, avgDailyUniques, qrShare }, previous?: same shape, timeline: { day, clicks, uniques }[], heat: number[168], top: { referrer, app, country, device, browser, os: { value, clicks }[] /* top 8 */ } }`. CSV adds columns `device,browser,app`.

- [x] **Step 1: Failing tests:** `today counted once` (rollup for yesterday + raw for today); compare returns the equal-length previous range; `heat.length === 168`; range > 400 days → 422; authz unchanged (owner only, admin allowed); CSV header exact.
- [x] **Step 2–4.** **Step 5: Commit** `feat(links): serve analytics from rollups with period comparison`.

### Task 4: Analytics panel redesign

**Files:**
- Modify: `src/components/AnalyticsPanel.vue` (+ test), CSV download button

**Interfaces:**
- Consumes Task 3 payload and Phase 1 charts (`StatTile` with `delta`, `LineChart`, `HeatGrid`, `BarList`).

- [x] **Step 1: Failing tests:** range buttons 7/30/90 + custom dates send `from`/`to`; compare toggle shows deltas as `+12%` text; "Source apps" list labels `messenger` as "Messenger"; empty range shows the empty state copy "No clicks in this period yet".
- [x] **Step 2–4.** **Step 5: Commit** `feat(links): show device, app and hour-of-week analytics`.

### Task 5: Module beacons (Frames and org profile)

**Files:**
- Create: `backend/src/routes/beacon.ts` (+ test), `src/lib/beacon.ts` (+ test)
- Modify: `src/views/dp/DpPublicView.vue` (view, photo_added, download, share), `src/views/orgs/OrgProfileView.vue` (view), `backend/src/index.ts`

**Interfaces:**
- Produces: `POST /api/beacon` (text/plain JSON `{ module: 'frames'|'org', subjectId: string, action: 'view'|'photo_added'|'download'|'share' }`) → 204; resolves `org_id` from the subject (campaign or org), computes `visitor_hash` with `IP_HASH_SECRET` the same way as clicks; `sendModuleBeacon(module, subjectId, action): void`.

- [x] **Step 1: Failing tests:** unknown subject → 204 and no row (no existence oracle); invalid action for module (`org` + `download`) → 400; `rate limits beacons per visitor` (same visitor, subject and action more than 20 per hour → 204 but not stored); `view` sent once per page load.
- [x] **Step 2–4.** **Step 5: Commit** `feat(analytics): record frames and org page events`.

### Task 6: Frames and Tix insights

**Files:**
- Create: `backend/src/routes/insights.ts` (+ test), `src/components/insights/FramesInsights.vue`, `src/components/insights/TixInsights.vue` (+ tests)
- Modify: `src/views/dp/DpEditCampaignView.vue` (Insights tab), `src/views/tix/EventDetailView.vue` (Insights tab)

**Interfaces:**
- Produces: `GET /api/dp/:id/insights?days=30` → `{ funnel: { view, photo_added, downloadOrShare }, conversion: number, perFrame: { frameId, label, downloads }[], daily: { day, views, downloads }[] }`. Frames `download` and `share` beacons use `subjectId: '<campaignId>:<frameId>'` (Task 5 accepts this form for frames); the funnel sums every subject starting with `<campaignId>`, and `perFrame` reads each one; `GET /api/events/:slug/insights` → `{ byStatus, registrationsDaily: { day, n }[], byAnswer: { questionId, options: { value, n }[] }[], showUpRate: number | null, checkInCurve: { bucket: string /* HH:MM, 10-min */, n }[] }` computed from `attendees` and `check_ins`.

- [ ] **Step 1: Failing tests:** funnel numbers from seeded `module_daily`; conversion = downloadOrShare / view (0 views → 0, not NaN); show-up rate = checked-in confirmed / confirmed (null when 0 confirmed); 10-minute buckets in Manila time; authz (org members only).
- [ ] **Step 2–4.** **Step 5: Commit** `feat(analytics): add frames and tix insights`.

### Task 7: Org insights page

**Files:**
- Modify: `backend/src/routes/insights.ts` (+ test)
- Create: `src/views/orgs/OrgInsightsView.vue` (+ test); route `/orgs/:slug/insights` (`requiresAuth`, activated members of that org)

**Interfaces:**
- Produces: `GET /api/orgs/:org_id/insights?days=30` → `{ profileViews: { total, daily }, frames: { campaigns, views, downloads }, tix: { events, registrations, checkIns }, members: { daily: { day, count }[] } }` (member trend from `org_members.activated_at`).

- [ ] **Step 1: Failing tests:** non-member 403; no personal links data in the payload (assert keys); view renders tiles and sparklines.
- [ ] **Step 2–4.** **Step 5: Commit** `feat(orgs): add an org insights page`.

### Task 8: Live view

**Files:**
- Create: `src/composables/useLivePoll.ts` (+ test)
- Modify: `backend/src/routes/links.ts` (`GET /api/links/summary/live`, + test), `src/views/DashboardView.vue`, `src/views/tix/DoorModeView.vue` and event Overview tab (reuse Phase 2 `/live`)

**Interfaces:**
- Produces: `useLivePoll<T>(url: string, intervalMs = 5000): { data: Ref<T | null>; lastUpdated: Ref<Date | null> }` — pauses when `document.hidden`, sends `If-None-Match`, keeps data on 304; `GET /api/links/summary/live` → `{ last60: number[] /* per minute */, recent: { at, country, app }[] /* 10 */ }` with weak ETag.

- [ ] **Step 1: Failing tests:** poll pauses on hidden and resumes; 304 keeps previous data; endpoint returns 304 for a matching ETag; `recent` has no visitor hash field.
- [ ] **Step 2–4.** **Step 5: Commit** `feat(analytics): add live clicks and check-in counters`.

### Task 9: Privacy draft, docs, verification

**Files:**
- Modify: `src/legal/privacy.ts` (new version date, sections for device/browser/app, RUM samples, Frames/org page events, retention 400 days raw clicks and 30 days speed samples), `shared/legalVersions.ts`, `CONTEXT.md`, tick this plan

- [ ] **Step 1:** Draft the privacy changes; do **not** merge the version bump until the owner approves (owner guide 3.3.1) — commit the draft, then wait for "privacy update approved" before Step 3.
- [ ] **Step 2:** `npm run lint && npm run typecheck && npm test && npm run build` → green.
- [ ] **Step 3: Commit** `docs(legal): describe the new analytics in the privacy policy`, then tell the owner Phase 3 is ready with migration `0012_analytics`.
