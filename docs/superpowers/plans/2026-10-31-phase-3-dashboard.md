# Phase 3: Descriptive dashboard (Rams and Orgs sections)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's org card, four-number tiles and live-click panel with a descriptive, period-aware view split into a Rams section (everyone) and an Orgs section (members), with the feature cards grouped the same way.

**Architecture:** Pure helpers in `src/lib/dashboardModel.ts` turn API payloads into display values. Small section components under `src/components/dashboard/` each own one panel and its loading, empty and error states. `DashboardView.vue` only composes them. Data comes from the Phase 2 fetchers through `useQuery`.

**Tech Stack:** Vue 3, TypeScript, Vitest with happy-dom, existing `src/components/charts/*` (`StatTile`, `LineChart`, `BarList`, `HeatGrid`, `SparkLine`), `useQuery` from `src/lib/queryCache.ts`.

**Spec:** `docs/superpowers/specs/2026-10-31-nav-groups-dashboard-design.md` (section "Dashboard")
**Needs first:** Phase 1 (`appNav`, `hasOrg`, `GROUP_LABELS`) and Phase 2 (`fetchTrends`, `fetchOrgInsights`, `fetchUpcomingTickets`, `fetchPlatformStats`).

## Global Constraints

- Descriptive only: counts, comparisons with the previous equal period, peaks. No forecasts, scores or advice text.
- Periods 7, 30, 90 days, default 30; the choice persists in `sessionStorage['eypi.dashboardRange']` (try/catch).
- Every panel has a skeleton, an empty state with at most one action, and an error state with a retry; one failing panel never blanks the others.
- Charts: tokens only (`var(--chart-1..5)`), a text equivalent for every chart (`aria-label` stating totals and peak), deltas are never colour-only.
- Read `DESIGN_SYSTEM.md` sections 2, 5, 6, 7, 9 and 13 before writing any markup. Cards use the existing `Card`, `AppSection`, `EmptyState`, `Skeleton`. UI copy follows section 13 (sentence case, no exclamation marks, "Eypi" in the UI).
- The dashboard stays a lazy chunk. Entry gzip budgets (JS ≤ 70,000 B, CSS ≤ 22,000 B) must still pass `npm run release:check`.
- No new dependency. Never log emails or IPs.
- Commits: Conventional Commits, `type(scope): lowercase imperative subject`, blank line, `- bullet` lines starting with a lowercase verb. Scope `dashboard`. No `Co-Authored-By`, `Signed-off-by` or any AI/tool trailer. One commit per task, each green. Tick this task's boxes in this file and include the file in that commit.
- A task is done when its tests pass and `npm run typecheck` passes.

## Review Focus

1. Previous period is 0 and current is above 0: the delta shows "new", never `Infinity%` or `NaN%` (Task 1).
2. A heat grid of all zeros produces no "peak" sentence (Task 1).
3. Switching the period while a request is in flight shows the new period's data, never the old one (Task 3).
4. A member with an empty org (no events, no profile views) sees zeros and prompts, not broken charts or divide-by-zero check-in rates (Task 5).
5. The dashboard for a user with no links, no tickets and no org still reads as a welcome, with the Rams cards and the invites banner (Task 7).

## File Structure

```
src/lib/dashboardModel.ts                  deltaPercent, formatDelta, peakHourLabel, checkInRate, sumTimeline
src/config/dashboardCards.ts               one-line descriptions per nav destination
src/composables/useDashboardRange.ts       persisted period ref
src/components/dashboard/PeriodPicker.vue
src/components/dashboard/LinkKpis.vue      KPI strip for links
src/components/dashboard/ClicksTrend.vue   LineChart panel
src/components/dashboard/TopLinks.vue      BarList panel
src/components/dashboard/AudiencePanels.vue device, country, referrer, app
src/components/dashboard/BestHours.vue     HeatGrid panel
src/components/dashboard/UpcomingTickets.vue
src/components/dashboard/AcrossApc.vue     platform strip
src/components/dashboard/OrgInsightsSection.vue
src/components/dashboard/FeatureCards.vue  grouped cards
src/components/dashboard/PanelState.vue    shared skeleton / empty / error wrapper
src/views/DashboardView.vue                composition only
```
Each has a `.test.ts` beside it.

