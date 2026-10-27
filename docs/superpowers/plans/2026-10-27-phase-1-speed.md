# Phase 1 — Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure real-user speed, then make every page load and navigate fast: non-blocking public routes, smaller bundles, cached data, right-sized images, edge caching and an offline-capable shell.

**Architecture:** RUM beacons land in Turso and roll up hourly into p75s shown on Admin → Speed. The SPA splits into a light public shell and a lazy app shell, with a small stale-while-revalidate cache and prefetching. Images get browser-made variants stored next to the R2 original and are rendered by one `<AppImage>` component. The edge Worker caches media; a hand-written service worker caches the shell.

**Tech Stack:** Vue 3, vue-router 4, Vite 6, Hono on Workers, Turso/libSQL, R2, Vitest + happy-dom, `web-vitals` (new, only new dependency).

**Spec:** `docs/superpowers/specs/2026-10-27-eypi-speed-tix-analytics-design.md` §4 (read §1–3 too).

## Global Constraints

- Stay on Vue 3 SPA + Hono Workers + Turso + R2 + KV. Only new runtime dependency in this phase: `web-vitals`. Remove `chart.js` and `vue-chartjs`.
- Image encoding: WebP quality `0.86`; if the returned blob is not `image/webp`, JPEG `0.86` for opaque images, PNG for images with alpha. No AVIF.
- RUM sends route **name** only, never paths; no user id, IP or user-agent string.
- API errors use `{ error: { code, message, fields? } }` via `backend/src/lib/errors.ts`.
- Visuals follow `DESIGN_SYSTEM.md` (light only, APC tokens; no `dark:` utilities).
- Migrations are additive; never destructive SQL.
- Every task: test first and see it fail, then pass; `npm run typecheck`, `npm test`, `npm run lint` green before commit.
- Commits: `type(scope): lowercase imperative subject`, bullet body, **no Co-Authored-By or any tool trailer**. One commit per task, on `main`.
- Never deploy, migrate production, or change Cloudflare/Turso settings. Those are owner steps (`docs/owner-guide-speed-tix-analytics.md`).

## Review Focus

- A RUM batch with an unknown route name, NaN/negative/huge values, or 11+ samples must be rejected with 400 and write nothing (Task 1 test `rejects malformed batches`).
- A signed-in user who needs consent and lands on a public page must still be sent to `/consent` once the session resolves (Task 6 test `routes to consent after a background load`).
- Safari ignores `toBlob('image/webp')`: variants must fall back to JPEG/PNG with the right extension (Task 11 test `falls back when webp is not encoded`).
- A user from another org must not write variants for a key they don't own (Task 12 authz test `rejects other org`).
- A stale service worker must never serve old HTML forever: HTML is network-first with a 3 s timeout (Task 18 test `html is network first`).

---

### Task 1: RUM storage and ingest endpoint

**Files:**
- Create: `backend/migrations/0010_perf_media.sql`
- Create: `backend/src/lib/rum.ts`, `backend/src/lib/rum.test.ts`
- Create: `backend/src/routes/rum.ts`, `backend/src/routes/rum.test.ts`
- Modify: `backend/src/index.ts` (mount route)

**Interfaces:**
- Produces: tables `rum_samples(id INTEGER PK AUTOINCREMENT, day TEXT, route TEXT, metric TEXT, value REAL, rating TEXT, device TEXT, connection TEXT, nav_type TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`, index `(day)`; `rum_daily(day, route, metric, device, p75 REAL, samples INTEGER, PRIMARY KEY(day, route, metric, device))`; nullable TEXT columns `organizations.logo_meta`, `organizations.banner_meta`, `dp_frames.image_meta`.
- Produces: `RUM_METRICS = ['LCP','INP','CLS','FCP','TTFB'] as const`, `RUM_ROUTES: ReadonlySet<string>` (built from router route names, kept in `shared/rumRoutes.ts` so client and server share it), `parseRumBatch(body: unknown): RumSample[] | null`, type `RumSample = { route: string; metric: RumMetric; value: number; rating: 'good'|'needs-improvement'|'poor'; device: 'mobile'|'tablet'|'desktop'; connection: string | null; navType: string | null }`.
- Produces: `POST /api/rum` → 204.

