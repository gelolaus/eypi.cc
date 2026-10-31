# eypi.cc — Domain context

Product and architecture vocabulary for agents and humans. UI/visual rules live in `DESIGN_SYSTEM.md` — do not duplicate them here.

---

## Product

**eypi.cc** is a URL shortener and org-tool suite for the **Asia Pacific College (APC)** student community.

| Audience | What they use |
|---|---|
| Signed-in APC users | **Links** (personal short links), **Wallpaper** (schedule to phone wallpaper), account page, org invites |
| Activated org members | **Forms**, **Frames**, **Tix**, org profile and members |
| Platform admins (`users.role = 'admin'`) | Create and edit orgs; admin panel (users, links, reports, audit log) |

Sign-in is Microsoft (Entra) for APC accounts only (`@apc.edu.ph`, `@student.apc.edu.ph`). Not a public SaaS.

**Suite modules (product names):** Links · Forms · Wallpaper · Frames · Tix · Orgs

---

## Domain glossary

Use these terms. Prefer them over invented synonyms.

| Term | Meaning |
|---|---|
| **link** / **short link** | User-owned mapping `eypi.cc/{slug}` → destination URL. Stored in `links`. Personal — **not** org-scoped. |
| **slug** | First path segment. Formats differ by context: link (random), event (`[a-z0-9]+`), DP campaign (`[a-z0-9-]+`). Org slug = `organizations.id`. |
| **reserved slug** | First-segment path blocked from link slugs so suite routes win. Source: `shared/reservedSlugs.ts`. |
| **redirect** | HTTP 302 (edge via `LINKS_KV`) or SPA fallback (`RedirectView` → API) from slug → destination. |
| **analytics** | Per-click rows for a link (`analytics` table, see **click row**) plus denormalized `links.clicks` and daily rollups (see **rollup**). |
| **link report** | Public abuse report on a link (`link_reports`), triaged in the admin panel. |
| **organization** / **org** | Student-org tenant. Primary key / public handle is the **org slug** (`organizations.id`). |
| **membership** | `org_members` row linking email → org. |
| **activated membership** | Membership with `activated_at` set (invite accepted in the app, `/invites`). Required for org-gated features. |
| **owner** | `organizations.owner_id` — the org's named owner. Changed only by a platform admin. Not a higher permission tier. |
| **flat org model** | Every activated member has the same org permissions (edit profile, manage members, events, frames). There is no coordinator role. |
| **admin** | `users.role = 'admin'`. Seeded by migration `0003`. Gates `/api/admin/*` and org creation. |
| **avatar** | A user's chosen icon and colour (`users.avatar_icon`, `users.avatar_color`), set in the account menu via `PATCH /api/account/avatar`. Icons and colours are fixed presets from `shared/avatars.ts`; both are set or both are null, and null shows initials. Rendered by `UserAvatar`, chosen in `AvatarPicker`. |
| **active org** | Org context for a multi-org user. Client: `localStorage.active_org_id`. API: `X-Active-Org-Id` (invalid value → 403, no silent fallback). |
| **session** | Opaque server-side session in Turso (`sessions`). The cookie holds a random token; the table holds its sha256. |
| **consent** | Versioned acceptance of privacy and terms (`/consent`). The API is gated until current versions are accepted. |
| **event** | Org-scoped ticketed event (`events`). Lifecycle `events.status`: `draft` → `published` → `closed` or `cancelled` (a closed event can be published again). |
| **registration** | An attendee row created by a signed-in user through `POST /api/events/:slug/register` (`source = 'self'`, `user_id` set). Cancelled with `DELETE /api/events/:slug/registration`. |
| **admission mode** | `events.admission_mode`, how registrations become tickets: `fcfs` (first come first served, confirmed until capacity, then waitlist if enabled), `lottery` (entered until `draw`), `approval` (pending until an organiser decides), `import` (CSV/XLSX selection and finalize; the original flow). |
| **attendee** | Person with a ticket; has `qr_token`. One pool for every mode, with a `status`. |
| **attendee status** | `pending` (awaiting approval), `entered` (in the lottery), `waitlisted`, `confirmed` (holds a ticket and can check in), `declined`, `cancelled`. Removing an attendee sets `cancelled`; restoring sets it back. |
| **ticket** | Attendee-facing QR + event info. Shown on `/tickets` (signed-in) or `/t/:token` (guest). |
| **guest link** | Private ticket URL `/t/:token` for an attendee with no account. Only the token hash is stored (`guest_token_hash`), so a link is issued (or rotated, which kills the old one) by an organiser through `POST /api/events/:slug/attendees/:id/guest-link` and resolved by `GET /api/tickets/guest/:token` (`private, no-store`). It replaced searching for a ticket by name. |
| **door mode** | Full-screen check-in at `/manage/tix/:slug/door`. Loads the confirmed roster onto the device, scans against it locally, and syncs. |
| **offline queue** | Check-ins made in door mode are stored in IndexedDB on the device and sent to `POST /api/events/:slug/checkins/sync` every few seconds while online; the server reports conflicts such as another device checking the guest in first. |
| **pass token** | Short-lived JWT (`typ: 'pass'`) signed with `PASS_TOKEN_SECRET` for the Google Wallet endpoint. Never a session. |
| **pass** / **wallet pass** | Google Wallet save URL. (Apple Wallet was removed.) |
| **check-in** | Scan/log entry for an attendee (`check_ins`). |
| **selection mode** | Event not yet finalized (`selection_locked = 0`): CSV/XLSX upload → column map → clusters → row select. |
| **finalize** | Lock selection; create attendees from selected CSV rows in one guarded batch. |
| **cluster** | Quota/filter group used during selection/raffle. |
| **DP campaign** / **campaign** | Profile-frame campaign (API/DB: `dp_*`). |
| **Frames** | Product UI name for DP campaigns (`/manage/frames`, `/frames/:slug`). Prefer **Frames** in UI talk; **DP** in API/DB talk. |
| **frame** | PNG overlay image (`dp_frames`). Max 10 per campaign. Stored in R2. |
| **caption field** | A `{{Label}}` placeholder in a campaign caption (`caption_template`, parsed by `shared/captionFields.ts`). After a visitor downloads, a form asks for each field and fills the caption. Answers stay in the browser and are never stored. Fields are required unless written `{{Label?}}`: a required blank blocks copying and reopens the form, an optional blank is dropped from the caption. Max 10 distinct fields. |
| **media** | Org logos and banners, QR logos and frames, in the R2 bucket `eypi-media` (binding `MEDIA`). |
| **RUM** | Real-user monitoring. The SPA sends Web Vitals batches to `POST /api/rum` (`rum_samples`); hourly rollups write p75 per day, route, metric and device to `rum_daily`. Read in Admin → Speed. |
| **click row** | One `analytics` row per counted link click: country, OS, `device` (mobile/tablet/desktop), `browser` family, `app`, referrer host, `source` (qr/direct) and a `visitor_hash`. Parsed from the user agent at click time; the UA string is never stored (`shared/linkAnalytics.ts`). Raw rows are deleted once older than 400 days and their Manila day has a rollup. |
| **source app** | In-app browser a click came from (`analytics.app`): messenger, facebook, instagram, tiktok, x, line, discord, or NULL. |
| **Manila day** | Calendar day in Asia/Manila (UTC+8), `YYYY-MM-DD`. Every analytics and module day, bucket and rollup uses it (`backend/src/lib/manilaTime.ts`). RUM keeps UTC days. Link-click visitor hashes rotate on the UTC day (worker), while beacon (module event) hashes rotate on the Manila day. |
| **per-day unique** | Count of distinct `visitor_hash` in one Manila day. The hash is rotated daily, so uniques are never summed or compared across days. |
| **rollup** | Hourly cron (`backend/src/jobs/rollups.ts`) that rebuilds yesterday's and today's rows: `analytics_daily` (clicks, uniques, qr per link and day), `analytics_daily_dim` (clicks per dimension value, including the `how` hour-of-week bucket 0–167, Monday 00:00 Manila = 0), `module_daily` and `rum_daily`. Retention deletes raw rows only after a rollup exists. |
| **module event** | One public beacon row in `module_events` (`POST /api/beacon`, no session): module `frames` (view, photo_added, download, share) or `org` (view), the subject id, a daily `visitor_hash`, and the Manila day. Rate-limited to 20 per visitor, subject and action per hour. Rolled up into `module_daily`. |
| **image variants** | Resized copies of an uploaded image in R2, written by the browser (`PUT /api/media/variants`) and listed in the stored image metadata (`ImageMeta`). `AppImage` builds the `srcset`. Admin → Maintenance backfills existing media. |
| **query cache** | In-memory cache of GET responses in `src/lib/queryCache.ts`. Writes through `src/lib/api.ts` invalidate it centrally, but only under the `/api/links`, `/api/events`, `/api/dp` and `/api/orgs` prefixes (the media variants PUT is not covered); logout and org switch clear it. |
| **public shell / app shell** | `PublicShell` renders public pages with no app chrome. `AppShell` (side rail, tab bar) is a lazy chunk loaded only for signed-in routes. |
| **service worker** | `public/sw.js` caches the app shell, media and the ticket list for offline use. Kill switch: `public/sw-kill.js` (see `docs/operations.md`). |
| **form** | Client-side document generator catalog item (DOCX fill). Not an HTML form builder. Templates are private objects in R2. |
| **schedule wallpaper** | The `/wallpaper` page: a signed-in APC student pastes their RAMS class schedule and downloads a PNG sized for their phone, laptop or desktop screen (layouts grid, agenda or cards; four themes; optional own photo). Parsed by `shared/schedule/`, drawn by `src/lib/wallpaper/`, all in the browser. |
| **safe zone** | The top 30% of a portrait wallpaper (`SAFE_ZONE_RATIO` in `src/lib/wallpaper/safeZone.ts`), kept empty for the lock screen clock and widgets; a landscape wallpaper only keeps 8% (`LANDSCAPE_TOP_RATIO`). A test holds every layout to it. |

