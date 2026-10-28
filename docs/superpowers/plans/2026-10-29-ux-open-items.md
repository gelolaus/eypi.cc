# UX Open Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the open UX audit findings (UX-4, 6, 7, 10, 14, 17, 28, 29, 38, 45, 46, 48, 57) and hide the duplicate header Create button on empty Links and Events lists.

**Architecture:** Small, independent edits to existing views and components, each test-first. One shared helper is new: a legal contents list. No new dependencies. Signed-in views are verified in the browser after the code lands.

**Tech Stack:** Vue 3, vue-router 4, Tailwind 4, reka-ui `dropdown-menu` (already in `src/components/ui/dropdown-menu`), Vitest + happy-dom, Hono worker.

**Spec:** `docs/superpowers/specs/2026-10-29-ux-open-items-design.md` (audit: `docs/superpowers/specs/2026-10-27-ux-audit.md`).

## Global Constraints

- `DESIGN_SYSTEM.md`: light only, touch targets ≥ 44 px (`min-h-11` / `size-11`), visible focus, `motion-safe:` on every animation, sentence-case copy, no `dark:`.
- Budgets (gzip): entry JS ≤ 70,000 B (now 69,416), CSS ≤ 22,000 B. Run `npm run release:check` after Tasks 1, 2 and 6, and at the end.
- TDD: each task's tests fail first, then pass. Each commit leaves `npm run typecheck`, `npm test`, `npm run lint` green.
- Commits on `main`, locally, never pushed. Conventional Commits: `type(scope): lowercase imperative subject`, blank line, `- lowercase verb` bullets. No `Co-Authored-By` or any tool trailer.
- Tick the task's checkboxes in this file and update the audit Outcomes table in the same commit.
- Do not write to the production database. No deploy, no Cloudflare changes.

## Review Focus

- Cold load of a public route shows the skeleton, never the signed-in shell, and a signed-in user's `/dashboard` cold load still works (Task 1 tests).
- LiveStats never leaves an odd tile alone, including 0 and 1 qualifying tiles, and still keeps all tiles while loading (Task 2).
- Legal contents links jump to real heading ids, including headings with duplicate text or punctuation (Task 3).
- The overflow menu is fully keyboard-operable, and a moderator-locked link (admin or abuse disabled) never offers Enable (Task 6).
- Undo for disable account is skipped on an already-disabled user and a failed commit reverts the row (Task 9).

---

### Task 1: Cold-route skeleton (UX-4)

Finding: `main.ts` mounts before the first navigation settles. Until then `route.meta.layout` is unset so `App.vue` picks the async signed-in shell, and `router-view` renders nothing while vue-router awaits the lazy route chunk. A `Suspense` would not help because the router, not Vue, awaits the lazy component. The fallback is therefore keyed on the router being ready.

**Files:**
- Modify: `src/App.vue`
- Test: `src/App.test.ts`

**Interfaces:**
- Produces: in `App.vue`, `const routerReady = ref(false)` set by `router.isReady()`; while false, the template renders a `<div role="status" aria-busy="true" data-boot-skeleton>` (header-height bar plus two `h-28 rounded-3xl bg-muted motion-safe:animate-pulse` blocks and an `sr-only` "Loading") instead of `<component :is="Shell">`.

- [x] **Step 1: Write failing tests in `src/App.test.ts`:** `shows the boot skeleton until the router is ready` (assert `[data-boot-skeleton]` exists, has `aria-busy="true"`, and `PublicShell`/`AppShell` are not rendered) and `swaps the skeleton for the shell once ready` (resolve `router.isReady()`, `flushPromises`, assert the skeleton is gone and the shell renders). Follow the file's existing router mocking.
- [x] **Step 2:** Run `npx vitest run src/App.test.ts`; expect both new tests FAIL.
- [x] **Step 3: Implement** the `routerReady` ref and the `v-if`/`v-else` in `App.vue`; inline the markup, do not import `PageSkeleton` (budget). Pulse blocks use `motion-safe:animate-pulse`.
- [x] **Step 4:** Run the same command; expect PASS. Run `npm run build` then `npm run release:check`; expect entry JS ≤ 70,000 B. If over, trim the markup first, then report to the owner before cutting anything else.
- [x] **Step 5:** Tick this task, set UX-4 to `fixed` in the audit doc (note: `document.title` stays generic until the chunk loads), commit `feat(ui): show a boot skeleton on cold route loads`.

### Task 2: Home page (UX-6, UX-7)

**Files:**
- Modify: `src/components/marketing/Hero.vue`, `src/components/marketing/LiveStats.vue`
- Test: `src/components/marketing/Hero.test.ts`, `src/components/marketing/LiveStats.test.ts`

