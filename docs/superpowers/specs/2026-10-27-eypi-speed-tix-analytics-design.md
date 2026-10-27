# Eypi speed, Tix and analytics — design spec

**Status:** Draft for owner review (2026-10-27, owner: Angelo Laus)
**Inputs:** a code review of `main` at `53b566b`, the production build in `dist/`, one live timing sample of `https://eypi.cc/`, and the owner's answers during brainstorming.
**Owner steps:** `docs/owner-guide-speed-tix-analytics.md` (everything only the owner can do, in order).
**Plans:** one implementation plan per phase, written after this spec is approved (`docs/superpowers/plans/2026-10-27-phase-N-*.md`).

This spec is the "what and why" for the next round of work after the overhaul. Where it and the code disagree, the spec wins. Where it and `CONTEXT.md` disagree, update `CONTEXT.md` in the same phase. Visual work follows `DESIGN_SYSTEM.md`.

---

## 1. Goals and non-goals

**Goals**

1. Make every page feel instant on a mid-range phone on campus Wi-Fi or mobile data, and prove it with real-user numbers.
2. Serve images at the size they are shown, without losing the original's quality.
3. Rework Tix so APC students register and keep their tickets in Eypi, orgs pick how people get in, and the door works offline.
4. Give links, Frames, Tix and orgs analytics worth opening, including a live view.
5. Polish the UX on top of the faster foundation.

**Non-goals**

- No framework, database or hosting change. Stay on Vue 3 SPA, Hono Workers, Turso, R2, KV.
- **No ticket emails.** Guests get a private link that orgs share themselves (owner decision: Resend cost).
- No payments, no Durable Objects or WebSockets, no server-side image processing, no Cloudflare Image Transformations.
- No door-staff accounts outside an org. Door mode uses the flat org model (any activated member).
- No public SaaS, no non-APC sign-in.

## 2. What the review found

| ID | Area | Finding |
|---|---|---|
| R-1 | Speed | `router.beforeEach` awaits `session.load()` (`GET /api/me`) before **every** route, including public `/frames/:slug`, `/tix/:slug`, `/unlock/:slug`. Live sample: HTML 1.78 s → JS 3.1 s → `/api/me` 0.6 s → `/api/stats` 0.6 s; content at ~3.7 s. |
| R-2 | Speed | Entry chunk 113 KB gz (340 KB raw), CSS 21 KB gz. `AppShell` is imported eagerly in `App.vue`, so public pages download the whole signed-in shell. |
| R-3 | Speed | `AnalyticsPanel` pulls `chart.js` + `vue-chartjs` (60 KB gz). |
| R-4 | Speed | Images: uploads up to 10 MB, served as the original from R2. `/media/*` reads R2 on every request (no edge Cache API). No `<img>` has `width`/`height`, `loading`, `decoding`, `srcset` or `fetchpriority`. |
| R-5 | Speed | No `preconnect` to `https://api.eypi.cc`; no client data cache, so each navigation refetches. |
| R-6 | Speed | `GET /api/events/:slug/attendees` runs `ROW_NUMBER()` over **all** `check_ins`, not just the event's. |
| R-7 | Speed | API Worker runs at the edge nearest the user, while every request makes 1–4 Turso round trips. No placement setting. |
| R-8 | Observability | Cloudflare Web Analytics auto-injection is on, but the CSP (`script-src 'self'`) blocks its beacon, so it records nothing. We have no real-user speed data. |
| R-9 | Analytics | Clicks record only OS, country, referrer, QR/direct, visitor hash. Charts aggregate raw rows on every view. Frames has only a download counter; Tix and orgs have nothing. |
| R-10 | Tix | No self-registration. Orgs import a CSV, run a raffle, finalize; attendees must type first name, last name and email exactly at `/tix/:slug` and are told to screenshot the QR. Tickets are not kept anywhere. |
| R-11 | Tix | `events.ts` is 1,449 lines and still returns the legacy `{ status: 'error', message }` shape instead of `{ error: { code, message } }`. |

## 3. Locked decisions