- [x] **Step 1: Write failing tests.** `rum.test.ts`: `accepts a valid batch` (2 samples → 2 parsed); `rejects malformed batches` (unknown route, `value: NaN`, `value: -1`, `value: 1e9` for LCP, 11 samples, non-array → `null`). Route test: `stores samples and returns 204` (count rows = 2, `day` = UTC date); `returns 400 on malformed`; `rate limits at 60 per minute per IP` (61st → 429); body sent as `text/plain` is accepted.
- [x] **Step 2: Run** `npx vitest run backend/src/lib/rum.test.ts backend/src/routes/rum.test.ts` → FAIL (module not found).
- [x] **Step 3: Implement.** Migration as above. `parseRumBatch` caps values: CLS ≤ 10, others ≤ 120000 ms. Route reads `await c.req.text()` then `JSON.parse` (sendBeacon sends text/plain), rate-limits with `checkRateLimit(c.env.RATE_LIMIT_KV, { bucket: 'rum', subject: <ip hash>, limit: 60, windowSec: 60 })`, inserts in one `batch`. No session middleware on this route.
- [x] **Step 4: Run** the same command → PASS; then `npm run typecheck`.
- [x] **Step 5: Commit** `feat(perf): add real-user speed sample ingest`.

### Task 2: RUM client

**Files:**
- Create: `src/lib/rum.ts`, `src/lib/rum.test.ts`, `shared/rumRoutes.ts`
- Modify: `src/main.ts`, `package.json` (add `web-vitals`)

**Interfaces:**
- Consumes: `RUM_ROUTES`, `POST /api/rum`.
- Produces: `startRum(router: Router, send?: (url: string, body: string) => boolean): void`, `deviceClass(width: number, coarsePointer: boolean): 'mobile'|'tablet'|'desktop'` (<768 mobile, <1024 tablet when coarse, else desktop).

- [x] **Step 1: Write failing tests:** `deviceClass` table cases; `flushes one batch on visibilitychange hidden` (mock `web-vitals` callbacks, fake `send`, assert one call to `${API_BASE}/api/rum` with route name `'links'`, not the path); `does nothing in dev` (`import.meta.env.PROD` false → no listeners).
- [x] **Step 2: Run** `npx vitest run src/lib/rum.test.ts` → FAIL.
- [x] **Step 3: Implement** with `onLCP/onINP/onCLS/onFCP/onTTFB` from `web-vitals`, buffer per page, flush on `visibilitychange`→hidden and on route change via `navigator.sendBeacon`. Call `startRum(router)` in `main.ts` after mount.
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(perf): send core web vitals from the browser`.

### Task 3: Hourly rollups cron

**Files:**
- Create: `backend/src/jobs/rollups.ts`, `backend/src/jobs/rollups.test.ts`
- Modify: `backend/src/index.ts` (`scheduled` dispatch by `controller.cron`), `backend/wrangler.jsonc` (`"crons": ["0 19 * * *", "15 * * * *"]`), `backend/src/jobs/retention.ts` (delete `rum_samples` older than 30 days)

**Interfaces:**
- Produces: `runHourlyRollups(db: Client, now: Date): Promise<void>` (Phase 3 adds link and module rollups to it), `p75(values: number[]): number` (nearest-rank: sort ascending, index `ceil(0.75 * n) - 1`).

- [x] **Step 1: Failing tests:** `p75([1,2,3,4]) === 3`, `p75([5]) === 5`; `rolls up yesterday and today` (seed samples on 2 days, run, assert `rum_daily` rows and p75 values); `is idempotent` (run twice → same rows); retention test `deletes rum samples older than 30 days`; `scheduled dispatches hourly cron to rollups and daily cron to retention`.
- [x] **Step 2: Run** `npx vitest run backend/src/jobs` → FAIL.
- [x] **Step 3: Implement.** For each of yesterday/today (UTC days, same as `rum_samples.day`): read samples grouped in JS by `(route, metric, device)`, compute p75, then one batch: `DELETE FROM rum_daily WHERE day = ?` + inserts.
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(perf): roll up speed samples every hour`.

### Task 4: SVG chart components

**Files:**
- Create: `src/components/charts/{SparkLine,LineChart,BarList,HeatGrid,StatTile}.vue`, `src/components/charts/charts.test.ts`, `src/components/charts/scale.ts`