**Interfaces:**
- Produces: `evenTiles<T>(items: T[]): T[]` exported from `LiveStats.vue`'s script module, or a local function if the file has no shared module; returns `items` with the last element dropped when the length is odd and greater than 1, and returns `items` unchanged for length 0 or 1.

- [x] **Step 1: Failing tests.** Hero: replace `shows the large brand` with `does not repeat the brand logo` (assert no `.font-display` text `Eypi` and no `BrandLogo` in the hero). LiveStats: `hides the odd tile out`, `keeps a single qualifying tile`, `keeps every tile while loading` (counts: 7 qualifying shows 6, 6 shows 6, 1 shows 1, 0 renders no section).
- [x] **Step 2:** Run `npx vitest run src/components/marketing`; expect the new tests FAIL.
- [x] **Step 3:** Remove `BrandLogo` and its import from `Hero.vue` and drop the `mt-8` that spaced the h1 below it (use `mt-0`). In `LiveStats.vue` apply `evenTiles` to the filtered list after loading, keeping the largest counts: sort qualifying items by value descending before dropping, then restore the declared order.
- [x] **Step 4:** Run the tests; expect PASS. Run `npm run release:check`.
- [x] **Step 5:** Set UX-6 and UX-7 to `fixed`, commit `fix(home): drop the duplicate logo and orphan stat tile`.

### Task 3: Legal contents list (UX-10)

**Files:**
- Create: `src/legal/sectionId.ts` (+ `src/legal/sectionId.test.ts`)
- Modify: `src/views/LegalView.vue`, `src/views/LegalView.test.ts`

**Interfaces:**
- Produces: `sectionIds(headings: string[]): string[]` returns unique, URL-safe ids: lowercase, non-alphanumerics collapsed to `-`, trimmed, prefixed `s-` when empty, de-duplicated with `-2`, `-3` suffixes.

- [x] **Step 1: Failing tests.** `sectionId.test.ts`: `slugs headings`, `de-duplicates repeated headings`, `handles punctuation-only headings`. `LegalView.test.ts`: `renders an On this page list with one link per section`, `each link href matches a section id`, `scroll offset leaves the sticky header clear` (section has `scroll-mt-20`).
- [x] **Step 2:** Run `npx vitest run src/legal src/views/LegalView.test.ts`; expect FAIL.
- [x] **Step 3:** Implement `sectionIds`; in `LegalView.vue` add a `<nav aria-label="On this page">` with an `<ol>` of `min-h-11` links above the first section, set `id` and `scroll-mt-20` on each `<section>`. Anchor clicks must not break under the router: use plain `href="#id"`.
- [x] **Step 4:** Run the tests; expect PASS.
- [x] **Step 5:** Set UX-10 `fixed`, commit `feat(legal): add an on this page contents list`.

### Task 4: Org banner ratio (UX-14)

**Files:**
- Modify: `src/views/orgs/OrgProfileView.vue:36-50`
- Test: `src/views/orgsRestyle.test.ts` (or the nearest org profile test; add if none)