| # | Decision | Choice |
|---|---|---|
| E1 | Order | Measure and speed (Phase 1) → Tix (Phase 2) → analytics (Phase 3) → UX polish (Phase 4). Each phase has its own plan and ships alone. |
| E2 | Images | Resize in the browser at upload. Keep the original untouched in R2 as the master. Store display variants beside it. |
| E3 | Image formats | WebP (quality 0.86) when the browser can encode it; otherwise JPEG 0.86 for opaque images and PNG for images with transparency. No AVIF (browsers cannot encode it from a canvas). |
| E4 | Tix attendees | Mostly APC with some guests. APC students register with their Microsoft sign-in; guests are added by orgs. |
| E5 | Admission modes | Per event, one of: first come first served (with optional waitlist), lottery, manual approval, invite/import only. |
| E6 | Guest tickets | A private, unguessable link `eypi.cc/t/<token>`. Orgs copy it or export all links as CSV. **No email.** |
| E7 | Analytics scope | Richer link analytics, module analytics (Frames, Tix, org), real-user speed monitoring (RUM), live view. |
| E8 | Live updates | Polling every 5 s with ETag / 304. No Durable Objects. |
| E9 | Charts | Small in-house SVG chart components following the dataviz rules. Remove `chart.js` and `vue-chartjs`. |
| E10 | Data cache | Small in-house stale-while-revalidate cache in `src/lib/`. No new data library. |
| E11 | Service worker | Hand-written `sw.js` (no Workbox) with a documented kill switch. |
| E12 | Commits | Conventional Commits in the owner's style. No co-author or tool trailers (AGENTS.md). |

---

## 4. Phase 1 — Speed

### 4.1 Real-user monitoring (first, so every later change is measured)

- **Client:** add `web-vitals` (about 2 KB gz). `src/lib/rum.ts` records LCP, INP, CLS, FCP, TTFB per page view and sends one batch with `navigator.sendBeacon` when the page is hidden. Body is `text/plain` JSON, so the cross-origin request needs no preflight.
- **Fields sent:** route **name** (never the path, so no slugs or tokens), metric, value, rating, device class (`mobile` / `tablet` / `desktop` from screen width and pointer), `navigator.connection.effectiveType` when present, navigation type. No user id, no IP, no user agent string.
- **API:** `POST /api/rum` (public). Accepts up to 10 samples, validates names against an allowlist, rate-limited 60/min per hashed IP, returns 204. Writes to `rum_samples`.
- **Rollup:** the hourly cron (§6.3) writes `rum_daily(day, route, metric, device, p75, samples)` for finished days. Raw `rum_samples` are deleted after 30 days.
- **Admin → Speed** (`/admin/speed`): p75 per metric for the last 7 and 28 days, by route and device, with the Core Web Vitals thresholds marked. A sparkline per metric shows the trend.
- **Targets** (p75, mobile): LCP ≤ 2.0 s on public pages and ≤ 2.5 s on app pages, INP ≤ 200 ms, CLS ≤ 0.05.

### 4.2 Stop blocking the first paint

- `router.beforeEach` awaits `session.load()` only when the target route (or a parent) has `requiresAuth`, `requiresAdmin`, `requiresOrg`, or is `login` / `consent`. Every other route calls `session.load()` without awaiting it, and the shell shows the signed-out state until it resolves.
- The consent redirect still runs for signed-in users once the session resolves (a watcher in the session store routes to `/consent` if needed).
- `index.html` gets `<link rel="preconnect" href="https://api.eypi.cc" crossorigin>`.
- Home stops waiting on `/api/stats` for anything above the fold: totals render as reserved-size placeholders (no layout shift) and fill in.

### 4.3 Smaller bundles

- **Two shells.** Route meta `layout: 'app' | 'public'`. `App.vue` loads `AppShell` with `defineAsyncComponent` only for `layout: 'app'`. Public routes (`home`, `login`, `frames` public, `tix` public, `t`, `unlock`, `expired`, `report`, legal pages, redirect, not-found) render in a light `PublicShell` (header, footer, no rail, no account menu).
- **Charts.** New `src/components/charts/`: `SparkLine`, `LineChart`, `BarList` (horizontal bars for top-N), `HeatGrid` (hour-of-week), `StatTile`. Plain SVG, tokens from `DESIGN_SYSTEM.md`, accessible table fallback. Remove `chart.js` and `vue-chartjs`.
- **Prefetch.** A `v-prefetch` directive on nav links and list rows: on `pointerenter`, `focus`, or when the link has been visible for 1 s on an idle callback, it calls the route's lazy component loader and the route's optional `meta.prefetch()` data loader. Skipped when `navigator.connection.saveData` is true.
- **Budgets in CI.** Enable `build.manifest`. Extend `scripts/lib/releaseChecks.mjs` with gzip budgets, enforced by `release:check` and CI:

| Chunk | Budget (gz) |
|---|---|
| Entry JS (public shell, router, session, api) | ≤ 70 KB |
| Entry CSS | ≤ 22 KB |
| Any route chunk except Forms generators and the attendee importer | ≤ 40 KB |
| Total JS loaded by `/frames/:slug`, `/tix/:slug`, `/t/:token` | ≤ 110 KB |

### 4.4 Client data cache

- `src/lib/queryCache.ts`: `useQuery(key, fetcher, { staleMs = 30_000 })` returns `{ data, error, status, refresh }`. A cached value is shown immediately and refreshed in the background when stale. In-flight requests for the same key are shared.
- `invalidate(prefix)` is called by mutations (for example `invalidate('links:')` after create/edit/delete).
- The whole cache clears on sign-out, on org switch (`X-Active-Org-Id` changes) and on a 401.
- Migrate Dashboard, Links list, Orgs, Events list, Frames list first; others as they are touched.

### 4.5 Images

**Variants at upload** (`src/lib/images/variants.ts`):

1. `createImageBitmap(file, { imageOrientation: 'from-image' })`.
2. For each width in the profile that is smaller than the source, draw on an `OffscreenCanvas` (fallback `<canvas>`) with high-quality smoothing and encode per E3. Check the returned `blob.type`; fall back when the browser ignored WebP.
3. Make a placeholder: a 16 px-wide WebP/JPEG as a data URL (about 300–600 bytes).
4. Send the original plus the variants in one multipart request.

| Profile | Shown at | Variant widths |
|---|---|---|
| Org logo | ≤ 96 CSS px | 96, 192, 384 |
| Org banner, event cover | full width | 640, 1280, 1920 |
| Frame (picker and preview only) | ≤ 512 CSS px | 256, 512, 1024 |
| QR logo | inside the QR | 512 (replaces the stored image; the original is not needed) |

The Frames canvas merge and frame downloads keep using the **original** frame, so the final photo is full quality.

**Storage:**

- Keys: the original keeps its current pattern. Variants are `{originalKeyWithoutExt}-{width}.{webp|jpg|png}`.
- New nullable JSON columns (migration `0010`): `organizations.logo_meta`, `organizations.banner_meta`, `dp_frames.image_meta`, and later `events.cover_meta`. Shape `{ w, h, fmt, widths: number[], ph }` where `ph` is the placeholder data URL.
- The backend validates each variant: magic bytes (WebP, JPEG, PNG), decoded size not larger than the original, at most 2 MB per variant, widths from the profile only. Old variants are deleted with the old original.

**Serving:**

- `<AppImage>` (`src/components/AppImage.vue`): props `src`, `meta`, `alt`, `sizes`, `priority`. Renders `width`/`height` from `meta` (no layout shift), `srcset` from `meta.widths`, `loading="lazy"` and `decoding="async"` unless `priority`, then `fetchpriority="high"`. Shows `meta.ph` as a blurred background until load. Falls back to the original when `meta` is null.
- Replace every `<img>` in `OrgLogo`, `OrgCatalogView`, `OrgProfileView`, `OrgModifyView`, `DpFrameUploader`, `DpPublicView`, `BrandLogo`.
- `public/eypi-mark.png` (28 KB) gets a WebP sibling and explicit dimensions.
- `worker/index.ts` `servePublicMedia`: check `caches.default` first; on a miss, read R2 and `ctx.waitUntil(cache.put(...))`. Add `ETag` from the R2 object and answer `If-None-Match` with 304.

**Backfill:** Admin → Maintenance → **Optimize images** lists media rows with null `*_meta`, downloads each original through `/media/`, runs the same variant code in the browser, and uploads with `POST /api/admin/media/variants` (admin-only, audit-logged). It processes one image at a time, shows progress, and can be re-run safely (rows with meta are skipped).

### 4.6 Edge and API