**Interfaces:**
- Produces props: `SparkLine { values: number[]; label: string }`; `LineChart { series: { label: string; points: { x: string; y: number }[] }[]; yLabel: string }`; `BarList { items: { label: string; value: number }[]; max?: number }`; `HeatGrid { cells: number[] /* length 168, Mon 00:00 first */; label: string }`; `StatTile { label: string; value: string; delta?: number | null }`. `scale.ts`: `linearScale(domain: [number, number], range: [number, number]): (v: number) => number`, `niceTicks(max: number, count?: number): number[]`.

- [x] **Step 1: Failing tests:** each chart renders an `<svg role="img" aria-label=...>` plus a visually hidden `<table>` with the same numbers; `HeatGrid` throws a dev warning and renders nothing when `cells.length !== 168`; `StatTile` shows `+12%`/`−5%` with text, not color only; `niceTicks(87)` → `[0, 20, 40, 60, 80, 100]`.
- [x] **Step 2: Run** `npx vitest run src/components/charts` → FAIL.
- [x] **Step 3: Implement** with plain SVG and CSS tokens from `DESIGN_SYSTEM.md`. Load the `dataviz` skill before choosing colors.
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(ui): add lightweight svg chart components`.

### Task 5: Admin → Speed page

**Files:**
- Modify: `backend/src/routes/admin.ts` (+ test in `admin.test.ts`)
- Create: `src/views/admin/AdminSpeedView.vue`, `src/views/admin/AdminSpeedView.test.ts`
- Modify: `src/router/index.ts` (`/admin/speed`, name `admin-speed`), admin nav in `src/views/admin/AdminLayout.vue`

**Interfaces:**
- Consumes: `rum_daily`, Task 4 charts.
- Produces: `GET /api/admin/speed?days=7|28` → `{ thresholds: { LCP: [2500, 4000], INP: [200, 500], CLS: [0.1, 0.25], FCP: [1800, 3000], TTFB: [800, 1800] }, rows: { route, metric, device, p75, samples }[], trend: { metric, day, p75 }[] }` (p75 across routes weighted by samples).

- [x] **Step 1: Failing tests:** authz (anonymous 401, user 403, admin 200); `days=99` → 400; view renders one tile per metric and marks values above the "good" threshold with text "Needs work".
- [x] **Step 2: Run** `npx vitest run backend/src/routes/admin.test.ts src/views/admin/AdminSpeedView.test.ts` → FAIL.
- [x] **Step 3: Implement.**
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(admin): show real-user speed on an admin page`.

### Task 6: Stop blocking the first paint

**Files:**
- Modify: `src/router/index.ts`, `src/stores/session.ts`, `index.html`, `src/views/HomeView.vue` (or its stats component)
- Test: `src/router/guard.test.ts` (create), `src/stores/session.test.ts`

**Interfaces:**
- Produces: `routeNeedsSession(to: RouteLocationNormalized): boolean` exported from `src/router/guards.ts` (true if any matched record has `requiresAuth`, `requiresAdmin` or `requiresOrg`, or name is `login`/`consent`); session store `onReady(cb: () => void): void`.

- [x] **Step 1: Failing tests:** `public route resolves without waiting for /api/me` (pending fetch; navigation to `/frames/x` completes); `protected route waits`; `routes to consent after a background load` (user needing consent on `/frames/x` → after load resolves, router is at `consent` with `returnTo`); home renders stat placeholders with fixed height before `/api/stats` resolves.
- [x] **Step 2: Run** `npx vitest run src/router src/stores/session.test.ts` → FAIL.
- [x] **Step 3: Implement.** Guard: `if (routeNeedsSession(to)) await session.load(); else void session.load()`. Consent redirect for the background case runs from `session.onReady`. Add `<link rel="preconnect" href="https://api.eypi.cc" crossorigin>` to `index.html`.
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `perf(routing): render public pages without waiting for the session`.

### Task 7: Public shell and lazy app shell

**Files:**
- Create: `src/components/layout/PublicShell.vue`, `PublicShell.test.ts`
- Modify: `src/App.vue`, `src/router/index.ts` (add `meta.layout: 'public'` to `home, login, dp-public (frames), tix public, unlock, expired, report, privacy, terms, acceptable-use, contact, redirect, not-found`)
- Test: `src/App.test.ts` (create)

**Interfaces:**
- Produces: `RouteMeta.layout?: 'app' | 'public'` (default `'app'`), declared in `src/router/meta.d.ts`.