---

## Module map

| Module | Path | Owns |
|---|---|---|
| **Frontend SPA** | `src/` | UI, routing, shared API client (`src/lib/api.ts`), client form generation, DP canvas, QR display, wallpaper canvas renderers (`src/lib/wallpaper/`), descriptive dashboard panels (`src/components/dashboard/`: `PeriodPicker`, `PanelState`, `LinkKpis`, `ClicksTrend`, `TopLinks`, `AudiencePanels`, `BestHours`, `UpcomingTickets`, `AcrossApc`, `OrgInsightsSection`, `FeatureCards`) |
| **Frontend Worker** | `worker/index.ts` | Serves SPA assets at `eypi.cc`; **edge short-link redirects** via `LINKS_KV`; async click logging; per-route meta tags; media route |
| **Backend API** | `backend/` | All `/api/*` on `api.eypi.cc` (Hono Worker): sign-in, sessions, links, orgs, events, DP, forms, admin, account, legal, stats, cron retention |
| **Migrations** | `backend/migrations/` | Versioned SQL, applied with `backend/scripts/migrate.mjs` (ledger `schema_migrations`) |
| **Shared contracts** | `shared/` | `LINKS_KV` encode/decode, click analytics helpers, reserved slug list, RAMS schedule parser and layout helpers (`shared/schedule/`) |
| **Legacy redirects** | `redirects/` | Only `tix.eypi.cc` / `forms.eypi.cc` → unified `eypi.cc` — **not** general short links |
| **Design system** | `DESIGN_SYSTEM.md` | Visual/UI language (wantap layout and components in the APC palette with Light, Dark and True black themes, APC blue and gold, Plus Jakarta Sans, Syne, JetBrains Mono) |
| **Plans / specs** | `docs/superpowers/` | Agent plans and design specs |
| **Runbooks** | `docs/RELEASE.md`, `docs/operations.md` | Deploys, cutover, restore, rotation, incidents, accepted risks |