**Interfaces:**
- Consumes: `profile.bannerMeta` (`ImageMeta | null`, from `src/components/AppImage.vue`'s `meta` prop; read its width and height fields).

- [ ] **Step 1: Failing tests.** `uses the stored banner ratio at lg` (with `bannerMeta` width 2048, height 1153 the wrapper has an inline `aspect-ratio: 2048 / 1153` style at `lg` via a CSS variable `--banner-ratio` plus class `lg:aspect-[var(--banner-ratio)]`, `lg:h-auto`); `falls back to the fixed height without meta` (no variable, keeps `h-44 md:h-52`); `no meta gradient still renders`.
- [ ] **Step 2:** Run the file; expect FAIL.
- [ ] **Step 3:** Set `--banner-ratio` on the banner wrapper from `bannerMeta`, keep `h-44 md:h-52` below `lg`, switch to the ratio box at `lg` with `max-h-96` so a very tall banner cannot push content off screen; image keeps `object-cover` (the box now matches, so no crop).
- [ ] **Step 4:** Run the tests; expect PASS.
- [ ] **Step 5:** Set UX-14 `fixed` (visual check in Task 10), commit `fix(orgs): size the banner to its stored ratio`.

### Task 5: Sitemap (UX-57)

**Files:**
- Modify: `worker/index.ts:498-509`
- Test: `worker/index.test.ts`

- [ ] **Step 1: Failing test** `sitemap lists the static public pages`: the XML contains `/`, `/orgs`, `/contact`, `/privacy`, `/terms`, `/acceptable-use`, `/login` once each, followed by org and frame URLs.
- [ ] **Step 2:** Run `npx vitest run worker/index.test.ts -t sitemap`; expect FAIL.
- [ ] **Step 3:** Extend `locs` in `sitemapDocument` with the missing paths, in the order above.
- [ ] **Step 4:** Run the test; expect PASS.
- [ ] **Step 5:** Set UX-57 `fixed`, commit `fix(seo): list the static public pages in the sitemap`.

### Task 6: Links row overflow and header Create (UX-28)

**Files:**
- Modify: `src/components/links/LinkRow.vue`, `src/views/links/LinksView.vue:7-22`, `src/views/tix/EventsView.vue:12-26`
- Test: `src/components/links/linksMobile.test.ts`, `src/views/links/LinksView.test.ts`, `src/views/tix/EventsView.test.ts`

**Interfaces:**
- Consumes: `DropdownMenu*` from `@/components/ui/dropdown-menu`; existing `disable`/`enable`/`delete` emits stay unchanged.
- Produces: `LinkRow` renders Copy, Analytics and Edit as buttons at all widths, and Pause/Enable and Delete as buttons only from `md`; below `md` a single `More actions` trigger (`size-11`, `aria-label="More actions for {slug}"`) opens a menu with the same actions, items `min-h-11`.

- [ ] **Step 1: Failing tests.** `linksMobile.test.ts`: `shows three visible actions and a More actions menu below md` (visible `[data-row-actions]` buttons count and the trigger label), `menu offers Disable and Delete`, `menu offers Enable for a user-disabled link`, `moderator-locked link has no Enable or Disable item`. Views: `LinksView hides the header New link when the list is empty` and `shows it when links exist` (empty-state button remains); same pair for `EventsView` with `New Event` (hidden only when `events.length === 0`, the search input row hides with it).
- [ ] **Step 2:** Run the three files; expect FAIL.
- [ ] **Step 3:** Implement. Desktop buttons use `hidden md:inline-flex`, the menu trigger `md:hidden`. Header Create and the Export CSV button: Export hides too when empty on Links (nothing to export); keep a single flex container so no empty gap remains.
- [ ] **Step 4:** Run the files; expect PASS. Confirm keyboard use in Task 10.
- [ ] **Step 5:** Set UX-28 `fixed` and record the header decision as resolved in the Outcomes notes, commit `feat(links): move row actions into a menu on phones`.

### Task 7: Phone tables and text (UX-45, UX-38, UX-29)

**Files:**
- Modify: `src/views/forms/generators/VisitorsPassView.vue:228`, `src/views/forms/generators/LetterOfIntentView.vue:161`, `src/components/tix/AttendeeTable.vue`, `src/views/tix/AttendeesInboxView.vue`
- Test: `src/views/forms/formsMobile.test.ts`, `src/components/tix/AttendeeTable.test.ts`, `src/views/orgs/…` members test if present

- [ ] **Step 1: Failing tests.** Forms: `guest list stacks as cards below md` and `signer list stacks as cards below md` (the wrapper has no `overflow-x-auto` below `md`; each row renders its field labels visibly; `md:overflow-x-auto` allowed). AttendeeTable: `attendee name is text-base` and `email on mobile card is text-sm` (`text-xs` removed). Members (UX-29): `members wrapper does not scroll sideways below md` regression guard.
- [ ] **Step 2:** Run the three test files; expect FAIL except the UX-29 guard.
- [ ] **Step 3:** Rework each forms table to the pattern `AttendeeTable` uses: `block` rows with `md:table-row`, a per-cell label shown below `md` (`md:hidden`), inputs `min-h-11`. Attendee name `font-mono text-base font-bold`, email `text-sm`.
- [ ] **Step 4:** Run tests, then `npm run typecheck` and `npm run lint`; expect PASS. Check `AttendeesInboxView.vue` for any other `text-xs` on attendee rows and raise to `text-sm`.
- [ ] **Step 5:** Set UX-45 and UX-38 `fixed`, UX-29 `fixed (verified in Task 10)` or leave `partial` if Task 10 finds a defect, commit `fix(mobile): stack forms tables and enlarge attendee text`.

### Task 8: Frame canvas keyboard (UX-17)

**Files:**
- Modify: `src/composables/useDpCanvas.ts`, `src/views/dp/DpPublicView.vue:47-56`
- Test: `src/composables/useDpCanvas.test.ts` (create), `src/views/dp/DpPublicView.test.ts`

**Interfaces:**
- Produces from `useDpCanvas`: `nudge(dx: number, dy: number): void` (canvas-pixel units, adds to `offsetX/Y`), `zoomBy(factor: number): void` (zooms about the canvas centre via `applyZoom`, clamped to min/max scale), `onKeydown(e: KeyboardEvent): void` (arrows nudge by 10 canvas px, Shift+arrow by 40, `+`/`=` zoom ×1.1, `-` zoom ÷1.1, `0` resets; calls `preventDefault` only for handled keys).

- [ ] **Step 1: Failing tests.** Composable: `arrow keys nudge the offset`, `shift arrow nudges farther`, `plus and minus change scale within limits`, `unhandled keys are not prevented`, `reset key centres and resets zoom`. View: `canvas has role img, a label and tabindex 0`, `renders Zoom in, Zoom out and Reset position buttons at 44px`, `buttons change the scale`.
- [ ] **Step 2:** Run both; expect FAIL.
- [ ] **Step 3:** Implement the three functions and export them. In the view add `role="img"`, `aria-label="Photo preview. Use arrow keys to move and plus or minus to zoom."`, `tabindex="0"`, `@keydown="onKeydown"`, visible focus ring classes on the canvas container (`focus-visible:ring-3 focus-visible:ring-ring/50`), and a row of three `Button` controls under the canvas (`Zoom out`, `Zoom in`, `Reset position`) with `min-h-11`, disabled until a photo is loaded.
- [ ] **Step 4:** Run both; expect PASS.
- [ ] **Step 5:** Set UX-17 `fixed`, commit `feat(frames): move and zoom the photo from the keyboard`.

### Task 9: Admin Undo (UX-48)

**Files:**
- Modify: `src/views/admin/AdminUsersView.vue:283-300`, `src/views/admin/AdminLinksView.vue` (disable handler)
- Test: `src/views/admin/adminViews.test.ts`

**Interfaces:**
- Consumes: `runWithUndo` (`apply`, `revert`, `commit`, `windowMs`), `activeOrgHeaders` from `src/composables/useUndoToast.ts`; the existing `patchUser` PATCH call and the admin link disable request.

- [ ] **Step 1: Failing tests.** `disabling an account applies immediately and shows an Undo toast without a confirm dialog`, `undo restores the account and sends no request`, `request fires after the window`, `a failed commit reverts the row`, `enabling still happens at once`, `delete account keeps its confirm`; same trio for admin links disable (the reason textarea stays; its text is captured when the action starts).
- [ ] **Step 2:** Run `npx vitest run src/views/admin`; expect FAIL.
- [ ] **Step 3:** Replace the `dialog.confirm` in `toggleDisabled` and the link disable flow with `runWithUndo`, optimistic row update in `apply`, restore in `revert`, request in `commit` with `{ keepalive: true }`. Leave `forceLogout` and delete account as they are.
- [ ] **Step 4:** Run the admin tests; expect PASS.
- [ ] **Step 5:** Set UX-48 `fixed`, commit `feat(admin): undo for disabling accounts and links`.

### Task 10: Browser pass and Outcomes (UX-46, UX-29, all visual checks)

**Files:**
- Modify: `docs/superpowers/specs/2026-10-27-ux-audit.md` (Outcomes), this plan (ticks)

- [ ] **Step 1:** Run `npm run dev:local` (read-only token). In the built-in browser at 375×812 and 1280×800, check: `/` (one logo, stat tiles), `/privacy` and `/terms` (contents list jumps), `/orgs`, `/orgs/jpcs` (banner text not cut), `/frames/<slug>` (Tab to canvas, arrows, +/-, buttons), cold reload of `/orgs` and `/contact` (skeleton appears), `/contact`.
- [ ] **Step 2:** If the owner is signed in to the browser, check `/links` (empty and populated; More actions menu by keyboard), `/manage/tix`, an event's attendees, `/forms/visitors-pass`, `/forms/letter-of-intent`, an org's members, `/admin/users`, `/admin/links`, `/admin/speed` (UX-46 tiles and the 7 and 28 day buttons). Do not click anything that writes; the Undo toast flow is checked by disabling nothing, only by viewing the controls. Anything not reachable is recorded as unseen.
- [ ] **Step 3:** Fix defects found, each with a failing test first, as extra commits `fix(scope): …`.
- [ ] **Step 4:** Update the Outcomes table: new commit hashes per ID, UX-29 and UX-46 final status, header Create decision recorded, and a short "seen vs unseen" list. Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm run release:check`; paste the bundle sizes.
- [ ] **Step 5:** Commit `docs(ux): record the open-items outcomes`. Report to the owner what was seen at each width. Do not push.