---

### Task 1: Dashboard model helpers

**Files:** Create `src/lib/dashboardModel.ts`, `dashboardModel.test.ts`.

**Produces:**
```ts
export function deltaPercent(current: number, previous: number): number | null  // null when previous is 0
export function formatDelta(current: number, previous: number): { text: string; direction: 'up' | 'down' | 'flat' | 'new' | 'none' }
export function peakHourLabel(heat: number[]): string | null   // 'Mondays around 7 PM' style; null when all zero or length != 168
export function checkInRate(checkIns: number, registrations: number): number | null  // 0..100, null when registrations is 0
export function sumTimeline(timeline: { clicks: number; uniques: number }[]): { clicks: number; uniques: number }
```

- [x] **Step 1: Write failing tests**: `deltaPercent(110, 100) === 10`, `(50, 100) === -50`, `(5, 0) === null`, `(0, 0) === null`; `formatDelta(5, 0)` is `{ direction: 'new', text: 'New' }`, `(0, 0)` is `{ direction: 'none', text: '' }`, `(100, 100)` is `flat`; `peakHourLabel` returns `null` for 168 zeros and for a 10-length array (Review Focus 2), and for a single non-zero cell at index 19 (Monday 19:00) returns text containing `Mondays` and `7 PM`; `checkInRate(30, 60) === 50`, `(1, 0) === null`, never above 100.
- [x] **Step 2:** Run `npx vitest run src/lib/dashboardModel.test.ts`. Expect FAIL.
- [x] **Step 3: Implement** the helpers. Round percentages to integers; Manila-hour labels use 12-hour clock with `AM`/`PM`.
- [x] **Step 4:** Run the test. Expect PASS.
- [x] **Step 5: Commit** `feat(dashboard): add pure helpers for deltas, peaks and rates`

### Task 2: Period state, picker and panel wrapper

**Files:** Create `src/composables/useDashboardRange.ts`, `src/components/dashboard/PeriodPicker.vue`, `PanelState.vue`, and tests for each.

**Produces:**
```ts
export function useDashboardRange(): { range: Ref<TrendRange>; setRange: (value: TrendRange) => void }   // shared module-level ref, sessionStorage-backed
// PeriodPicker: props { modelValue: TrendRange }, emits update:modelValue; a 3-button group (role="group", aria-label="Period", aria-pressed on each, each min-h-11)
// PanelState: props { status: 'loading' | 'error' | 'empty' | 'ready'; title: string; emptyBody?: string; action?: { label: string; to: string } }, emits retry; default slot renders when ready
```

- [x] **Step 1: Write failing tests**: default range 30; `setRange(7)` writes `sessionStorage`; a throwing `sessionStorage` does not throw and falls back to 30; `PeriodPicker` marks only the active button `aria-pressed="true"` and emits the chosen value; `PanelState` shows a `role="status"` skeleton when loading, an error message with a Retry button that emits `retry`, the empty body and action link when empty, and the slot when ready.
- [x] **Step 2:** Run the three test files. Expect FAIL.
- [x] **Step 3: Implement.** Copy the skeleton markup pattern (`role="status" aria-busy="true"` plus `sr-only` text) from the current `DashboardView.vue`.
- [x] **Step 4:** Run them. Expect PASS.
- [x] **Step 5: Commit** `feat(dashboard): add period picker and shared panel states`

### Task 3: Link KPIs, clicks trend and top links

**Files:** Create `LinkKpis.vue`, `ClicksTrend.vue`, `TopLinks.vue` under `src/components/dashboard/` with tests.

**Consumes:** `fetchTrends`, `trendsKey`, `formatDelta`, `PanelState`, `useDashboardRange`.
**Produces:** each component takes `props: { trends: UserTrends | null; status: 'loading' | 'error' | 'ready' }` (the view owns the query so the three share one request) and renders its panel.

