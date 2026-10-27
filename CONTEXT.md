# eypi.cc — Domain context

Product and architecture vocabulary for agents and humans. UI/visual rules live in `DESIGN_SYSTEM.md` — do not duplicate them here.

---

## Product

**eypi.cc** is a URL shortener and org-tool suite for the **Asia Pacific College (APC)** student community.

| Audience | What they use |
|---|---|
| Signed-in APC users | **Links** (personal short links), account page, org invites |
| Activated org members | **Forms**, **Frames**, **Tix**, org profile and members |
| Platform admins (`users.role = 'admin'`) | Create and edit orgs; admin panel (users, links, reports, audit log) |

Sign-in is Microsoft (Entra) for APC accounts only (`@apc.edu.ph`, `@student.apc.edu.ph`). Not a public SaaS.

**Suite modules (product names):** Links · Forms · Frames · Tix · Orgs

---

## Domain glossary

Use these terms. Prefer them over invented synonyms.

| Term | Meaning |
|---|---|
| **link** / **short link** | User-owned mapping `eypi.cc/{slug}` → destination URL. Stored in `links`. Personal — **not** org-scoped. |
| **slug** | First path segment. Formats differ by context: link (random), event (`[a-z0-9]+`), DP campaign (`[a-z0-9-]+`). Org slug = `organizations.id`. |
| **reserved slug** | First-segment path blocked from link slugs so suite routes win. Source: `shared/reservedSlugs.ts`. |
| **redirect** | HTTP 302 (edge via `LINKS_KV`) or SPA fallback (`RedirectView` → API) from slug → destination. |
| **analytics** | Per-click rows for a link (`analytics` table) plus denormalized `links.clicks`. |
| **link report** | Public abuse report on a link (`link_reports`), triaged in the admin panel. |
| **organization** / **org** | Student-org tenant. Primary key / public handle is the **org slug** (`organizations.id`). |
| **membership** | `org_members` row linking email → org. |
| **activated membership** | Membership with `activated_at` set (invite accepted in the app, `/invites`). Required for org-gated features. |
| **owner** | `organizations.owner_id` — the org's named owner. Changed only by a platform admin. Not a higher permission tier. |
| **flat org model** | Every activated member has the same org permissions (edit profile, manage members, events, frames). There is no coordinator role. |
| **admin** | `users.role = 'admin'`. Seeded by migration `0003`. Gates `/api/admin/*` and org creation. |
| **active org** | Org context for a multi-org user. Client: `localStorage.active_org_id`. API: `X-Active-Org-Id` (invalid value → 403, no silent fallback). |
| **session** | Opaque server-side session in Turso (`sessions`). The cookie holds a random token; the table holds its sha256. |
| **consent** | Versioned acceptance of privacy and terms (`/consent`). The API is gated until current versions are accepted. |
| **event** | Org-scoped ticketed event (`events`). |
| **attendee** | Person with a ticket; has `qr_token`. |
| **ticket** | Attendee-facing QR + event info. |
| **pass token** | Short-lived JWT (`typ: 'pass'`) signed with `PASS_TOKEN_SECRET` for the Google Wallet endpoint. Never a session. |
| **pass** / **wallet pass** | Google Wallet save URL. (Apple Wallet was removed.) |
| **check-in** | Scan/log entry for an attendee (`check_ins`). |
| **selection mode** | Event not yet finalized (`selection_locked = 0`): CSV/XLSX upload → column map → clusters → row select. |
| **finalize** | Lock selection; create attendees from selected CSV rows in one guarded batch. |
| **cluster** | Quota/filter group used during selection/raffle. |
| **DP campaign** / **campaign** | Profile-frame campaign (API/DB: `dp_*`). |
| **Frames** | Product UI name for DP campaigns (`/manage/frames`, `/frames/:slug`). Prefer **Frames** in UI talk; **DP** in API/DB talk. |
| **frame** | PNG overlay image (`dp_frames`). Max 10 per campaign. Stored in R2. |
| **media** | Org logos and banners, QR logos and frames, in the R2 bucket `eypi-media` (binding `MEDIA`). |
| **RUM** | Real-user monitoring. The SPA sends Web Vitals batches to `POST /api/rum` (`rum_samples`); hourly rollups write p75 per day, route, metric and device to `rum_daily`. Read in Admin → Speed. |
| **image variants** | Resized copies of an uploaded image in R2, written by the browser (`PUT /api/media/variants`) and listed in the stored image metadata (`ImageMeta`). `AppImage` builds the `srcset`. Admin → Maintenance backfills existing media. |
| **query cache** | In-memory cache of GET responses in `src/lib/queryCache.ts`. Writes through `src/lib/api.ts` invalidate it centrally, but only under the `/api/links`, `/api/events`, `/api/dp` and `/api/orgs` prefixes (the media variants PUT is not covered); logout and org switch clear it. |
| **public shell / app shell** | `PublicShell` renders public pages with no app chrome. `AppShell` (side rail, tab bar) is a lazy chunk loaded only for signed-in routes. |
| **service worker** | `public/sw.js` caches the app shell, media and the ticket list for offline use. Kill switch: `public/sw-kill.js` (see `docs/operations.md`). |
| **form** | Client-side document generator catalog item (DOCX fill). Not an HTML form builder. Templates are private objects in R2. |

