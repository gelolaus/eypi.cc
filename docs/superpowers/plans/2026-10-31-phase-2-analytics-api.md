# Phase 2: Dashboard analytics API and client queries

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two read-only endpoints and typed client fetchers that give the dashboard everything it needs: user-wide link trends with a previous-period comparison, and a ticket preview that does not mark tickets as seen.

**Architecture:** `loadLinkPeriod` in `backend/src/lib/links/analyticsQuery.ts` is generalised to take a link scope, so one query set serves a single link and all of a user's links. A new route mounts before `/api/links/:id`. The org analytics (`/api/orgs/:org_id/insights`) and platform totals (`/api/stats`) already exist and are reused unchanged.

**Tech Stack:** Hono on Cloudflare Workers, libSQL, Vitest with `createTestApp` (`backend/src/test/createTestApp.ts`), TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-31-nav-groups-dashboard-design.md` (section "Backend")

## Global Constraints

- No migration, no schema change, no writes. Local dev uses the production Turso database: only run the test suite, never ad-hoc SQL against it.
- Manila days everywhere (`backend/src/lib/manilaTime.ts`). Past days come from `analytics_daily` / `analytics_daily_dim`; only today reads raw `analytics`.
- `range` is one of `7`, `30`, `90`; anything else is 422 `invalid_range`. Default 30.
- Responses are `Cache-Control: private, no-store`. No emails, IPs or visitor hashes in any response.
- `uniques` is the sum of per-day uniques (never deduplicated across days).
- Commits: Conventional Commits, `type(scope): lowercase imperative subject`, blank line, `- bullet` lines starting with a lowercase verb. Scopes `links`, `tix` and `dashboard` as named per task. No `Co-Authored-By`, `Signed-off-by` or any AI/tool trailer. One commit per task, each green. Tick this task's boxes in this file and include the file in that commit.
- A task is done when its tests pass and `npm run typecheck` passes. Backend tests: `npx vitest run <file>` from `backend/` or the repo root, matching how existing backend tests are run (check `package.json`).

## Review Focus

1. A user with no links, or links with no clicks, gets zeros, 30 timeline rows and an all-zero 168-cell heat, not a 500 (Task 2).
2. Another user's links never leak into the totals, top links or tickets (Tasks 2 and 3).
3. A link deleted after it earned clicks does not count (its rollup rows remain in `analytics_daily`) (Task 2).
4. `GET /api/tickets/upcoming` called twice leaves `users.tickets_seen_at` and the nav badge unchanged (Task 3).
5. The Manila day boundary: a click at 16:30 UTC belongs to the next Manila day (Task 2).

## File Structure

```
backend/src/lib/links/analyticsQuery.ts    loadLinkPeriod generalised to a LinkScope
backend/src/lib/links/userTrends.ts        loadUserTrends, top links, response shape (new)
backend/src/routes/links.ts                GET /api/links/summary/trends (before /api/links/:id)
backend/src/routes/events/registrations.ts GET /api/tickets/upcoming
src/lib/queries.ts                         types, keys, fetchers, prefetchDashboard
```

---

### Task 1: Generalise the period loader to a link scope

**Files:** Modify `backend/src/lib/links/analyticsQuery.ts`; tests in the existing `backend/src/jobs/rollups.test.ts` and `backend/src/routes/links*.test.ts` must stay green.

**Produces:**
```ts
export type LinkScope = { sql: string; args: (string | number)[] }   // e.g. { sql: 'link_id = ?', args: [id] }
export const linkScope = (linkId: string): LinkScope
export const userScope = (userId: string): LinkScope  // { sql: 'link_id IN (SELECT id FROM links WHERE user_id = ?)', args: [userId] }
export async function loadPeriod(database: Client, scope: LinkScope, from: string, to: string, today?: string): Promise<AnalyticsPeriod & { totals: AnalyticsPeriod['totals'] & { uniques: number; qr: number } }>
export const loadLinkPeriod = (database, linkId, from, to, today?) => loadPeriod(database, linkScope(linkId), from, to, today)
```
`totals.uniques` and `totals.qr` are added (sums over the period); existing fields are unchanged.

- [ ] **Step 1:** Run the current link analytics tests to confirm green: `npx vitest run backend/src/routes/links backend/src/jobs/rollups.test.ts`.
- [ ] **Step 2: Write a failing test** in a new `backend/src/lib/links/analyticsQuery.test.ts`: seed two links of one user and one of another, with `analytics_daily` rows, call `loadPeriod(db, userScope('u1'), ...)` and expect the clicks to be the sum of the two links only; expect `totals.uniques` and `totals.qr` to be the sums.
- [ ] **Step 3:** Run it. Expect FAIL (`loadPeriod` undefined).
- [ ] **Step 4: Implement.** Replace every `link_id = ?` and `[linkId, ...]` in the module's SQL with the scope's `sql` and `args`, spreading `scope.args` before the date args. `rawDimSql` takes the scope too. Keep `loadLinkPeriod` as the thin wrapper.
- [ ] **Step 5:** Run the new test and the link analytics tests. Expect PASS.
- [ ] **Step 6: Commit** `refactor(links): load analytics periods for any link scope`
  - bullets: add `LinkScope`, `linkScope` and `userScope`; return period unique and qr sums; cover the user scope with Vitest.

### Task 2: User-wide trends endpoint

**Files:** Create `backend/src/lib/links/userTrends.ts`, `userTrends.test.ts`; modify `backend/src/routes/links.ts`; create `backend/src/routes/links.trends.test.ts`.

**Consumes:** Task 1 `loadPeriod`, `userScope`.
**Produces:**
```ts
export type TrendsPeriod = {
  totals: { clicks: number; uniques: number; qr: number; activeLinks: number }
  timeline: { day: string; clicks: number; uniques: number }[]   // one row per day, zeros included
}
export type UserTrends = TrendsPeriod & {
  totals: TrendsPeriod['totals'] & { links: number }
  top: { links: { slug: string; clicks: number }[]; device: TopItem[]; country: TopItem[]; referrer: TopItem[]; app: TopItem[] }
  heat: number[]                      // 168 cells, Monday 00:00 Manila = 0
  previous?: TrendsPeriod
}
export async function loadUserTrends(database: Client, userId: string, range: 7 | 30 | 90, compare: boolean, today?: string): Promise<UserTrends>
```
Route: `GET /api/links/summary/trends?range=7|30|90&compare=1`, `requireAuth`, mounted right after `/api/links/summary/live` so it is not shadowed by `/api/links/:id`.

- [ ] **Step 1: Write failing route tests** in `links.trends.test.ts` (pattern: `links.summary.test.ts`):
  - 401 without a session; 422 `invalid_range` for `range=14`; default range is 30 (timeline length 30).
  - no links: `totals` all 0 and `links: 0`, `timeline` has 30 rows of zero, `heat` has 168 zeros, all `top` arrays empty (Review Focus 1).
  - two links of the user plus one of another user, rollup rows over several days: totals, timeline sums and `top.links` order by clicks descending, other user excluded (Review Focus 2).
  - `activeLinks` counts links with at least one click in the period; `links` counts all the user's links.
  - a deleted link with leftover `analytics_daily` rows is not counted (Review Focus 3).
  - `compare=1` returns `previous.timeline` of the same length for the preceding equal span; omitted otherwise.
  - today's clicks come from raw `analytics` rows and a seeded rollup row for today is ignored (reuses the rule in `loadLinkPeriod`); a click at `2026-10-30 16:30:00` UTC lands on Manila day `2026-10-31` (Review Focus 5).
  - response header `Cache-Control` is `private, no-store`.
- [ ] **Step 2:** Run `npx vitest run backend/src/routes/links.trends.test.ts`. Expect FAIL (404).
- [ ] **Step 3: Implement `loadUserTrends`.** Current span = `[today-(range-1), today]`; previous = the `range` days before. Use `loadPeriod(database, userScope(userId), ...)` for each. `top.links`: one query over `analytics_daily` joined to `links` (`links.user_id = ?`, past days) merged with a raw-today `GROUP BY link_id` query, top 5 by clicks with slug tiebreak. `activeLinks`: count of distinct link ids with clicks in the same merged data. `links`: `SELECT COUNT(*) FROM links WHERE user_id = ?`.
- [ ] **Step 4: Implement the route** with `range` parsed by the same rule as `analyticsRange` but 422 on a present, unsupported value.
- [ ] **Step 5:** Run the route test and `npm run typecheck`. Expect PASS.
- [ ] **Step 6: Commit** `feat(dashboard): add user-wide link trends endpoint`
  - bullets: add `GET /api/links/summary/trends` with optional previous period; read past days from rollups and today from raw rows; cover empty, cross-user, deleted-link and Manila-day cases with Vitest.

### Task 3: Read-only upcoming tickets

**Files:** Modify `backend/src/routes/events/registrations.ts`; create `backend/src/routes/events/tickets.upcoming.test.ts`.

**Produces:** `GET /api/tickets/upcoming` → `{ tickets: Ticket[] }` (same `ticketFromRow` shape as `GET /api/tickets`), at most 3, upcoming only (`e.event_date >= date('now','+2 hours')`), ordered by event date and time, statuses `confirmed`, `pending`, `entered`, `waitlisted` (not `cancelled` or `declined`). Auth and consent exactly as `GET /api/tickets`. Does **not** call `linkImportedRows` and does **not** update `tickets_seen_at`.

- [ ] **Step 1: Write failing tests**: 401 unauthenticated; returns only the signed-in user's tickets; capped at 3 and ordered soonest first; past events and cancelled or declined rows excluded; after two calls `users.tickets_seen_at` is unchanged and `GET /api/me` `ticketUpdates` is unchanged (Review Focus 4).
- [ ] **Step 2:** Run it. Expect FAIL (404).
- [ ] **Step 3: Implement** the route above `GET /api/tickets/guest/:token` handling so it is not captured by a param route. Reuse `TICKET_SELECT` and `ticketFromRow`.
- [ ] **Step 4:** Run the test and `npm run typecheck`. Expect PASS.
- [ ] **Step 5: Commit** `feat(tix): add a read-only upcoming tickets endpoint`
  - bullets: add `GET /api/tickets/upcoming` limited to three tickets; leave the seen marker alone; cover ordering, exclusions and the seen marker with Vitest.

### Task 4: Client types, keys and fetchers

**Files:** Modify `src/lib/queries.ts`; create `src/lib/queries.dashboard.test.ts`.

**Produces:**
```ts
export type TrendRange = 7 | 30 | 90
export type UserTrends = /* mirrors the backend UserTrends */
export type OrgInsights = /* mirrors GET /api/orgs/:org_id/insights; read backend/src/routes/insights.ts for the exact fields */
export type PlatformStats = { users: number; orgs: number; members: number; links: number; clicks: number; events: number; tickets: number; checkIns: number; frames: number; frameDownloads: number }
export const trendsKey = (range: TrendRange) => `links:trends:${range}`
export const fetchTrends = (range: TrendRange) => api.get<UserTrends>(`/api/links/summary/trends?range=${range}&compare=1`)
export const UPCOMING_TICKETS_KEY: string
export const fetchUpcomingTickets = () => api.get<{ tickets: TicketSummary[] }>('/api/tickets/upcoming')
export const orgInsightsKey = (orgId: string, days: TrendRange) => `orgs:insights:${orgId}:${days}`
export const fetchOrgInsights = (orgId: string, days: TrendRange) => api.get<OrgInsights>(`/api/orgs/${orgId}/insights?days=${days}`)
export const PLATFORM_STATS_KEY = 'stats:platform'
export const fetchPlatformStats = () => api.get<PlatformStats>('/api/stats')
```
`prefetchDashboard()` also warms `trendsKey(30)` and `UPCOMING_TICKETS_KEY`. Keys under `links:` invalidate with link writes (cache prefix rule in `CONTEXT.md`); `orgs:insights:*` falls under `/api/orgs` writes; tickets and stats keys have no write invalidation and rely on the cache TTL.

- [ ] **Step 1: Write failing tests**: each fetcher calls the documented path (stub `fetch`, as `DashboardView.test.ts` does); `trendsKey(7) !== trendsKey(30)`; `prefetchDashboard` requests `/api/links/summary/trends?range=30&compare=1` and `/api/tickets/upcoming`.
- [ ] **Step 2:** Run `npx vitest run src/lib/queries.dashboard.test.ts`. Expect FAIL.
- [ ] **Step 3: Implement** the exports. Find the existing ticket type used by `MyTicketsView` and reuse it for `TicketSummary`.
- [ ] **Step 4:** Run the test, `npm test` and `npm run typecheck`. Expect PASS.
- [ ] **Step 5: Commit** `feat(dashboard): add dashboard query keys and fetchers`
- [ ] **Step 6:** Update `CONTEXT.md` (backend route ownership: the two new routes; glossary: replace "live view" if Phase 3 removed it, otherwise leave) and commit `docs(dashboard): document the trends and upcoming tickets routes`.