- [x] **Step 1: Write failing tests** with a fixture `UserTrends`:
  - `LinkKpis` renders `StatTile`s Clicks, Daily uniques, QR scans, Active links, Links, each with a delta against `previous` (no delta shown when `previous` is absent); `new` shows "New".
  - `ClicksTrend` passes a `LineChart` two series (clicks, uniques) and a third "Previous period clicks" series when `previous` exists; its `aria-label` includes the total clicks and the best day.
  - `TopLinks` renders at most 5 `BarList` rows labelled `eypi.cc/{slug}`; with no links shows the `EmptyState` "No links yet" with action to `/links`; with links but zero clicks shows "No clicks in this period".
  - Period switching (Review Focus 3): mount the view-level query with a stubbed `fetch` that resolves 30 slowly and 7 quickly; after switching to 7 the rendered total equals the 7-day fixture even after the 30-day response lands. (This test lives in Task 7's view test; here assert only that components render solely from their `trends` prop.)
- [x] **Step 2:** Run `npx vitest run src/components/dashboard`. Expect FAIL.
- [x] **Step 3: Implement** the three components using the chart components in `src/components/charts/` (read their prop types first). Numbers use `toLocaleString('en-US')`.
- [x] **Step 4:** Run them. Expect PASS.
- [x] **Step 5: Commit** `feat(dashboard): show link totals, a clicks trend and top links`

### Task 4: Audience, best hours, upcoming tickets and campus strip

**Files:** Create `AudiencePanels.vue`, `BestHours.vue`, `UpcomingTickets.vue`, `AcrossApc.vue` with tests.

**Produces:** `AudiencePanels` and `BestHours` take `{ trends, status }`. `UpcomingTickets` takes `{ tickets: TicketSummary[] | null; status }`. `AcrossApc` takes `{ stats: PlatformStats | null; status }`.

- [x] **Step 1: Write failing tests**:
  - `AudiencePanels` renders one `BarList` each for Device, Country, Referrer and, when non-empty, App; a dimension with no rows is not rendered; an all-empty set shows "No audience data yet".
  - `BestHours` passes the 168 cells to `HeatGrid` and shows the sentence from `peakHourLabel`; no sentence and the empty state for an all-zero heat (Review Focus 2).
  - `UpcomingTickets` lists up to 3 tickets with event name and date and a "View all" link to `/tickets`; empty state "No upcoming tickets" with no action button.
  - `AcrossApc` renders students, orgs, links, clicks and events from `PlatformStats` as one muted `<dl>` strip; an error state hides the strip silently (it is decoration, no retry button).
- [x] **Step 2:** Run `npx vitest run src/components/dashboard`. Expect FAIL.
- [x] **Step 3: Implement.** Country codes display as provided by the API (no extra lookup table).
- [x] **Step 4:** Run them. Expect PASS.
- [x] **Step 5: Commit** `feat(dashboard): add audience, best hours, tickets and campus panels`

### Task 5: Orgs section

**Files:** Create `src/components/dashboard/OrgInsightsSection.vue` and test.

**Consumes:** `fetchOrgInsights`, `orgInsightsKey`, `useActiveOrg().activeOrg`, `checkInRate`, `useDashboardRange`.
**Produces:** a component with no props; renders nothing when `activeOrg` is null.

- [x] **Step 1: Write failing tests**: no `activeOrg` renders nothing; with an org it shows one header line (org name and slug label), `StatTile`s Profile views, Registrations, Check-ins (with "x% checked in" only when `checkInRate` is not null), Frames views, Frames downloads, Members (last value of `members.daily`); a `LineChart` of `profileViews.daily`; a `SparkLine` of members; a link "Full insights" to `/orgs/{slug}/insights`; an org with all zeros shows the stat tiles at 0 and no divide-by-zero (Review Focus 4); a 403 from the endpoint shows the panel error with retry.
- [x] **Step 2:** Run it. Expect FAIL.
- [x] **Step 3: Implement** with `useQuery(() => orgInsightsKey(id, range), () => fetchOrgInsights(id, range))`. Delta against the previous period is not available from this endpoint, so show no deltas here.
- [x] **Step 4:** Run it. Expect PASS.
- [x] **Step 5: Commit** `feat(dashboard): show org insights for members`

### Task 6: Grouped feature cards

**Files:** Create `src/config/dashboardCards.ts`, `src/components/dashboard/FeatureCards.vue` and tests.

**Produces:**
```ts
export const CARD_DESCRIPTIONS: Record<string, string>   // keyed by nav `to`; one sentence each
// FeatureCards props: { admin: boolean; org: boolean }; renders groupedEntries(appNav({ admin, org })) minus Dashboard, with a heading per group
```
Rams cards: Links, My tickets, Wallpaper, Invites, Orgs. Orgs cards: Tix, Frames, Forms, My org. Reuse the current card markup (`router-link` wrapping `Card`). Invites card shows the pending-invite count as a `Badge`.

- [x] **Step 1: Write failing tests**: a test that every nav item with a group (except Dashboard) has a `CARD_DESCRIPTIONS` entry; non-member renders only the Rams heading and five cards; member renders both headings and nine cards; cards link to the right routes; invite badge appears only when `pendingInviteCount > 0`.
- [x] **Step 2:** Run it. Expect FAIL.
- [x] **Step 3: Implement.** Keep existing copy for Links, Forms, Tix, Frames, Orgs descriptions; write new one-sentence copy for My tickets, Wallpaper, Invites and My org.
- [x] **Step 4:** Run it. Expect PASS.
- [x] **Step 5: Commit** `feat(dashboard): group feature cards as rams and orgs`

### Task 7: Compose the dashboard

**Files:** Modify `src/views/DashboardView.vue`, `DashboardView.test.ts`, `src/views/pageSkeletons.test.ts` if it lists dashboard blocks; remove the "Your org" card markup and `LiveClicks` usage (grep for other importers of `LiveClicks`; delete `LiveClicks.vue` and its test only if the dashboard was its only user, and keep `GET /api/links/summary/live` untouched either way).

Layout (top to bottom): greeting and invite banner; `<section aria-labelledby="rams-heading">` heading "Rams" with `PeriodPicker`, `LinkKpis`, `ClicksTrend`, `TopLinks`, `AudiencePanels`, `BestHours`, `UpcomingTickets`, `AcrossApc`, Rams `FeatureCards`; then, for members, `<section aria-labelledby="orgs-heading">` heading "Orgs" with `OrgInsightsSection` and Orgs `FeatureCards`. Two columns from `lg`, one column below.

- [x] **Step 1: Update tests first.** Stub `fetch` for `/api/links/summary/trends`, `/api/tickets/upcoming`, `/api/stats`, `/api/orgs/jpcs-apc/insights`. Assert: a non-member sees "Rams" and no "Orgs" heading and no org requests are made; a member sees both; the old "Your org" text and `LiveClicks` are absent; the invite banner still shows for `pendingInviteCount > 0`; one failing endpoint leaves the other panels rendered (error text only in its own panel); a user with no links, no tickets and no org sees the welcome empty states and the five Rams cards (Review Focus 5); period switch re-requests with `range=7` and shows the 7-day data after a slower 30-day response resolves late (Review Focus 3).
- [x] **Step 2:** Run `npx vitest run src/views/DashboardView.test.ts`. Expect FAIL.
- [x] **Step 3: Implement** the composition. One `useQuery` for trends keyed by the range, one each for tickets and stats; pass results down as props. Heading ids for the two landmarks.
- [x] **Step 4:** Run the view test, then `npm test`, `npm run typecheck`, `npm run build`.
- [x] **Step 5:** Run `npm run release:check`; if the entry budget fails, find the import that leaked into the entry chunk and make it lazy (`defineAsyncComponent`) before committing.
- [x] **Step 6: Commit** `feat(dashboard): compose rams and orgs sections with descriptive analytics`
  - bullets: replace the org card and live clicks with trends, audience, best hours and tickets; split the page into Rams and Orgs sections; keep the dashboard in its lazy chunk; cover member, non-member, empty and partial-failure cases with Vitest.

### Task 8: Docs

**Files:** Modify `CONTEXT.md` (remove or reword the "live view" glossary row if `LiveClicks` was deleted; replace the UI convention "Platform totals … are not on the member dashboard" with "The member dashboard shows them in a small Across APC strip"; add the dashboard panels to the module map), `DESIGN_SYSTEM.md` (add the dashboard panels and `PeriodPicker`, `PanelState` to the component catalogue).

- [x] **Step 1:** Make the edits and tick this file's boxes.
- [x] **Step 2:** Run `npm test` and `npm run typecheck`. Expect PASS.
- [x] **Step 3: Commit** `docs(dashboard): describe the grouped dashboard and its panels`