- [x] **Step 1: Failing tests:** `public routes render PublicShell and never import AppShell` (spy on the async loader); `app routes render AppShell`.
- [x] **Step 2: Run** `npx vitest run src/App.test.ts src/components/layout/PublicShell.test.ts` → FAIL.
- [x] **Step 3: Implement.** `AppShell` via `defineAsyncComponent(() => import(...))`. `PublicShell` = brand header (logo, Sign in or Dashboard link), slot, slim footer, using the existing footer markup from `AppShell`.
- [x] **Step 4: Run** → PASS; `npm run build` and note the entry gz size in the commit body.
- [x] **Step 5: Commit** `perf(shell): load the app shell only on signed-in pages`.

### Task 8: Replace chart.js in link analytics

**Files:**
- Modify: `src/components/AnalyticsPanel.vue` (+ its test if present), `package.json` (remove `chart.js`, `vue-chartjs`)

**Interfaces:**
- Consumes: Task 4 `LineChart`, `BarList`, `StatTile`.

- [x] **Step 1: Failing test:** `AnalyticsPanel renders timeline with LineChart and top lists with BarList` and `no chart.js import` (grep the module source in the test).
- [x] **Step 2: Run** → FAIL.
- [x] **Step 3: Implement**; `npm uninstall chart.js vue-chartjs`.
- [x] **Step 4: Run** tests and `npm run build` → the AnalyticsPanel chunk is ≤ 15 KB gz.
- [x] **Step 5: Commit** `perf(links): draw analytics with svg instead of chart.js`.

### Task 9: Bundle budgets

**Files:**
- Modify: `vite.config.ts` (`build: { manifest: true }`), `scripts/lib/releaseChecks.mjs`, `scripts/release-check.mjs`, `scripts/lib/releaseChecks.test.mjs`

**Interfaces:**
- Produces: `checkBundleBudgets(manifest: Record<string, ManifestChunk>, gzSize: (file: string) => number): string[]` with budgets: entry JS ≤ 70 KB, entry CSS ≤ 22 KB, any route chunk ≤ 40 KB except names matching `/useDocxGenerator|exceljs|AttendeeSelection|jszip|papaparse|qr-scanner/`, and total JS for routes `dp-public`, tix public, `guest-ticket` (once it exists) ≤ 110 KB (entry + its static imports + the route chunk).