Removed in the wantap port: the glass-card (mica) surfaces and the Geist fonts. The app has three themes, Light, Dark and True black (System by default), applied through tokens only; the APC blue and gold brand colors are in all of them (`DESIGN_SYSTEM.md`, `docs/superpowers/specs/2026-10-29-dark-mode-design.md`). Do not reintroduce `dark:` utilities, mica or Geist.

### Backend route ownership

| Area | Primary files |
|---|---|
| Microsoft sign-in | `backend/src/routes/authMicrosoft.ts`, `backend/src/lib/auth/` |
| Current user, logout | `backend/src/routes/me.ts` |
| Account (export, sessions, delete) | `backend/src/routes/account.ts` |
| Legal consent | `backend/src/routes/legal.ts`, `middleware/requireConsent.ts` |
| Links + link analytics (`GET /api/links/summary` and `GET /api/links/summary/trends` for the dashboard) | `backend/src/routes/links.ts` |
| Link reports (public) | `backend/src/routes/reports.ts` |
| Orgs, members, invites, public catalog (`GET /api/orgs/:org_id/insights` for the dashboard org strip) | `backend/src/routes/orgs.ts` |
| Org feature gate / org context | `backend/src/middleware/orgGuard.ts` (`isOrgFeature`), `orgContext.ts` |
| Events / Tix | `backend/src/routes/events/*` (split by area: `index.ts` mounts them). `manage.ts` events CRUD, publish/close/cancel, cover, clusters, finalize, add-guest; `import.ts` CSV upload and column mapping; `public.ts` `GET /api/events/:slug`, `GET /api/events/:slug/public` and the Google Wallet pass; `registrations.ts` `POST /api/events/:slug/register`, `DELETE /api/events/:slug/registration`, `GET /api/tickets`, `GET /api/tickets/upcoming` (read-only dashboard preview), `POST /api/tickets/:id/pass`; `inbox.ts` `GET /attendees` and `POST /attendees/bulk`; `lottery.ts` `POST /draw`; `guests.ts` `guest-link`, `attendees.csv` (needs `X-Active-Org-Id`) and `GET /api/tickets/guest/:token`; `door.ts` check-in, remove/restore, `roster`, `live`, `checkins/sync` |
| Frames / DP | `backend/src/routes/dp.ts` |
| Forms catalog + templates | `backend/src/routes/forms.ts` |
| Admin panel API, audit log | `backend/src/routes/admin.ts`, `lib/audit.ts` |
| Media migration (admin) | `backend/src/routes/adminMigrations.ts` |
| Platform stats (public totals: users, orgs, members, links, clicks, events, tickets, check-ins, frames, frame downloads) | `backend/src/routes/stats.ts` |
| Google Wallet pass | `backend/src/lib/passes/` |
| Retention cron | `backend/src/jobs/retention.ts` |
| RUM ingest, hourly rollups | `backend/src/routes/rum.ts`, `backend/src/jobs/rollups.ts` |
| Image variants | `backend/src/routes/mediaVariants.ts` |
| Edge cache for public GETs | `backend/src/lib/edgeCache.ts` (`withEdgeCache`) |