---

## Module map

| Module | Path | Owns |
|---|---|---|
| **Frontend SPA** | `src/` | UI, routing, shared API client (`src/lib/api.ts`), client form generation, DP canvas, QR display |
| **Frontend Worker** | `worker/index.ts` | Serves SPA assets at `eypi.cc`; **edge short-link redirects** via `LINKS_KV`; async click logging; per-route meta tags; media route |
| **Backend API** | `backend/` | All `/api/*` on `api.eypi.cc` (Hono Worker): sign-in, sessions, links, orgs, events, DP, forms, admin, account, legal, stats, cron retention |
| **Migrations** | `backend/migrations/` | Versioned SQL, applied with `backend/scripts/migrate.mjs` (ledger `schema_migrations`) |
| **Shared contracts** | `shared/` | `LINKS_KV` encode/decode, click analytics helpers, reserved slug list |
| **Legacy redirects** | `redirects/` | Only `tix.eypi.cc` / `forms.eypi.cc` → unified `eypi.cc` — **not** general short links |
| **Design system** | `DESIGN_SYSTEM.md` | Visual/UI language (wantap layout and components in the APC light palette: light only, APC blue and gold, Plus Jakarta Sans, Syne, JetBrains Mono) |
| **Plans / specs** | `docs/superpowers/` | Agent plans and design specs |
| **Runbooks** | `docs/RELEASE.md`, `docs/operations.md` | Deploys, cutover, restore, rotation, incidents, accepted risks |

Removed in the wantap port: the theme toggle, the glass-card (mica) surfaces and the Geist fonts. The app is light only; the APC blue and gold brand colors came back in the light theme (`docs/superpowers/specs/2026-10-27-apc-light-theme-design.md`). Do not reintroduce a dark theme, the toggle, `dark:` utilities, mica or Geist.

### Backend route ownership

| Area | Primary files |
|---|---|
| Microsoft sign-in | `backend/src/routes/authMicrosoft.ts`, `backend/src/lib/auth/` |
| Current user, logout | `backend/src/routes/me.ts` |
| Account (export, sessions, delete) | `backend/src/routes/account.ts` |
| Legal consent | `backend/src/routes/legal.ts`, `middleware/requireConsent.ts` |
| Links + link analytics (`GET /api/links/summary` for the dashboard) | `backend/src/routes/links.ts` |
| Link reports (public) | `backend/src/routes/reports.ts` |
| Orgs, members, invites, public catalog (`GET /api/orgs/:org_id/summary` for the dashboard) | `backend/src/routes/orgs.ts` |
| Org feature gate / org context | `backend/src/middleware/orgGuard.ts` (`isOrgFeature`), `orgContext.ts` |
| Events / Tix | `backend/src/routes/events.ts` |
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
| Links | `/links` |
| Forms | `/forms` (org-gated) |
| Frames admin | `/manage/frames` |
| Frames public | `/frames/:slug` |
| Tix admin | `/manage/tix` |
| Tix public ticket | `/tix/:eventId` (param is **event slug**) |
| Orgs | `/orgs`, `/orgs/:slug`, `/orgs/modify`, `/invites` |
| Account | `/account` |
| Admin panel | `/admin`, `/admin/users`, `/admin/links`, `/admin/reports`, `/admin/audit`, `/admin/orgs`, `/admin/speed`, `/admin/maintenance` |
| Legal and reports | `/privacy`, `/terms`, `/acceptable-use`, `/report` |
| Short-link catch-all | `/:slug` (must stay late in router) |

---

## Tenancy model

| Feature | Scope |
|---|---|
| Links | **User** (`user_id`) |
| Events, DP/Frames, Forms | **Org** (via activated membership + `X-Active-Org-Id`) |
| Admin panel | **Platform** (`users.role = 'admin'`) |
| Public Frames / Tix lookup / org catalog / link redirect | **Unauthenticated** where noted |

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
4. **Tix** — create event → (optional) CSV/XLSX selection → finalize → public lookup → QR / Google Wallet pass → check-in.
5. **Frames** — create campaign + frames (R2) → public `/frames/:slug` → canvas merge → download count.
6. **Forms** — org-gated catalog → fetch template from R2 → client DOCX fill → download.
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
- **Platform totals** (`GET /api/stats`, public aggregates) show on the landing page and in Admin → Overview. They are not on the member dashboard.
- The side rail collapses to icons; the org switcher shows the capitalised org slug only.