- **Placement.** Backend `wrangler.jsonc` gets `placement`. If the owner reports the Turso region (owner guide step 2) and it maps to a cloud region, use `"region": "aws:<region>"`; otherwise `"mode": "smart"`. The frontend Worker is unchanged (its only database call is the async click log).
- **Public GET caching.** These responses ignore the session and get `Cache-Control: public, max-age=30, stale-while-revalidate=300` plus a backend Cache API lookup keyed by URL: public org profile, public org catalog, public Frames campaign, public event page (§5.5), `/api/stats`.
- **Query fixes.** R-6: filter `check_ins` by `event_id` inside the window subquery. Audit the other list queries for full scans with `EXPLAIN QUERY PLAN` in tests against the migrated in-memory schema.

### 4.7 Service worker

- `public/sw.js`, registered from `main.ts` after `load` in production only.
- **Assets** (`/assets/*`): cache-first (immutable, hashed). A post-build step writes the entry chunk list into `sw.js` for precaching, so a repeat visit needs no network for the shell.
- **HTML:** network-first with a 3 s timeout, falling back to the cached shell.
- **Media** (`/media/*`): cache-first, capped at 150 entries (oldest evicted).
- **API:** never cached by the service worker, except `GET /api/tickets` and `GET /api/tickets/guest/:token` (network-first, cached copy shown offline with an "Offline — last updated …" note). See §5.5.
- **Kill switch:** if `sw.js` ever ships broken, deploying the documented `sw-kill.js` contents as `sw.js` unregisters it and clears its caches on every client's next visit (owner guide, "Emergency").

---

## 5. Phase 2 — Tix rework

Unify, don't rebuild: one attendee pool with a status, used by every admission mode. Imports and self-registrations land in the same table.

### 5.1 Data model (migration `0011_tix_registration`, additive)

`events` gets:

| Column | Type | Default for existing rows | Notes |
|---|---|---|---|
| `status` | TEXT | `'published'` | `draft` · `published` · `closed` · `cancelled` |
| `admission_mode` | TEXT | `'import'` | `fcfs` · `lottery` · `approval` · `import` |
| `visibility` | TEXT | `'unlisted'` | `public` (listed on the org profile) · `unlisted` (link only) |
| `description` | TEXT | NULL | Markdown, sanitized with the existing `marked` + DOMPurify path, ≤ 4,000 chars |
| `cover_key`, `cover_meta` | TEXT | NULL | §4.5 profile "event cover" |
| `end_time` | TEXT | NULL | optional, `HH:MM` Manila |
| `registration_opens_at`, `registration_closes_at` | DATETIME | NULL | UTC; NULL opens = on publish, NULL closes = event start |
| `waitlist_enabled` | INTEGER | 0 | FCFS and lottery only |
| `questions` | TEXT | `'[]'` | up to 5: `{ id, label, type: 'text'|'choice'|'checkbox', options?, required }` |
| `lottery_drawn_at` | DATETIME | NULL | set once by the draw |

Capacity keeps using `max_attendees`.

`attendees` gets:

| Column | Type | Default for existing rows | Notes |
|---|---|---|---|
| `user_id` | TEXT → `users(id)` ON DELETE SET NULL | NULL | set for self-registrations and for imports whose email matches an APC user |
| `status` | TEXT | `'confirmed'` | see 5.2 |
| `source` | TEXT | `'import'` | `self` · `import` · `manual` |
| `answers` | TEXT | `'{}'` | answers to `events.questions` |
| `registered_at` | DATETIME | backfilled to the migration time | orders the waitlist. Added as nullable (SQLite cannot add a column with a `CURRENT_TIMESTAMP` default), then `UPDATE attendees SET registered_at = CURRENT_TIMESTAMP WHERE registered_at IS NULL`; new rows set it explicitly |
| `decided_at`, `decided_by` | DATETIME, TEXT | NULL | approval, decline, org cancel |
| `guest_token_hash` | TEXT UNIQUE | NULL | sha256 of the guest link token |

Indexes: unique `attendees(event_id, user_id) WHERE user_id IS NOT NULL`; `attendees(event_id, status, registered_at)`; `check_ins(event_id, attendee_id, actioned_at)`.

The migration also sets `status = 'cancelled'` for attendees whose latest `check_ins.action` is `'removed'`. New code writes only `checked_in` / `checked_out` to `check_ins`; removal is a status change.

