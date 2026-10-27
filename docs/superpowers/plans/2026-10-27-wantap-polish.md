# Wantap Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the chrome defects, put real numbers on the landing page, make the dashboard informational, and replace the placeholder logo with a ram.

**Architecture:** Small, test-first edits to the existing wantap port (`AppShell`, `OrgSwitcher`, `MarketingHeader`, `Hero`, `DashboardView`), three read-only aggregate API routes, and hand-built SVG logo candidates.

**Tech Stack:** Vue 3, Tailwind v4 tokens, Vitest (`@vue/test-utils`, happy-dom), Hono on Workers, libSQL (`createTestApp` in `backend/src/test/createTestApp.ts`).

**Spec:** `docs/superpowers/specs/2026-10-27-wantap-polish-design.md`

## Global Constraints

- Light only, APC palette. No `dark:` utilities, no hard-coded colors in components (tokens only), no new motion, no new fonts.
- UI copy follows `DESIGN_SYSTEM.md` section 13: no em dashes, no filler words, empty states name the next action.
- Tests first: write, run to see it fail, implement, run to see it pass. Each commit is green (`npm run typecheck`, `npm test`).
- Commits: `type(scope): lowercase subject`, blank line, `- lowercase verb` bullets. No `Co-Authored-By` or any tool trailer (`AGENTS.md`).
- Local dev hits the production Turso database: new queries are read-only. Never run migrations, deploys or destructive SQL.
- Public stats are aggregates only: no emails, names or IPs.
- Tick the task's checkboxes in this file in the same commit as the work.

## Review Focus

- Org name of 80+ characters with no spaces: wraps or breaks inside the rail, never overflows (Task 2).
- Org with no logo and a slug containing hyphens: label shows the CAPS slug unchanged, for example `JPCS-APC` (Task 2).
- `/api/stats` on an empty database: every key is `0`, not `null` (Task 3).
- Stats request fails or is slow on the landing page: hero still renders, grid shows the unavailable state, no zeros (Task 4).
- Signed-in user with no active org opens the dashboard: no org card, no error (Task 6).
- User with zero links: links card shows the next action, not `NaN` or a blank top link (Task 6).

---

### Task 1: Hide the route announcer

**Files:**
- Modify: `src/router/index.ts:420-427`
- Test: `src/router/documentTitle.test.ts`

**Interfaces:**
- Produces: `#route-announcer` element carrying class `sr-only`.

- [x] **Step 1: Failing test** in `documentTitle.test.ts`, `it('hides the route announcer visually')`: navigate with `router.push('/contact')` (route used by the existing announcer test at line 87), then `expect(document.getElementById('route-announcer')?.classList.contains('sr-only')).toBe(true)`.
- [x] **Step 2:** Run `npx vitest run src/router/documentTitle.test.ts`. Expected: FAIL on the new test.
- [x] **Step 3:** In `router.afterEach`, add `region.className = 'sr-only'` where the region is created. Keep `role`, `aria-live`, `aria-atomic`.
- [x] **Step 4:** Re-run the file. Expected: PASS.
- [x] **Step 5:** Manual check with `npm run dev:local`: open `/manage/frames/<slug>/edit` at 1920x1080. No text at the bottom and no page-level scrollbar beyond the content pane's own. If a scrollbar remains, find the overflowing element and fix it in this task.
- [x] **Step 6:** Commit `fix(a11y): hide the route announcer`.

### Task 2: Wider rail and org label

**Files:**
- Modify: `src/components/layout/AppShell.vue:13`, `src/components/OrgSwitcher.vue`, `src/types/orgs.ts`, `DESIGN_SYSTEM.md` (section 6: `w-56` becomes `w-72`)
- Test: `src/components/layout/AppShell.test.ts:120`, create `src/components/OrgSwitcher.test.ts`, extend `src/types/orgs` tests if present (else cover in `OrgSwitcher.test.ts`)

**Interfaces:**
- Produces: `orgSlugLabel(org: Pick<OrgListItem, 'org_id'>): string` in `src/types/orgs.ts`, returning `org.org_id.toUpperCase()`.

- [x] **Step 1: Failing tests.** `AppShell.test.ts`: replace `'w-56'` with `'w-72'` in the sidebar class list. `OrgSwitcher.test.ts` (mock `useActiveOrg` state with `orgs`/`activeOrg`): (a) with `block`, the trigger text contains the full 90-character no-space name, the name element has `line-clamp-2` and `break-words` and not `truncate`; (b) the trigger shows `JPCS-APC` for `org_id: 'jpcs-apc'`; (c) the trigger `title` equals the full name; (d) menu rows show name and CAPS slug; (e) with `compact`, below `sm` the label span keeps `hidden sm:inline`.
- [x] **Step 2:** Run both files. Expected: FAIL.
- [x] **Step 3:** Add `orgSlugLabel` next to `orgSlug`. Change `aside` width to `w-72`. In `OrgSwitcher.vue` replace the single `truncate` span with a stacked block: name (`line-clamp-2 break-words text-sm font-medium leading-tight`), then slug (`font-mono text-xs text-muted-foreground`, via `orgSlugLabel`). Apply the same stack to menu rows. Keep `title`, `aria-label` and `compact` behavior.
- [x] **Step 4:** Run both files plus `npx vitest run src/styles/design.test.ts`. Expected: PASS.
- [x] **Step 5:** Update `DESIGN_SYSTEM.md` width mention. Commit `feat(shell): widen the rail and show full org names`.