### Frontend route ownership

| Area | Routes |
|---|---|
| Sign-in, consent | `/login`, `/consent` |
| Dashboard | `/dashboard` |
| Links | `/links` |
| Forms | `/forms` (org-gated) |
| Wallpaper | `/wallpaper` |
| Frames admin | `/manage/frames` |
| Frames public | `/frames/:slug` |
| Tix admin | `/manage/tix`, `/manage/tix/new`, `/manage/tix/:id/edit` (builder), `/manage/tix/:id/select`, `/manage/tix/:id` (event detail), `/manage/tix/:slug/door` (door mode) |
| Tix public event page | `/tix/:slug` |
| My tickets (signed in) | `/tickets` |
| Guest ticket (private link) | `/t/:token` |
| Orgs | `/orgs`, `/orgs/:slug` |
| My org | `/orgs/modify` |
| Invites | `/invites` |
| Account | `/account` |
| Admin panel | `/admin`, `/admin/users`, `/admin/links`, `/admin/reports`, `/admin/audit`, `/admin/orgs`, `/admin/speed`, `/admin/maintenance` |
| Legal and reports | `/privacy`, `/terms`, `/acceptable-use`, `/report` |
| Short-link catch-all | `/:slug` (must stay late in router) |

The signed-in rail has two groups, Rams and Orgs. Rams: Dashboard (`/dashboard`), Links, My tickets, Wallpaper, Invites, Orgs (`/orgs`). Orgs, members only: Tix, Frames, Forms, My org (`/orgs/modify`), hidden when `useActiveOrg().hasOrg` is false. Phone tabs, exactly five: Dashboard, Links, My tickets, Wallpaper, Invites.

