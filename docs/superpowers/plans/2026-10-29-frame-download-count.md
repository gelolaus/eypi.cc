# Public Frame Download Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Count every frame save, show "N downloads" to everyone on the public frame page, and keep the org-side number in sync.

**Architecture:** Keep the existing `dp_campaigns.download_count` column. Relax the download endpoint's rate limit from once per day to 30 per hour per connection per frame, expose the count in the public page payload, render it on the public view, and relabel the analytics figure that is a different, time-windowed number.

**Tech Stack:** Hono on Cloudflare Workers (`backend/`), Vue 3 SPA (`src/`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-frame-download-count-design.md`

## Global Constraints

- No schema change and no migration. Tests mock the database; never write to the production database.
- `DESIGN_SYSTEM.md`: light only, sentence-case copy, text at least `text-sm` for meta.
- Entry JS gzip ≤ 70,000 B (now 67,955 B) and CSS ≤ 22,000 B; check with `npm run build` then `npm run release:check -- --allow-dirty` after the frontend task.
- TDD: failing test first. Every commit passes `npm run typecheck`, `npm test`, `npm run lint`.
- Conventional Commits `type(scope): lowercase imperative subject`, `- lowercase verb` bullets that only claim real tests, no `Co-Authored-By` or any tool trailer, commit on `main`, never push, one small commit per unit.

## Review Focus

- A person who saves the same frame five times in a minute adds 5; the 31st save within the hour is refused with 429 and does not add (Task 1).
- Two frames from the same connection do not share a limit bucket (Task 1).
- A new frame (count 0) shows no "0 downloads" to visitors; 1 reads "1 download" (Task 2).
- The org list still shows 0 and the analytics screen no longer claims the lifetime wording (Task 3).
- Unknown id still returns 404 and does not touch the limiter (Task 1).

---

### Task 1: Count every save, with a loose guard

**Files:**
- Modify: `backend/src/routes/dp.ts:585-608` (download route, constant `DOWNLOAD_WINDOW_SEC` at line 24)
- Test: `backend/src/routes/dp.test.ts` (replace the test at line 244, `increments the download counter once per IP per day`)

**Interfaces:**
- Produces: `POST /api/dp/:id/download` increments `download_count` by 1 per request until the caller exceeds 30 requests per hour for that campaign, then returns 429 `{ status: 'error', message }` without incrementing. Constants `DOWNLOAD_LIMIT_PER_HOUR = 30`, `DOWNLOAD_WINDOW_SEC = 60 * 60`; limiter bucket `dp-download-hour`.

- [ ] **Step 1: Failing tests in `backend/src/routes/dp.test.ts`** (reuse the file's `download(id, ip)` helper and `downloadCount(client, id)`): `counts every save from the same connection` (3 requests from `IP_A` give count 3), `refuses the 31st save in an hour without counting it` (30 give 200, the 31st gives 429 and the count stays 30), `limits each frame on its own` (30 on camp-a then 1 on camp-b from the same IP still gives 200), `returns 404 for an unknown frame without counting`. Remove the old once-per-day test.
- [ ] **Step 2:** Run `npx vitest run backend/src/routes/dp.test.ts -t download` (from the repo root, or the backend test command in `backend/package.json`); expect the repeat-save tests FAIL.
- [ ] **Step 3: Implement** in `dp.ts`: set `DOWNLOAD_LIMIT_PER_HOUR = 30`, `DOWNLOAD_WINDOW_SEC = 60 * 60`, bucket `dp-download-hour`, `limit: DOWNLOAD_LIMIT_PER_HOUR`; change the 429 message to `You are saving too fast. Try again in a little while.`
- [ ] **Step 4:** Re-run; expect PASS. Run `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(frames): count every save with an hourly guard`.

### Task 2: Show the count on the public frame page

**Files:**
- Modify: `backend/src/routes/dp.ts:616-650` (the `GET /api/dp/:slug` handler: both `SELECT` statements and the response), `src/views/dp/DpPublicView.vue` (the `Campaign` interface at line 230, the reactive default at line 242, the template under the `AppPage` title block)
- Test: `backend/src/routes/dp.test.ts` (public payload test near line 222), `src/views/dp/DpPublicView.test.ts`

**Interfaces:**
- Produces: `campaign.downloadCount: number` in the `GET /api/dp/:slug` response (default 0); `Campaign.downloadCount` in the view.

- [ ] **Step 1: Failing tests.** Backend: `public payload includes downloadCount` (after 2 counted saves the payload says 2; a slug reached through `dp_slug_history` also returns it). View (`campaignResponse()` stays the fixture; override per test): `shows N downloads when the count is at least 1`, `says 1 download for one`, `formats thousands` (1234 shows `1,234 downloads`), `hides the count at 0`.
- [ ] **Step 2:** Run both files; expect FAIL.
- [ ] **Step 3: Implement** by adding `download_count` to both `SELECT` lists and `downloadCount: Number(row.download_count ?? 0)` to the response; in the view add the field (default 0) and a `<p class="text-center font-mono text-sm text-muted-foreground" data-download-count>` under the title block, rendered only when `campaign.downloadCount >= 1`, text `${n.toLocaleString('en-US')} download(s)`. Keep it inside the lazy view so the entry chunk does not grow.
- [ ] **Step 4:** Run both files, then `npm run build` and `npm run release:check -- --allow-dirty`; expect PASS and entry JS ≤ 70,000 B.
- [ ] **Step 5: Commit** `feat(frames): show the download count on the public page`.

### Task 3: Org side wording and sync

**Files:**
- Modify: `src/components/insights/FramesInsights.vue:54-56,155`, `src/views/orgs/OrgInsightsView.vue:180` (label already "Downloads and shares"; keep), `src/views/dp/DpCampaignsView.vue:78-79` (no change expected)
- Test: `src/components/insights/` test for FramesInsights if present (else a new `FramesInsights.test.ts`), `src/views/dp/DpCampaignsView.test.ts`

- [ ] **Step 1: Failing tests.** FramesInsights: `labels the trend and per-frame figures as downloads and shares` (the series label and the two headings use "Downloads and shares", not bare "Downloads"). DpCampaignsView: `shows the lifetime count including zero` (0 renders `0 downloads`, 1 renders `1 download`).
- [ ] **Step 2:** Run both; expect the FramesInsights test FAIL.
- [ ] **Step 3: Implement** the label changes: series `Downloads and shares`, heading `Downloads and shares per day (Manila time)`, heading `Downloads and shares per frame`. Do not change calculations.
- [ ] **Step 4:** Run both files; expect PASS.
- [ ] **Step 5: Commit** `fix(insights): label the windowed figures as downloads and shares`.

### Task 4: Docs

**Files:**
- Modify: `docs/superpowers/specs/2026-10-27-ux-audit.md` is not touched; instead add a short note to `docs/superpowers/specs/2026-10-29-frame-download-count-design.md` under a new `## Outcome` heading (commit subjects, test counts, and that old frame totals were not backfilled and the visible number can lag by 30 s). Tick this plan's boxes.

- [ ] **Step 1:** Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm run release:check -- --allow-dirty`; record test count and entry JS/CSS gzip bytes in the Outcome section.
- [ ] **Step 2: Commit** `docs(frames): record the download count outcome`.