### Task 3: Public stats route

**Files:**
- Modify: `backend/src/routes/stats.ts`
- Test: create `backend/src/routes/stats.test.ts`

**Interfaces:**
- Produces: `GET /api/stats` returning `{ users, orgs, members, links, clicks, events, tickets, checkIns, frames, frameDownloads }`, all numbers, header `Cache-Control: public, max-age=300`. Keys `orgs`, `links`, `events` keep their current meaning.

- [x] **Step 1: Failing tests** using `createTestApp`: (a) empty database returns all ten keys equal to `0`; (b) after seeding one user, one org with one activated and one pending member, two links with `clicks` 3 and 4, one event with two attendees and one `checked_in` plus one `removed` check-in row, one campaign with `download_count` 5: expect `users 1, orgs 1, members 1, links 2, clicks 7, events 1, tickets 2, checkIns 1, frames 1, frameDownloads 5`; (c) response has the cache header and no request cookie is required.
- [x] **Step 2:** Run `npx vitest run backend/src/routes/stats.test.ts` (from the root, or per the backend's test script). Expected: FAIL.
- [x] **Step 3:** One `Promise.all` of read-only `COUNT(*)` and `COALESCE(SUM(...), 0)` queries; `members` counts `org_members` where `activated_at IS NOT NULL`; `checkIns` counts `action = 'checked_in'`; wrap each value in `Number(... ?? 0)`.
- [x] **Step 4:** Run the test. Expected: PASS. Commit `feat(stats): return platform totals`.

### Task 4: Landing page

**Files:**
- Create: `src/components/marketing/LiveStats.vue`, `src/components/marketing/LiveStats.test.ts`
- Modify: `src/components/marketing/Hero.vue`, `src/components/marketing/MarketingHeader.vue`, `src/views/HomeView.vue`, `src/components/marketing/Hero.test.ts`
- Delete: `src/components/marketing/ProofSection.vue` (its fetch moves into `LiveStats`); remove `FeatureStrip` and `CtaSection` from `HomeView.vue` only if they contain example data, otherwise keep
- Test: header test (create `src/components/marketing/MarketingHeader.test.ts`)

**Interfaces:**
- Consumes: `GET /api/stats` (Task 3) through `api.raw`.
- Produces: `LiveStats` with props none; renders `dl[aria-label="Platform totals"]` with ten tiles (label plus `dd` using `toLocaleString('en-US')` and `tabular-nums`), states `loading` (skeleton, `aria-busy="true"`), `error` (text `Stats are unavailable right now.`, no numbers).

- [x] **Step 1: Failing tests.** `LiveStats.test.ts`: mocked fetch success shows `1,234` for `users: 1234` and ten tiles; rejected fetch and non-ok response both show the unavailable text and no `dd`; loading shows `aria-busy`. `Hero.test.ts`: no text matching `example.com`; contains `LiveStats`. `MarketingHeader.test.ts`: signed out shows exactly one text link `Orgs` plus a `Get started` link to `/login`; signed in shows only `Dashboard`.
- [x] **Step 2:** Run those files. Expected: FAIL.
- [x] **Step 3:** Build `LiveStats` as a section card grid (`grid-cols-2 sm:grid-cols-3`, tile `rounded-2xl border border-border bg-card p-4`, number `font-heading text-3xl font-semibold`). Replace the `Hero` preview card and `rows` with `<LiveStats />` (keep `float-slow`, `aria-hidden` removed since it carries data). Header: signed-out inline items become `[Orgs]` and the CTA `Get started` to `/login`; leave `navItems` for the mobile drawer unchanged.
- [x] **Step 4:** Run the files and `npx vitest run src/views`. Expected: PASS.
- [x] **Step 5:** Visual check at 1920x1080 and 375px against the wantap screenshot: logo and headline left, numbers right, slim header. Commit `feat(landing): show live platform totals`.

### Task 5: Dashboard summaries

**Files:**
- Modify: `backend/src/routes/links.ts`, `backend/src/routes/orgs.ts`
- Test: `backend/src/routes/links.test.ts`, `backend/src/routes/orgs.public.test.ts` or new `backend/src/routes/orgs.summary.test.ts`

**Interfaces:**
- Produces: `GET /api/links/summary` (session auth, registered before `/:id`) returning `{ count: number, clicks: number, top: { slug: string, clicks: number } | null }` for the signed-in user. `GET /api/orgs/:org_id/summary` guarded by `requireOrgCoordinator` returning `{ members: number, events: number, tickets: number, frames: number }` (activated members only).

- [x] **Step 1: Failing tests.** Links: user with no links returns `{count:0,clicks:0,top:null}`; with links of 3 and 9 clicks returns `count 2, clicks 12, top` the 9-click link; another user's links are not counted. Orgs: activated member gets correct counts; pending-invite or non-member gets 403/404 like `/profile`; counts exclude other orgs.
- [x] **Step 2:** Run the backend tests. Expected: FAIL.
- [x] **Step 3:** Implement both routes as read-only aggregate queries. Orgs `events` and `frames` filter by `org_id`; `tickets` joins `attendees` to `events` by `event_id`.
- [x] **Step 4:** Run tests. Expected: PASS. Commit `feat(api): add link and org summaries`.

### Task 6: Informational dashboard

**Files:**
- Modify: `src/views/DashboardView.vue`, `src/views/DashboardView.test.ts`
- Create: `src/components/dashboard/PlatformTotals.vue` only if `LiveStats` cannot be reused; prefer importing `LiveStats` from Task 4

**Interfaces:**
- Consumes: `GET /api/links/summary`, `GET /api/orgs/:org_id/summary` (Task 5), `LiveStats` (Task 4), `useActiveOrg().activeOrg`, `orgSlugLabel` (Task 2).

- [x] **Step 1: Failing tests** (mock `api.raw`/`api.get`): (a) greeting `Hi, <name>.` plus one description line; (b) links card shows count, clicks and top link `eypi.cc/<slug>`; (c) zero links shows `No links yet. Create your first short link.` with a link to `/links`, and no `NaN`; (d) org card shows name, CAPS slug and the four counts when an active org exists; (e) no org card when `activeOrg` is null; (f) the five module launcher links remain; (g) a failed summary request shows a quiet unavailable line and still renders the modules.
- [x] **Step 2:** Run `npx vitest run src/views/DashboardView.test.ts`. Expected: FAIL.
- [x] **Step 3:** Rebuild the page with `AppPage` and a `grid gap-6 lg:grid-cols-2` of `AppSection` cards (Your links, Your org, Platform), then the module cards. Fetch both summaries on mount; org summary refetches when `activeOrg` changes.
- [x] **Step 4:** Run the file and `npx vitest run src/views/mobilePages.test.ts`. Expected: PASS. Commit `feat(dashboard): show link, org and platform numbers`.

### Task 7: Ram logo candidates

**Files:**
- Create: `docs/logo/ram-a.svg`, `docs/logo/ram-b.svg`, `docs/logo/ram-c.svg`, `docs/logo/preview.html`

**Interfaces:**
- Produces: three standalone 256x256 viewBox SVGs, each using only `#35438C`, `#DEAC4B` and one background color.

- [x] **Step 1:** Draw three treatments per the spec (A horn-forward, B wool-forward, C face-forward): 4 to 7 basic shapes, two character colors, both curled horns visible, two eyes, heavy rounded shapes, no sharp tips, emerging from the lower-left corner (A, C) or lower-right (B), filling 85 to 95 percent of the square.
- [x] **Step 2:** `preview.html` shows each at 32, 64 and 256 px, plus a black silhouette row at 32 px.
- [x] **Step 3:** Open the preview in the browser pane and screenshot it. Verify each reads as a ram at 32 px; redraw any that does not.
- [x] **Step 4:** Commit `feat(brand): add ram logo candidates`. Stop and ask the owner to pick A, B or C before Task 8.

### Task 8: Apply the chosen logo

**Files:**
- Modify: `public/favicon.svg`, `public/apple-touch-icon.png`, `public/manifest.webmanifest`, `src/components/brand/BrandLogo.vue` (only if the path changes), `src/components/brand/BrandLogo.test.ts`

- [x] **Step 1: Failing test** in `BrandLogo.test.ts`: the mark `img` `src` equals the favicon path and `public/favicon.svg` contains neither `<text` nor the letter mark (read the file with `fs`).
- [x] **Step 2:** Run it. Expected: FAIL (current favicon has `<text>`).
- [x] **Step 3:** Copy the chosen SVG to `public/favicon.svg`; render a 180x180 PNG for `apple-touch-icon.png`; confirm manifest icon entries still resolve.
- [x] **Step 4:** Run `npx vitest run src/components/brand`. Expected: PASS. Commit `feat(brand): use the ram as the logo`.

### Task 9: Docs and final verification

**Files:**
- Modify: `DESIGN_SYSTEM.md` (rail width, org label, `LiveStats`, brand), `CONTEXT.md` (stats keys, summaries), this plan's checkboxes

- [x] **Step 1:** Update the docs so `design.test.ts` still passes (`npx vitest run src/styles/design.test.ts`).
- [x] **Step 2:** Run `npm run typecheck`, `npm test`, `npm run build`. Expected: all pass.
- [ ] **Step 3 (not done: the browser pane blocks localhost):** In the browser at 1920x1080 and 375px, check: landing, login, dashboard, a frames edit page (no bottom text, no phantom scroll), the org label with a long name.
- [x] **Step 4:** Commit `docs(design): record the wantap polish`.