---

## Tenancy model

| Feature | Scope |
|---|---|
| Links | **User** (`user_id`) |
| Events, DP/Frames, Forms | **Org** (via activated membership + `X-Active-Org-Id`) |
| Admin panel | **Platform** (`users.role = 'admin'`) |
| Public Frames / Tix event page / guest ticket / org catalog / link redirect | **Unauthenticated** where noted |

Org gate: backend `isOrgFeature` + frontend `requiresOrg` / `useOrgMembership`.

---

## Important seams

| Seam | How it works | Watch out |
|---|---|---|
| SPA ↔ API | `src/lib/api.ts`: `credentials: 'include'`, optional `X-Active-Org-Id`, typed errors `{ error: { code, message } }`, 401 resets the session | Default API is `https://api.eypi.cc`; local uses `http://localhost:8787` via `dev:local` |
| Auth | Microsoft Entra authorization code + PKCE, tenant pinned, then an opaque cookie session (`__Host-eypi_session` in production, `eypi_session` locally). Short-lived `eypi_oauth` cookie during sign-in only | No passwords, no JWT sessions, no tokens in `localStorage`. Unsafe methods need an allowlisted `Origin` (CSRF middleware) |
| Pass tokens | HS256 JWT (`typ: 'pass'`) signed with `PASS_TOKEN_SECRET` | Not accepted as a session |
| Edge redirect ↔ DB | `LINKS_KV` write-through on link CRUD; Turso is source of truth | KV drift is repaired with `backfill-kv` (`docs/operations.md`) |
| Edge miss ↔ SPA | Reserved slug or KV miss → SPA `/:slug` → `GET /api/links/:slug` | Two analytics paths (worker `Referer` vs SPA `X-Client-Referrer`) |
| Forms | Backend serves template bytes from R2 (`templates/`); **generation is client-only** | No server-side document storage |
| Wallpaper | RAMS text is parsed in the browser only; the pasted text and the photo are never sent, stored or logged. If saved schedules are added later, store the parsed `ParsedSchedule` and not the raw paste (it holds the student name and number) | No backend, schema or migration in v1 |
| Media | Images in R2 `eypi-media`, served through a cached same-origin route | Old data URLs migrated by the admin media endpoint |
| Public shell ↔ app shell | Public routes render in `PublicShell`; signed-in routes lazy-load `AppShell` (`loadAppShell.ts`). Keep app-only code out of the entry chunk | Gzip budgets (entry JS ≤ 70,000 B, CSS ≤ 22,000 B, decimal kB) fail `npm run release:check` |
| Query cache ↔ writes | Every non-GET through `src/lib/api.ts` under `/api/links`, `/api/events`, `/api/dp` or `/api/orgs` invalidates the matching cached GETs (other paths, such as the media variants PUT, do not); `v-prefetch` warms a route's data on hover | A new write path that bypasses `api.ts` leaves stale reads |
| Media delivery | Worker caches `/media/*` at the edge for 24 h; browsers get `immutable`. Images use variants through `AppImage` | Never reuse a media key for new content |
| Public API reads | `withEdgeCache` caches public GETs for 30 s; the API Worker uses smart placement near Turso | CORS headers stay out of the cached copy |
| Service worker | Network-first HTML, cached assets and media, ticket list kept for offline. `SPA_SEGMENTS` in `public/sw-strategies.js` must match `src/router/index.ts` (tested in `worker/sw.test.ts`) | Cache names are versioned (`eypi-shell-<hash>`, `eypi-media-v1`, `eypi-tickets-v1`) |
| Rate limits | `RATE_LIMIT_KV`, keyed by hashed IP (`IP_HASH_SECRET`) | Coarse; KV is not atomic |
| Audit log | Admin and org actions write `audit_events` | Times shown in Manila time |