- [x] **Step 1: Failing tests:** over-budget entry → one problem string naming the file and size; exempt chunk ignored; within budget → `[]`.
- [x] **Step 2: Run** `npx vitest run scripts/lib/releaseChecks.test.mjs` → FAIL.
- [x] **Step 3: Implement**; call it in `release-check.mjs` step 5 using `zlib.gzipSync`.
- [x] **Step 4: Run** `npm run build && npm run release:check -- --allow-dirty` → budgets pass. If the entry is over 70 KB, find what Task 7 left in it (`npx vite-bundle-visualizer` is fine to run ad hoc, don't add it) and move it behind a lazy import in this task.
- [ ] **Step 5: Commit** `build(perf): enforce gzip bundle budgets in the release check`.

### Task 10: Client query cache

**Files:**
- Create: `src/lib/queryCache.ts`, `src/lib/queryCache.test.ts`
- Modify: `src/stores/session.ts` (clear on logout/reset), `src/composables/useOrgMembership.ts` (clear on org switch), `src/lib/api.ts` (clear on 401), `src/views/DashboardView.vue`, `src/composables/useLinks.ts`, `src/views/orgs/OrgCatalogView.vue`, `src/views/tix/EventsView.vue`, `src/views/dp/DpCampaignsView.vue`

**Interfaces:**
- Produces: `useQuery<T>(key: string | (() => string), fetcher: () => Promise<T>, opts?: { staleMs?: number }): { data: Ref<T | undefined>; error: Ref<unknown>; status: Ref<'idle'|'loading'|'ready'|'error'>; refresh: () => Promise<void> }` (default `staleMs` 30000), `invalidate(prefix: string): void`, `clearQueryCache(): void`, `prefetchQuery(key: string, fetcher: () => Promise<unknown>): Promise<void>`. Key convention: `'<area>:<detail>'`, e.g. `links:list:<cursor>`, `orgs:catalog`, `events:list:<orgId>`.

- [x] **Step 1: Failing tests:** `returns cached data immediately and refreshes when stale` (fake timers); `dedupes in-flight requests`; `invalidate('links:') refetches links keys only`; `clearQueryCache empties everything`; dashboard test: second mount shows data without a loading state.
- [x] **Step 2: Run** `npx vitest run src/lib/queryCache.test.ts` → FAIL.
- [x] **Step 3: Implement** and migrate the listed views; mutations in `useLinks` call `invalidate('links:')`.
- [x] **Step 4: Run** `npm test` → PASS.
- [x] **Step 5: Commit** `perf(api): cache reads with stale-while-revalidate`.

### Task 11: Prefetch directive

**Files:**
- Create: `src/directives/prefetch.ts`, `src/directives/prefetch.test.ts`
- Modify: `src/main.ts` (register), `src/components/layout/appNav.ts` consumers / `AppShell.vue` nav links, `src/router/index.ts` (`meta.prefetch` for dashboard, links, orgs)

**Interfaces:**
- Consumes: `prefetchQuery`.
- Produces: `v-prefetch="routeLocation"`; `RouteMeta.prefetch?: () => Promise<void>`.

- [x] **Step 1: Failing tests:** `pointerenter loads the route component once`; `visible for 1 s triggers on idle` (mock IntersectionObserver + requestIdleCallback); `saveData skips`.
- [x] **Step 2: Run** `npx vitest run src/directives` → FAIL.
- [x] **Step 3: Implement** using `router.resolve(to).matched` and calling each lazy `components.default` loader.
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `perf(nav): prefetch routes and data before the click`.

### Task 12: Image variant maker (browser)

**Files:**
- Create: `src/lib/images/variants.ts`, `src/lib/images/variants.test.ts`, `src/lib/images/profiles.ts`

**Interfaces:**
- Produces: `IMAGE_PROFILES = { orgLogo: [96, 192, 384], banner: [640, 1280, 1920], frame: [256, 512, 1024], qrLogo: [512] } as const`; `planWidths(sourceWidth: number, profile: readonly number[]): number[]` (widths strictly below source; if none, `[]`); `makeVariants(file: Blob, profile: keyof typeof IMAGE_PROFILES, deps?: { encode?: Encoder }): Promise<{ meta: ImageMeta; variants: { width: number; dataUrl: string }[] }>`; type `ImageMeta = { w: number; h: number; fmt: 'webp'|'jpeg'|'png'; widths: number[]; ph: string }`; `WEBP_QUALITY = 0.86`.

- [x] **Step 1: Failing tests:** `planWidths(1000, [256,512,1024]) → [256, 512]`; `encodes webp at 0.86`; `falls back when webp is not encoded` (fake encoder returns `image/png` for webp request → opaque source re-encoded as `image/jpeg`, alpha source stays `image/png`, `meta.fmt` matches); placeholder data URL ≤ 1200 chars and 16 px wide.
- [x] **Step 2: Run** `npx vitest run src/lib/images` → FAIL.
- [x] **Step 3: Implement** with `createImageBitmap(file, { imageOrientation: 'from-image' })`, `OffscreenCanvas` when present else `document.createElement('canvas')`, `imageSmoothingQuality = 'high'`. Alpha detection: sample `getImageData` alpha channel on the 16 px placeholder canvas.
- [x] **Step 4: Run** → PASS.
- [x] **Step 5: Commit** `feat(media): make right-sized image variants in the browser`.

### Task 13: Variants API and meta in payloads

**Files:**
- Create: `backend/src/routes/mediaVariants.ts`, `backend/src/routes/mediaVariants.test.ts`
- Modify: `backend/src/lib/media.ts` (add `putVariant`, `variantKey`, `deleteWithVariants`), `backend/src/index.ts`, `backend/src/routes/orgs.ts` and `backend/src/routes/dp.ts` (return `logoMeta`, `bannerMeta`, `imageMeta` parsed JSON in every payload that returns those images; on image replace/delete call `deleteWithVariants`)

**Interfaces:**
- Produces: `PUT /api/media/variants` body `{ key: string; placeholder: string; meta: { w, h, fmt, widths }; variants: { width: number; dataUrl: string }[] }` → `{ meta: ImageMeta }`. `variantKey(originalKey: string, width: number, fmt: ImageFormat): string` → `'{originalKeyWithoutExt}-{width}.{webp|jpg|png}'`. Writes meta to the column that holds `key` (`organizations.logo_url|banner_url` → `logo_meta|banner_meta`; `dp_frames.image_url` → `image_meta`).

- [ ] **Step 1: Failing tests:** authz matrix (anonymous 401; member of the key's org 200; `rejects other org` 403; admin 200 for any key); `rejects a width not in the profile` 422; `rejects a variant wider than the original` 422; `rejects a non-image data URL` 422; `rejects a variant over 2 MB` 422; `key that matches no row` 404; org GET returns `logoMeta`; replacing a logo deletes old variants from R2.
- [ ] **Step 2: Run** `npx vitest run backend/src/routes/mediaVariants.test.ts backend/src/routes/orgs*.test.ts backend/src/routes/dp.test.ts` → FAIL.
- [ ] **Step 3: Implement**, reusing `sniff` from `media.ts` for magic bytes and dimensions.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(media): store image variants and return their metadata`.

### Task 14: `<AppImage>` and upload wiring

**Files:**
- Create: `src/components/AppImage.vue`, `src/components/AppImage.test.ts`
- Modify: `src/components/OrgLogo.vue`, `src/views/orgs/OrgCatalogView.vue`, `src/views/orgs/OrgProfileView.vue`, `src/views/orgs/OrgModifyView.vue`, `src/components/dp/DpFrameUploader.vue`, `src/views/dp/DpPublicView.vue`, `src/components/brand/BrandLogo.vue`, `public/eypi-mark.webp` (new, from `eypi-mark.png`)

**Interfaces:**
- Consumes: `ImageMeta`, `makeVariants`, `PUT /api/media/variants`, `variantKey` naming (mirror it client-side in `src/lib/images/variantUrl.ts`: `variantUrl(src: string, width: number, fmt: ImageMeta['fmt']): string`).
- Produces: `<AppImage :src :meta :alt :sizes :priority />`.

- [ ] **Step 1: Failing tests:** with meta → `srcset` lists every width with `w` descriptors, `width`/`height` attrs set, `loading="lazy"` and `decoding="async"`; `priority` → no `loading`, `fetchpriority="high"`; no meta → plain `src`, still lazy; placeholder background present until `load`. Upload test in `OrgModifyView.test.ts`: after save, `PUT /api/media/variants` is called with `orgLogo` widths.
- [ ] **Step 2: Run** `npx vitest run src/components/AppImage.test.ts src/views/orgs` → FAIL.
- [ ] **Step 3: Implement**; replace each listed `<img>`. Frames: the picker uses `AppImage`; the canvas merge keeps loading the original `url`. QR logos (`src/components/links/QrDesigner.vue`): resize to the `qrLogo` profile (512) with `makeVariants` before saving and save that single image as the logo (no variants call); add a test in `LinkEditorPanel.imageSave.test.ts` that a 2000 px logo is saved at 512 px.
- [ ] **Step 4: Run** `npm test` → PASS.
- [ ] **Step 5: Commit** `perf(media): serve right-sized images with srcset and placeholders`.

### Task 15: Edge media cache

**Files:**
- Modify: `worker/index.ts` (`servePublicMedia`), `worker/index.test.ts`

- [ ] **Step 1: Failing tests:** `second request is served from cache without R2` (fake `caches.default`, R2 `get` called once); `responds 304 to a matching If-None-Match` using the object's `httpEtag`; HEAD still has no body.
- [ ] **Step 2: Run** `npx vitest run worker/index.test.ts` → FAIL.
- [ ] **Step 3: Implement**: `cache.match(request)` → hit returns; miss reads R2, sets `ETag`, `ctx.waitUntil(cache.put(request, response.clone()))`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `perf(media): cache r2 media at the edge with etags`.

### Task 16: Optimize images backfill

**Files:**
- Modify: `backend/src/routes/admin.ts` (+ test) — `GET /api/admin/media/pending` → `{ items: { key: string; profile: 'orgLogo'|'banner'|'frame' }[] }` (rows with a stored R2 key and null meta)
- Create: `src/views/admin/AdminMaintenanceView.vue`, `AdminMaintenanceView.test.ts`; route `/admin/maintenance` (name `admin-maintenance`) and nav entry

**Interfaces:**
- Consumes: `makeVariants`, `PUT /api/media/variants`.

- [ ] **Step 1: Failing tests:** pending list excludes rows with meta and external `https://` URLs; admin-only; view processes items one at a time, shows `n of m`, continues after a failure and lists failed keys; writes an audit event per item (`media.variants`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; fetch originals from `/media/{key}`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(admin): add a one-click image optimizer for existing media`.

### Task 17: Placement, public GET caching, Tix query fix

**Files:**
- Modify: `backend/wrangler.jsonc` (`"placement": { "mode": "smart" }`, or `{ "region": "aws:<region>" }` if the owner sent the Turso region from owner guide step 1.2)
- Create: `backend/src/lib/edgeCache.ts`, `edgeCache.test.ts`
- Modify: public GET handlers for org profile, org catalog, `GET /api/dp/:slug`, `/api/stats`; `backend/src/routes/events.ts` attendees query

**Interfaces:**
- Produces: `withEdgeCache(c: Context, ttlSec: number, handler: () => Promise<Response>): Promise<Response>` — keyed by URL, skips when the request has a session cookie, sets `Cache-Control: public, max-age=30, stale-while-revalidate=300`.

- [ ] **Step 1: Failing tests:** cached handler runs once for two anonymous requests; a request with a session cookie bypasses the cache; header value exact; attendees query test asserts `EXPLAIN QUERY PLAN` for the check_ins subquery uses an index with `event_id` (seed two events, assert results unchanged).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**; in the attendees query, add `WHERE event_id = ?` inside the `ROW_NUMBER()` subquery.
- [ ] **Step 4: Run** `npm test` → PASS; `npx wrangler deploy --dry-run` in `backend/` accepts `placement`.
- [ ] **Step 5: Commit** `perf(api): place the api near turso and cache public reads`.

### Task 18: Service worker

**Files:**
- Create: `public/sw.js`, `public/sw-kill.js`, `src/lib/registerSw.ts`, `src/lib/registerSw.test.ts`, `scripts/sw-precache.mjs`, `scripts/sw-precache.test.mjs`, `worker/sw.test.ts` (logic tests import strategy functions from a shared module `public/sw-strategies.js` that `sw.js` imports via `importScripts`)
- Modify: `package.json` `build` script (`vue-tsc -b && vite build && node scripts/sw-precache.mjs`), `src/main.ts`, `public/_headers` (`/sw.js` → `Cache-Control: no-cache`)

**Interfaces:**
- Produces: cache names `eypi-shell-<buildHash>`, `eypi-media-v1`, `eypi-tickets-v1`; `pickStrategy(url: URL, request: Request): 'shell-network-first' | 'asset-cache-first' | 'media-cache-first' | 'tickets-network-first' | 'bypass'`.

- [ ] **Step 1: Failing tests:** `pickStrategy` table (`/assets/x.js` cache-first; navigation `html is network first`; `/media/...` media; `https://api.eypi.cc/api/tickets` tickets; any other API bypass); media LRU evicts beyond 150; `sw-precache` writes the entry chunks from `dist/client/.vite/manifest.json` into `dist/client/sw.js`; `registerSw` registers only when `import.meta.env.PROD`; `sw-kill.js` unregisters and deletes all `eypi-*` caches.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement.** HTML network-first with a 3000 ms timeout then cached `/index.html`. Old `eypi-shell-*` caches deleted on `activate`.
- [ ] **Step 4: Run** `npm test && npm run build` → PASS; `dist/client/sw.js` contains the precache list.
- [ ] **Step 5: Commit** `feat(pwa): cache the app shell and media with a service worker`.

### Task 19: Docs and phase verification

**Files:**
- Modify: `CONTEXT.md` (RUM, rollup cron, image variants, query cache, service worker, public/app shells), `DESIGN_SYSTEM.md` (AppImage and chart components), `docs/operations.md` (hourly cron, service worker kill switch → points to owner guide), tick this plan's boxes

- [ ] **Step 1:** Update the docs.
- [ ] **Step 2:** Run `npm run lint && npm run typecheck && npm test && npm run build` → all green; record entry/CSS gz sizes.
- [ ] **Step 3: Commit** `docs: describe phase 1 speed architecture`. Then tell the owner Phase 1 is ready, with migration `0010_perf_media` (owner guide Part 2 and Part 3 Phase 1).