`event_csv_rows` stays during this phase: the importer reads the uploaded file into it as today, and finalize turns selected rows into `attendees` (`source = 'import'`). Dropping `event_csv_rows` is a later, destructive migration that needs separate owner approval and is not part of this spec.

### 5.2 Status machine (`backend/src/lib/tix/admission.ts`, pure and unit-tested)

```
                 fcfs (seat free) ─────────────► confirmed
register ──┬──── fcfs (full, waitlist on) ─────► waitlisted ──(seat frees)──► confirmed
           ├──── fcfs (full, waitlist off) ────► rejected with 409 event_full (no row)
           ├──── lottery ──────────────────────► entered ──(draw)──► confirmed | waitlisted | declined
           └──── approval ─────────────────────► pending ──(org)──► confirmed | declined
import / add guest ────────────────────────────► confirmed   (or entered, if the org imports into a lottery)
confirmed | waitlisted | pending | entered ──(attendee or org cancels)──► cancelled
```

- **FCFS seat check** is a single conditional insert, so two people cannot take the last seat: `INSERT … SELECT … WHERE (SELECT COUNT(*) FROM attendees WHERE event_id = ? AND status = 'confirmed') < ?`, then a waitlist insert when it affected 0 rows.
- **Waitlist promotion** runs in the same batch as any cancel or capacity increase: promote the oldest `waitlisted` row while seats are free.
- **Lottery draw** is a button for org members after registration closes. It reuses `src/lib/tix/selection.ts` (clusters, quotas, seeded shuffle) on `entered` rows, with clusters built from a question's answers or imported columns. The seed is stored, so the result can be re-derived. The draw is guarded (`UPDATE events SET lottery_drawn_at = … WHERE id = ? AND lottery_drawn_at IS NULL`).
- **Check-in** is allowed only for `confirmed`.

### 5.3 API (split `routes/events.ts` into `routes/events/`)

All new and changed routes use `{ error: { code, message, fields? } }` and `lib/errors.ts`. Existing routes move to the new shape as they are split.

| File | Routes |
|---|---|
| `manage.ts` | create/update/delete event, publish/close/cancel, questions, cover upload |
| `registrations.ts` | `POST /api/events/:slug/register`, `DELETE /api/events/:slug/registration` (attendee cancel), `GET /api/tickets` (my tickets) |
| `inbox.ts` | list attendees with filters and cursor paging, bulk approve/decline/cancel, capacity change |
| `lottery.ts` | clusters, draw |
| `import.ts` | existing CSV/XLSX selection and finalize, add guest |
| `guests.ts` | issue or rotate a guest link, `GET /api/tickets/guest/:token`, export attendees CSV with links |
| `door.ts` | roster download, check-in, check-out, `POST /api/events/:slug/checkins/sync`, live counts |
| `public.ts` | `GET /api/events/:slug/public`, Google Wallet pass |

Notes:

- `GET /api/tickets` also links imported tickets: rows with `user_id IS NULL AND lower(email) = <session email>` get `user_id` set, so an imported APC student finds their ticket without a guest link.
- Guest token: 24 random bytes, base64url, shown once to the org when issued (and in the CSV export). Only the sha256 is stored. Rotating invalidates the old link. `GET /api/tickets/guest/:token` is rate-limited per IP (30/10 min) and returns 404 for cancelled tickets.
- The old `POST /api/events/:slug/lookup` (name + email) is removed in this phase. The feature is unused in production.
- Wallet passes keep `PASS_TOKEN_SECRET` and the `pass_fields` allowlist.

### 5.4 Account deletion

`deleteAccount` deletes the user's `source = 'self'` attendee rows for events that have not happened yet, and sets `user_id = NULL` on the rest (the org keeps its attendance record for past events). The privacy policy states this.

### 5.5 Attendee experience