Good deepening targets (seams that already exist): link resolve (KV vs API), org scoping header, org feature gate, session and admin middleware, reserved-slug contract in `shared/`.

---

## Key workflows (short)

1. **Link** — create → Turso + KV → edge 302 (or SPA fallback) → analytics.
2. **Auth** — "Sign in with Microsoft" → callback checks tenant and APC email domain → upsert user → session cookie → consent gate → onboarding attaches pre-provisioned memberships (does not auto-activate).
3. **Org** — admin creates org → owner invites email (Resend) → invitee accepts in `/invites` → activated membership → active org context.
4. **Tix** — create event as `draft` (builder: mode, capacity, questions, dates) → publish → people register at `/tix/:slug` (or an organiser imports a CSV and finalizes, or adds guests) → status per admission mode (fcfs, lottery draw, approval inbox) → ticket on `/tickets` or a private `/t/:token` guest link, with QR and Google Wallet pass → check-in in door mode (offline-capable) → close or cancel.
5. **Frames** — create campaign + frames (R2) → public `/frames/:slug` → canvas merge → download count.
6. **Forms** — org-gated catalog → fetch template from R2 → client DOCX fill → download.
   **Wallpaper** — paste the RAMS page → browser parses it → pick layout, theme, photo and size → canvas draw → download or share the PNG.
7. **Abuse** — public report → admin reports view → disable link / resolve.

---

## Deploy & local reality

| Piece | Production | Local |
|---|---|---|
| Frontend | Worker @ `eypi.cc` | Vite `:5173` |
| API | Worker @ `api.eypi.cc` | Wrangler `:8787` |
| DB | Turso (libSQL) | **Same production Turso** (intentional) |
| Combined | — | `npm run dev:local` |

Do **not** insist on a separate dev database unless asked. Never propose destructive DB ops without explicit approval. Never commit or log secrets (`.dev.vars`, `.env.local`, Turso, Entra, Resend, wallet keys).

Schema changes are versioned SQL in `backend/migrations/`, applied with `npm run migrate --prefix backend` (see `docs/operations.md`). `docs/db/schema-baseline.md` is the pre-migration baseline.

---

## Constraints & non-goals

- APC accounts only; org creation is admin-only.
- Removed on purpose: passwords and email verification, Apple Wallet passes, the `xlsx` package (attendee spreadsheets use `exceljs` and `papaparse`), the custom cursor, JWT sessions in `localStorage`.
- Suite merge is done: legacy `tix.eypi.cc` / `forms.eypi.cc` are redirect-only.
- Prefer deepening existing modules over rewrites.
- Prefer **Frames** (UI) / **DP** (API) consistency over renaming the whole domain in one pass.
- Stale docs may say `/dp/:slug` — live public route is `/frames/:slug`.

---

## Related docs

| Doc | Role |
|---|---|
| `DESIGN_SYSTEM.md` | Visual system, UI copy, a11y, z-index |
| `docs/RELEASE.md` | Deploys and the Microsoft cutover |
| `docs/operations.md` | Restore, migrations, rotation, cron jobs, service worker, incidents, accepted risks |
| `docs/superpowers/specs/` | Feature design specs |
| `docs/superpowers/plans/` | Implementation plans (preferred output for planning skills) |
| `.cursor/rules/local-dev.mdc` | Local prod-DB workflow + safety rules |

## UI conventions

- The product is called **Eypi** in the UI; `eypi.cc` is the domain and appears only in URLs and legal text.
- **Platform totals** (`GET /api/stats`, public aggregates) show on the landing page and in Admin → Overview. The member dashboard shows them in a small Across APC strip.
- The side rail collapses to icons; the org switcher shows the capitalised org slug only.
- The signed-in rail has two groups, Rams and Orgs. Rams: Dashboard, Links, My tickets, Wallpaper, Invites, Orgs (`/orgs`). Orgs, members only: Tix, Frames, Forms, My org (`/orgs/modify`), hidden when `useActiveOrg().hasOrg` is false. Phone tabs, exactly five: Dashboard, Links, My tickets, Wallpaper, Invites. On phones the profile menu is a bottom sheet, and from `sm` up it stays the dropdown. The command palette and the site sheet use the same membership gate.