- **Event page** `/tix/:slug` (existing reserved route, now the public event page): cover, name, date and time, location, description, seats left (FCFS), registration window, and one primary action whose label follows the state: Register, Join waitlist, Enter lottery, Request a spot, Registration closed, You're in. Signed-out visitors are sent through Microsoft sign-in and back. Worker `HTMLRewriter` adds title, description and `og:image` (cover).
- **Register sheet:** the event's questions, then a clear result: confirmed, waitlisted (with position), entered, pending.
- **My tickets** `/tickets` (new, `requiresAuth`, in the rail): upcoming first, then past. Each ticket shows a large QR on white with screen brightness tips, status, Google Wallet button, "Add to calendar" (`.ics` built in the browser), cancel registration, and works offline through the service worker.
- **Guest ticket** `/t/:token` (new, public shell): the same ticket card, no sign-in.
- **Status changes** (approved, promoted from waitlist, lottery result) show as a badge on My tickets in the rail, driven by a `ticketUpdates` count in `GET /api/me` (tickets whose `decided_at` is newer than the user's last My tickets visit).

New reserved slugs: `t`, `tickets`. Before adding them, query production for existing links with those slugs and report them to the owner (owner guide step 6).

### 5.6 Org experience (`/manage/tix`)

- **Event builder:** one page with sections (basics, cover, admission, capacity and waitlist, registration window, questions, wallet pass fields). Save as draft; Publish shows a summary first.
- **Attendees inbox:** tabs by status with counts, search, filters by answer, bulk approve / decline / cancel, per-row guest link copy, CSV export (name, email, status, source, answers, guest link if issued).
- **Lottery:** shows entries per cluster and quotas, a "Draw" confirm with the seed, then results.
- **Door mode** (`/manage/tix/:slug/door`): fullscreen scanner (existing `useQrScanner`), big result colors with text (not color alone), sound and haptics per result, manual search, live counters.
  - **Offline:** on open, it downloads the roster (`id`, `qr_token`, name, status) into IndexedDB. Scans are checked against the local roster and queued with a client-generated check-in id and timestamp. The queue syncs every 5 s when online; the server inserts idempotently by id and reports conflicts (for example "already checked in on another device"). A banner shows "Offline — 12 check-ins waiting to sync".
  - **Several devices:** each device polls live counts (§6.5), so all doors see the same totals.

---

## 6. Phase 3 — Analytics

### 6.1 Richer link clicks (migration `0012_analytics`)

- `analytics` gets `device` (`mobile` · `tablet` · `desktop`), `browser` (Chrome, Safari, Firefox, Edge, Samsung, Opera, Other) and `app` (`messenger` · `facebook` · `instagram` · `tiktok` · `x` · `line` · `discord` · NULL), parsed from the user agent in `shared/linkAnalytics.ts` by both click paths (edge and SPA fallback). In-app browsers matter here: most APC sharing happens in Messenger and Facebook.
- The user agent string itself is still not stored.

### 6.2 Link analytics panel

- Range picker: 7 / 30 / 90 days / custom, plus "compare to previous period" (deltas on every tile).
- Tiles: clicks, unique visitors per day (averaged; visitor hashes rotate daily by design, so cross-day uniques are not claimed), QR share.
- Charts (§4.3 components): clicks over time, hour-of-week heat grid (Manila time), top referrers, source apps, countries, devices, browsers, OS.
- CSV export keeps its current columns and adds device, browser and app.

### 6.3 Rollups

- `analytics_daily(link_id, day, clicks, uniques, qr, PRIMARY KEY (link_id, day))`.
- `analytics_daily_dim(link_id, day, dim, value, clicks, PRIMARY KEY (link_id, day, dim, value))`, with `dim` in `country, os, device, browser, app, referrer, how` (`how` = hour of week 0–167, Manila).
- Days are Manila calendar days. A new hourly cron (`15 * * * *`, beside the daily retention cron) recomputes **yesterday and today** for links with clicks in that window (delete then insert, in one batch per link set), and RUM and module rollups the same way.
- Read path: rollups for days before today, plus raw rows for today.
- Retention: raw `analytics` rows older than 400 days are deleted by the daily job after their rollups exist. The privacy policy is updated to say so (owner review, owner guide step 7).

### 6.4 Module analytics

- `module_events(id, org_id, module, subject_id, action, visitor_hash, day, created_at)` with modules and actions:
  - Frames: `view`, `photo_added`, `download`, `share` (sent by `DpPublicView` with `sendBeacon` to `POST /api/beacon`, rate-limited per visitor).
  - Org profile: `view`.
- `module_daily(subject_id, module, action, day, n, uniques)` built by the hourly cron.
- **Frames insights** (campaign editor tab): views → photo added → downloaded or shared, conversion rate, per-frame downloads, daily trend.
- **Tix insights** (event tab), computed from `attendees` and `check_ins`: registrations over time, by status, by answer, show-up rate, check-in curve by 10-minute buckets.
- **Org insights** `/orgs/:slug/insights` (activated members): profile views, Frames totals, Tix totals across events, member count trend. Links stay personal and are not shown here.

### 6.5 Live view

- `GET /api/links/summary/live` (dashboard) and `GET /api/events/:slug/live` (door and event page for org members) return small payloads with a weak `ETag`. Clients poll every 5 s while the tab is visible, sending `If-None-Match`; unchanged → 304.
- Dashboard: "Clicks in the last 60 minutes" sparkline and a short recent-clicks list (time, country, source app; no visitor ids).
- Event: checked in / confirmed, arrivals in the last 10 minutes.

---

## 7. Phase 4 — UX and design polish

Starts with an audit, so changes target real problems:

1. **Audit:** screenshot every route at 375 px and 1280 px in the in-app browser, signed out and signed in, and list issues against `DESIGN_SYSTEM.md` (spacing, hierarchy, empty states, loading states, touch targets ≥ 44 px, focus, copy). The list is added to this phase's plan before any change.
2. **Planned improvements** (kept or dropped based on the audit):
   - Skeletons that match the final layout instead of spinners.
   - Optimistic updates with an Undo toast (link delete, attendee cancel) instead of confirm dialogs, where the action can be undone.
   - Route transitions with the View Transitions API, skipped under `prefers-reduced-motion`.
   - `Ctrl+K` / `⌘K` command palette: go to a page, create a link, switch org, open My tickets.
   - Empty states with one clear primary action.
   - PWA install entry in the account menu (no pop-up prompts).

---

## 8. Testing

- Every task follows the AGENTS.md definition of done: tests first, failing, then passing; `npm run typecheck`, `npm test`, `npm run lint` green.
- **Pure units:** admission state machine, FCFS and waitlist rules, lottery seeding, UA parsing (device, browser, app), rollup day boundaries in Manila time, image variant planning (widths, format fallback), query cache, RUM payload validation.
- **Route tests** (in-memory libSQL with all migrations): authz matrix for every new route (anonymous, other user, other org, org member, admin); FCFS last-seat race (two concurrent registers, one confirmed); idempotent check-in sync; guest token rotate; `GET /api/tickets` email linking; cache headers on public GETs.
- **Component tests:** `AppImage` (srcset, dimensions, priority), charts (table fallback), door mode offline queue (fake IndexedDB), My tickets offline banner.
- **Budgets:** the bundle budget check runs in `release:check` and CI.
- **Speed verification per phase:** compare Admin → Speed p75 for the 7 days before and after each deploy, recorded in the phase plan's final task.

## 9. Migrations and release

| Migration | Phase | Content | Destructive? |
|---|---|---|---|
| `0010_perf_media` | 1 | `*_meta` image columns, `rum_samples`, `rum_daily` | No |
| `0011_tix_registration` | 2 | §5.1 columns and indexes, `removed` → `cancelled` status backfill | No (`UPDATE … WHERE` only) |
| `0012_analytics` | 3 | `analytics.device/browser/app`, rollup tables, `module_events`, `module_daily` | No |

Migrations are numbered in the order the phases ship, and the runner applies pending files in filename order, so a phase never depends on a later file.

Each phase follows `docs/RELEASE.md`: rehearse on a Turso branch, apply migrations, deploy backend, deploy frontend, smoke, then the phase's owner steps in `docs/owner-guide-speed-tix-analytics.md`.

## 10. Risks

| Risk | Mitigation |
|---|---|
| A broken service worker keeps serving old code | Network-first HTML, versioned cache names, documented kill switch |
| Safari ignores WebP encoding | Format check on the returned blob, JPEG/PNG fallback (E3) |
| Not awaiting the session shows a signed-out flash on public pages | Public pages don't depend on the session; the header shows a neutral placeholder until it resolves |
| Offline door devices disagree | Server is the source of truth; idempotent sync reports conflicts on screen |
| Rollup job misses an hour | It recomputes yesterday and today every run, so the next run repairs it |
| Smart Placement makes the API slower | Cloudflare reverts it automatically (`UNSUPPORTED_APPLICATION`); RUM shows it either way |
