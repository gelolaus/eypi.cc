# eypi.cc overhaul — design spec

**Status:** Approved 2026-10-25 (owner: Angelo Laus)
**Inputs:** `2026-10-25-eypi-audit-findings.md` (finding IDs `F-*`), `docs/db/schema-baseline.md`
**Plan:** `docs/superpowers/plans/2026-10-25-eypi-overhaul.md`

This spec is the "what and why". The plan holds the step-by-step tasks. It is agent-agnostic: any coding agent (or human) can implement it. Where this spec and the code disagree, the spec wins. Where this spec and `CONTEXT.md` disagree, update `CONTEXT.md` (WS9).

---

## 1. Goals and non-goals

**Goals**

1. Close every CRIT and HIGH finding.
2. Replace email/password with **Sign in with Microsoft**, limited to APC accounts.
3. Make **Links**, the most-used product, best-in-class.
4. Restore the org invite flow end-to-end.
5. Add account self-service, an admin panel, and Data Privacy Act–grade legal pages.
6. Make the app fast, accessible, observable, and safe to change: versioned migrations, CI gates, tests.

**Non-goals**

- No framework rewrite. Stay on Vue 3 SPA + Hono Workers + Turso.
- No org role hierarchy. Every activated member keeps today's officer-level powers (F-ORG-15).
- No ticket emails.
- No separate dev database by default. An opt-in Turso branch is documented.
- No llms.txt or Markdown negotiation.

## 2. Locked decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Sign-in | Microsoft Entra ID only. Multi-tenant app registered in the owner's personal Entra (like wantap.cc). The callback **accepts only tenant `aeb745e6-8166-4f8f-9233-179e8109c49e`** (APC) **and** an email ending `@apc.edu.ph` / `@student.apc.edu.ph`. Everyone else is rejected before a session exists. |
| D2 | Cutover | Hard cutover. Password login is removed in the same release. Existing users are matched by lowercased email on first Microsoft sign-in. The 2 unverified, never-claimed accounts are deleted. |
| D3 | Sessions | Opaque server-side sessions in Turso, sent as an httpOnly cookie. Tix pass tokens get their own secret. |
| D4 | Org roles | Keep the flat model (all activated members can manage org features). |
| D5 | Invites | Email (Resend) plus an in-app inbox and a nav badge. |
| D6 | Super admin | `users.role` (`user`/`admin`), seeded with `arlaus@student.apc.edu.ph`. Hardcoded email constants are removed. Admin actions are audit-logged. |
| D7 | Admin panel | Yes: users, links, abuse reports, orgs, audit log. |
| D8 | Account | `/account`: export (JSON plus links CSV), delete account (deletes links), sessions, sign out everywhere. |
| D9 | Legal | Versioned Privacy, Terms, and Acceptable Use documents. Consent is recorded per version. Rewritten for RA 10173. |
| D10 | Tix | Fix correctness. Per-attendee QR download. No emails. Remove Apple Wallet. |
| D11 | Storage | Cloudflare R2 for frames, org images, QR logos, and form templates (free tier covers eypi's scale; zero egress fees). |
| D12 | Links | Full upgrade, including **password-protected links** (§6). |
| D13 | Removals | Custom cursor, splash loader, global Space handler, Apple Wallet, `vercel.json`, `.cursor/plans/`, dead files (F-HYG-1), unused `board_*` tables. |
| D14 | Migrations | Versioned SQL migrations with a ledger table (§4). |
| D15 | Hotfix | F-SEC-1 and F-FORM-1 ship first as their own PR (WS0). |
| D16 | Commits | Conventional Commits in the owner's style (`/conventional-commits` skill): `type(scope): lowercase imperative`, bullet body. **No co-author, Signed-off-by, or AI/tool trailers.** One commit per finished task or milestone. |

---

## 3. Authentication and sessions (WS2)

### 3.1 Entra app registration (owner, once)

- Owner's personal Entra → App registrations → New.
- **Supported account types:** "Accounts in any organizational directory (multitenant)". No personal Microsoft accounts.
- **Platform:** Web. **Redirect URIs** (exact match):
  - `https://api.eypi.cc/api/auth/microsoft/callback`
  - `http://localhost:8787/api/auth/microsoft/callback`
- **Client secret:** 24 months. Record the expiry date in `docs/operations.md`.
- **API permissions:** `openid`, `profile`, `email` (delegated). No `User.Read`; this keeps the consent screen minimal. APC already lets users consent to wantap.cc with the same scopes.

### 3.2 Flow (server-side authorization code + PKCE)

```
SPA "Sign in with Microsoft" (full-page nav)
  → GET api.eypi.cc/api/auth/microsoft/start?returnTo=/links
      create state, nonce, PKCE verifier
      Set-Cookie eypi_oauth=<signed {state,nonce,verifier,returnTo,consent?}>; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/api/auth
      302 → https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize
            ?client_id&response_type=code&redirect_uri&scope=openid%20profile%20email
            &state&nonce&code_challenge(S256)&prompt=select_account&domain_hint=apc.edu.ph
  → GET /api/auth/microsoft/callback?code&state
      1. verify eypi_oauth signature and state; delete the cookie
      2. POST /organizations/oauth2/v2.0/token (code, verifier, client secret)
      3. verify id_token with jose createRemoteJWKSet(https://login.microsoftonline.com/common/discovery/v2.0/keys)
         require: aud == MS_CLIENT_ID; tid ∈ MS_ALLOWED_TENANT_IDS;
                  iss == `https://login.microsoftonline.com/${tid}/v2.0`; nonce matches; exp valid
      4. email = lower(claims.email ?? claims.preferred_username); require an allowed APC domain
      5. resolve the user (3.3); reject if disabled_at is set
      6. handleUserOnboarding(email, userId)  (existing; attaches pending invites)
      7. create session (3.4); Set-Cookie session
      8. 302 → FRONTEND_ORIGIN + returnTo   (returnTo must start with "/" and not "//")
  errors → 302 FRONTEND_ORIGIN/login?error=tenant|domain|state|cancelled|disabled|server
```

Library choice: `jose` (Workers-compatible) for JWKS and claims. Hand-written fetch for the two endpoints, or `arctic`'s `MicrosoftEntraId` with the claim checks above kept in eypi's own code. **Never trust `email` without the `tid` check.** That is the nOAuth class this design avoids (wantap.cc does not, see findings §9).

### 3.3 Identity resolution

1. `SELECT user_id FROM user_identities WHERE provider='microsoft' AND tenant_id=? AND subject=?` (`subject` = `oid`). If found, use it, and refresh `users.email` and `users.name` if they changed.
2. Else `SELECT id FROM users WHERE email = ?` (lowercased). If found, insert the identity row (first-time link of a legacy account).
3. Else insert a new user (`id` = `crypto.randomUUID()`, `role='user'`), then the identity. The DB trigger `enforce_apc_email_insert` is a second guard.

### 3.4 Sessions

- Token: 32 random bytes, base64url. The DB stores `id = sha256(token)` hex. The raw token only ever lives in the cookie.
- Cookie: `__Host-eypi_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`. Set by `api.eypi.cc` (host-only). `eypi.cc` → `api.eypi.cc` is same-site, so Lax cookies are sent on `fetch(..., { credentials: 'include' })`. Local dev uses the cookie name `eypi_session` (no `__Host-` prefix) because the prefix requires HTTPS on some browsers.
- TTL: 30 days, sliding. Extend `expires_at` and `last_seen_at` at most once per hour per session.
- `requireAuth` middleware: read the cookie → hash → join `sessions`/`users` → reject expired, missing, or `disabled_at` → set `c.var.user = { id, email, name, role }`. **Fail closed** on DB errors (503, not 401-logout).
- **CSRF:** middleware on every non-GET/HEAD/OPTIONS `/api/*` request requires the `Origin` header to be in the allowlist (`https://eypi.cc`, plus localhost when `ENVIRONMENT !== 'production'`). SameSite=Lax covers top-level POSTs from other sites.
- **CORS:** allowlist as above, `credentials: true`. Remove localhost in production (F-SEC-8).
- Endpoints:
  - `GET /api/me` → `{ user, pendingInviteCount, needsConsent, orgs }`
  - `POST /api/auth/logout` → delete the session row and clear the cookie
  - `GET /api/account/sessions` and `DELETE /api/account/sessions/:id`
  - `POST /api/account/sessions/revoke-all` ("sign out everywhere")
- Rate limits: `start` and `callback` 30/10 min per IP.

### 3.5 Roles

`users.role IN ('user','admin')`. `requireAdmin` middleware checks `c.var.user.role === 'admin'`. Delete `shared/admin.ts` and `src/config/admin.ts`. The SPA reads `role` from `/api/me`.

### 3.6 Frontend

- `src/stores/session.ts` (plain reactive singleton, no new dependency): `user`, `status`, `load()` (calls `/api/me` once at boot and after login), `logout()`.
- `src/lib/api.ts` (F-PLAT-2): `api.get/post/patch/del` with `credentials: 'include'`, JSON, the `X-Active-Org-Id` header, a typed `ApiError { status, code, message }`. A 401 resets the session store and routes to `/login?returnTo=…`. Every view migrates to it. No `localStorage` token anywhere.
- `LoginView`: a single "Sign in with Microsoft" button (Microsoft brand guidelines: logo plus "Sign in with Microsoft"). Subtitle "Use your APC Microsoft 365 account". Error copy per `?error=`.
- Router guard: `await session.load()`, then the `requiresAuth` / `requiresAdmin` / `requiresOrg` checks.
- Delete `VerifyView`, `ResetPasswordView`, the password section of `SettingsView`, and the `/verify` and `/reset-password` routes. Old routes 301 to `/login` in the worker for a while.

### 3.7 Pass tokens (WS0 then WS2)

- WS0: session verification rejects any JWT whose payload has `typ`. Pass tokens are signed and verified with `PASS_TOKEN_SECRET`.
- WS2: sessions are no longer JWTs at all. `JWT_SECRET` is deleted. `PASS_TOKEN_SECRET` stays for wallet passes.

### 3.8 Database changes (two migrations around the deploy)

- **0003_auth_additive** (before deploy):
  - `user_identities(provider, tenant_id, subject, user_id → users ON DELETE CASCADE, email_at_link, created_at, PK(provider, tenant_id, subject))`
  - `sessions(id PK, user_id → users ON DELETE CASCADE, created_at, last_seen_at, expires_at, user_agent, ip_hash)`, with an index on `sessions(user_id)`
  - `ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`, `last_login_at`, `disabled_at`
  - `UPDATE users SET role='admin' WHERE email='arlaus@student.apc.edu.ph'`
- **0004_auth_cleanup** (after the new backend is live):
  - `UPDATE org_members SET user_id = NULL WHERE user_id IN (SELECT id FROM users WHERE COALESCE(is_verified,0)=0)`
  - `DELETE FROM users WHERE COALESCE(is_verified,0)=0` (production: 2 rows, owning nothing)
  - `ALTER TABLE users DROP COLUMN password_hash`, then `verification_token`, then `is_verified` (allowed: their CHECK/NOT NULL constraints are column-level; no index or FK uses them)

> **DANGER:** never `DROP TABLE users` or rebuild it while `foreign_keys` is on. SQLite runs an implicit `DELETE`, and `links ON DELETE CASCADE` would wipe every link and its analytics. Use `ALTER TABLE … DROP COLUMN`. Rehearse both migrations on a Turso branch (`turso db create eypi-rehearsal --from-db <prod>`) before production.

### 3.9 Removed

`bcryptjs`, the verification email files, `FRONTEND_URL` (replaced by `FRONTEND_ORIGIN`), `rl:register|verify|login` keys, `ALLOWED_EMAIL_DOMAINS` (replaced by `shared/apcIdentity.ts`), and `JWT_SECRET`. `resend` stays for invites.

### 3.10 Env and secrets (backend)

| Key | Notes |
|---|---|
| `MS_CLIENT_ID`, `MS_CLIENT_SECRET` | Entra app |
| `MS_ALLOWED_TENANT_IDS` | `aeb745e6-8166-4f8f-9233-179e8109c49e` (comma list) |
| `AUTH_COOKIE_SECRET` | HMAC for the `eypi_oauth` cookie (≥ 32 bytes) |
| `PASS_TOKEN_SECRET` | wallet pass JWTs |
| `IP_HASH_SECRET` | HMAC for IP hashing (sessions, analytics unique visitors, reports) |
| `FRONTEND_ORIGIN` | `https://eypi.cc` / `http://localhost:5173` |
| `ENVIRONMENT` | `production` / `development` |
| `RESEND_API_KEY` | invites |

`npm run doctor`, `.dev.vars.example`, `scripts/setup.mjs` (generates the three secrets), and `README.md` must be updated to match.

---

## 4. Foundations (WS1)

### 4.1 Migrations

- Stop ignoring migration SQL: add `!backend/migrations/*.sql` to `.gitignore`. Keep other `*.sql` ignored.
- `backend/migrations/0001_baseline.sql`: DDL from `docs/db/schema-baseline.md` (marked applied on production, never re-run).
- `backend/migrations/0002_hygiene.sql`: drop the 9 `board_*` tables (0 rows) and add the missing indexes (F-DB-9).
- Ledger: `schema_migrations(version TEXT PK, name, checksum, applied_at)`.
- Runner `backend/scripts/migrate.mjs` (replaces `run-migration.mjs`):
  - `--status`, `--dry-run`, `--yes`, `--baseline` (records 0001 without executing)
  - prints the target DB hostname and pending files
  - each file runs as one `client.batch(statements, 'write')` (one transaction)
  - refuses `DROP TABLE` / `DELETE` without `WHERE` unless `--allow-destructive`
  - checksum mismatch on an applied file is a hard error
- Tests: an in-memory libSQL (`createClient({ url: ':memory:' })`) plus all migrations, used by route tests (§4.4).

### 4.2 Backend platform

- `app.onError`: log one JSON line through `lib/reportError.ts` (`{ level, route, code, message, requestId }`, no PII or secrets) and return `{ error: { code, message } }` with the right status. `app.notFound` → 404 JSON.
- `lib/http.ts`: `badRequest`, `forbidden`, `conflict`, … helpers so route handlers stop hand-rolling shapes.
- `GET /api/health`: env presence plus `SELECT 1`.
- `wrangler.jsonc` (both workers): enable `observability: { enabled: true }`; add a cron trigger for retention jobs (§9.4).
- One `db(c)` per request (F-DB-7).
- Org resolution once per request into `c.var.orgId` (`orgContext` middleware). An invalid header → 403 `org_not_accessible` (F-ORG-4).

### 4.3 Frontend platform

`src/lib/api.ts` and `src/stores/session.ts` (§3.6) land here, with a temporary bearer-token adapter so views can migrate before WS2 flips to cookies. Also `app.config.errorHandler`, and `router.onError` chunk-reload (once per route, guarded by `sessionStorage`).

### 4.4 Quality gates

- **CI** (`.github/workflows/ci.yml` replaces `test.yml`): Node 22; `npm ci` in both packages; `npm run lint`; `npm run typecheck`; `npm test`; `npm run build`; `wrangler deploy --dry-run` for both workers; `npm audit --omit=dev --audit-level=high` (allowlist only documented exceptions).
- **ESLint 9** flat config: `typescript-eslint`, `eslint-plugin-vue`, `eslint-plugin-vuejs-accessibility`.
- **Tests:** Vitest. Add `happy-dom` plus `@vue/test-utils` for component tests. Route tests use `app.request()` against in-memory libSQL. Every new route ships with route tests covering authz (anonymous, other user, other org, admin).
- **Playwright smoke** (optional, WS7): home, login button, 404 status, security headers.

### 4.5 Dependencies

`npm audit fix` both packages; hono ≥ 4.13; dompurify latest; remove `xlsx` (replace with `exceljs` lazily loaded, or the SheetJS CDN tarball 0.20.3); remove `@tursodatabase/database`, `vite-svg-loader`, and (with Apple Wallet) `node-forge`; bump wrangler and `@cloudflare/vite-plugin`. Vite 8 only if green.

---

## 5. Orgs and invites (WS3)

- **Schema 0005_invites:** `org_members ADD invited_by TEXT, ADD declined_at DATETIME`.
- **API changes:**
  - `GET /api/orgs/invites` returns org name, logo, inviter name, and invited_at.
  - Accept and decline use the session's lowercased email.
  - Decline sets `declined_at` instead of deleting.
  - Invite returns 409 `already_member` / `already_invited`, and 429 if re-invited within 7 days of a decline.
  - `POST /api/orgs/:id/members/:email/resend`: 1 per 24 h.
  - Cancel = the existing remove on a pending row (owner UI labels it "Cancel invite").
- **Email:** `lib/emails/orgInviteEmail.ts` (same escaping pattern as the old verify email). From `eypi.cc <invites@…>`. Subject "You're invited to join {Org} on eypi.cc". CTA → `https://eypi.cc/invites`. Sending failure doesn't fail the invite; the response says `emailSent:false`.
- **UI:**
  - `/invites` page: cards with logo, org name, "Invited by X · 3 days ago", Accept / Decline (decline confirm).
  - Dashboard banner when `pendingInviteCount > 0`.
  - Nav badge.
  - `OrgLockout` lists invites inline (fixes F-ORG-2).
  - On accept: clear the membership cache, `fetchOrgs()`, set the active org, toast, route to `/orgs/:slug`.
- **Fixes:** F-ORG-3 (remove the admin transfer form), F-ORG-4/5/6/7/8/10/12/14, F-ORG-11 (delete `orgMembers.ts`), F-ORG-13 (slug rename: insert the new org row, repoint children, delete the old row, in one batch, rehearsed on a branch DB; if it's not safe, disable slug rename with an explanatory UI note).
- Transfer ownership: pick-list of active members.

---

## 6. Links (WS4). Highest priority product work

### 6.1 Data model (0006_links)

```
links ADD COLUMN expires_at DATETIME
links ADD COLUMN disabled_at DATETIME
links ADD COLUMN disabled_reason TEXT          -- 'owner' | 'abuse' | 'admin'
links ADD COLUMN password_hash TEXT            -- PBKDF2 (see 6.3)
links ADD COLUMN updated_at DATETIME
analytics ADD COLUMN visitor_hash TEXT         -- HMAC(IP_HASH_SECRET, day|ip|ua) truncated to 16 hex; never raw IP
analytics ADD COLUMN source TEXT               -- 'qr' | 'direct' | NULL
CREATE INDEX idx_links_user_created ON links(user_id, created_at DESC)
CREATE INDEX idx_analytics_link_created ON analytics(link_id, created_at)
CREATE TABLE link_reports(id, link_id → links ON DELETE CASCADE, slug, reason, details,
  reporter_ip_hash, reporter_user_id, created_at, resolved_at, resolved_by, resolution)
```

QR logos move out of `qr_config` to R2 (`qr-logos/{linkId}-{sha8}.png`); `qr_config.logo` becomes `{ key }` (WS6 migrates the existing 4).

### 6.2 Edge contract (`shared/linksKv.ts` v2)

- KV value: `{ v:2, id, url, exp?: epochSeconds, pw?: 1 }`.
- Disabled links are **removed** from KV.
- The decoder still accepts v1 `{id,url}`.
- Worker:
  1. GET only. A HEAD request returns 302 with no logging.
  2. Reserved slugs are skipped.
  3. KV miss → SPA.
  4. `exp` in the past → 302 `/expired`.
  5. `pw` → 302 `/unlock/:slug`.
  6. Otherwise log (skip bot user agents; `source='qr'` when `?src=qr`, which is stripped before redirecting) and **302** with `Cache-Control: private, max-age=0`.
- `logLinkClick` inserts analytics and increments `links.clicks WHERE id=?` in one batch (F-LINK-7).
- SPA fallback `GET /api/links/:slug` follows the same rules, is rate-limited (60/min/IP), and takes the referrer in the query (`?r=`), not a custom header (F-PERF-6).

### 6.3 Password-protected links

- Owner sets or clears a password (8–128 characters) in the link editor.
- Stored as `pbkdf2$sha256$100000$<salt b64>$<hash b64>` via WebCrypto. 100k is the Workers PBKDF2 iteration cap.
- `/unlock/:slug` (SPA, reserved slug `unlock`): password field. `POST /api/links/:slug/unlock { password }` checks it with a constant-time compare and is rate-limited per IP+slug (10/15 min). On success it logs the click and returns `{ url }`, and the SPA does `location.replace(url)`. No cookie is remembered; each visit re-prompts. That keeps it simple and avoids stale access after a password change.
- The QR code of a protected link still encodes `eypi.cc/slug`.

### 6.4 Features and UX

| Feature | Detail |
|---|---|
| Custom slug at create | Optional field; live availability (`GET /api/links/slug-available?slug=`, debounced 300 ms; returns `available`, `reason: reserved\|taken\|invalid`) |
| Slug rule | Shared `shared/slugRules.ts`: `^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$`, input lowercased as typed; generated slugs 7 characters from `[a-z0-9]` |
| Destination validation | One shared validator used by client and server; reject userinfo, the eypi.cc domain, a known-shortener denylist; keep the SSRF/private-IP rules; optional Google Safe Browsing v4 lookup when `SAFE_BROWSING_API_KEY` is set (fail open, logged) |
| Expiry | Date-time picker (Manila time); expired links show `/expired` ("This link has expired"), 410-style copy; the owner sees an "Expired" badge |
| Disable / enable | Toggle per link (removes it from KV); disabled by admin shows "Disabled by moderator" and can't be re-enabled by the owner |
| UTM builder | Collapsible: source, medium, campaign, term, content → merged into the destination query (client-side; no schema) |
| List | Server-paginated (cursor, 25/page), search (slug or destination), sort (newest, oldest, most clicks), filter (active, expired, disabled, protected); row shows slug, destination host, clicks, created date, badges |
| Bulk | Multi-select delete and disable (confirm dialog with count) |
| Analytics | Totals, unique visitors, QR vs direct, a 7/30/90-day timeline (Manila days), top 5 referrer/country/OS (ordered in SQL), peak hour; lazy-loaded chart chunk |
| Export | `GET /api/links/export.csv` (slug, short URL, destination, clicks, created_at, expires_at, status) and `GET /api/links/:id/analytics.csv` (timestamp Manila, country, OS, referrer, source); RFC 4180 quoting, `formula-injection` guard (prefix `'` to cells starting with `= + - @`) |
| QR | Existing designer kept; QR encodes `?src=qr` when "Track QR scans" is on (default on for new links) |
| Quotas | 500 links per user; create 30/hour; edits 120/hour (429 with friendly copy) |
| Report abuse | Public `/report?slug=` form (reason: phishing, malware, spam, inappropriate, other; details ≤ 1000); 5/hour/IP; creates a `link_reports` row; admin queue (§9.2) |
| Errors | 401 only from auth; 409 `slug_taken`; 422 validation with field errors shown inline (DESIGN_SYSTEM inline-error rule) |

### 6.5 Component split

`views/links/LinksView.vue` becomes a thin page plus:
- `components/links/LinkList.vue`, `LinkRow.vue`, `LinkFilters.vue`
- `LinkEditorPanel.vue` (create/edit slide-over), `LinkAdvancedFields.vue` (expiry, password, UTM)
- `QrDesigner.vue`, `AnalyticsPanel.vue` (async)
- `composables/useLinks.ts` (paging, cache, mutations)

The created link is returned by the API (F-LINK-17).

### 6.6 Reserved slugs

Add `admin, account, api, assets, auth, logout, signup, help, about, qr, static, invites, report, unlock, expired, media, p`. **Before adding**, query production for existing links using any of them and rename those (notify the owner). Add a parity test that every top-level route in `src/router/index.ts` is reserved.

---

## 7. Tix (WS5)

Correctness first; the feature is unused in production. Fix F-TIX-1…20. Key designs:

- **Finalize:** `UPDATE events SET selection_locked=1 WHERE id=? AND selection_locked=0` → `rowsAffected==1` or 409, then one batch of inserts. Migration `0007_tix`: unique index `attendees(event_id, lower(email))`; `attendees ADD csv_row_id`; `events ADD pass_fields TEXT DEFAULT '[]'` (column allowlist); index `check_ins(attendee_id, actioned_at)`.
- **Selection logic:** extracted to `src/lib/tix/selection.ts` (pure, unit-tested: dedupe, quotas, criteria, deterministic seeded shuffle).
- **Per-attendee QR:** a "Download QR" action per row; "Download all (ZIP)" any time; files named `{lastname}_{firstname}_{attendeeIdPrefix}.png`.
- **Check-in:** guarded insert, monotonic ordering, scanner remembers the last token for 5 s, result-specific haptics/sound, mobile status column.
- **Rate limits:** lookup keyed by IP + event + sha256(email); passes get their own bucket; 429 copy "Too many attempts. Wait a few minutes and try again."
- **Google Wallet:** class upsert; Manila offset. **Apple Wallet removed** (endpoint, `applePass.ts`, assets, env, `node-forge`).
- **Split:** `EventDetailView` → `ScannerPanel`, `AttendeeTable`, `ClusterBars`, `AddGuestPanel`, `useEventAttendees`, `useQrScanner`. `AttendeeSelectionView` → one component per step.
- **Parsing:** `papaparse` for CSV; `exceljs` for xlsx (lazy). Header indices preserved; 5,000-row cap.

---

## 8. R2, Frames, Forms (WS6)

### 8.1 R2 layout

- Bucket `eypi-media`, bound as `MEDIA` in **both** workers.
- Public prefixes, served by the **frontend worker** at `https://eypi.cc/media/<key>` (same origin, so canvas isn't tainted), with `Cache-Control: public, max-age=31536000, immutable` (content-hashed keys):
  - `frames/{campaignId}/{frameId}-{sha8}.png`
  - `orgs/{orgId}/{logo|banner}-{sha8}.{png|jpg|webp}`
  - `qr-logos/{linkId}-{sha8}.png`
- Private prefix `templates/{file}.docx`, readable only by the backend's org-gated `GET /api/forms/templates/:file`. The frontend worker refuses any key outside the public prefixes.
- Uploads go through the backend (multipart or base64 JSON ≤ 3 MB). Validate magic bytes (PNG/JPEG/WebP only), dimensions, and size. Old objects are deleted after a DB update succeeds.
- `media` is a reserved slug.

### 8.2 Data migration (one-off, idempotent)

- `POST /api/admin/migrations/media` (admin-only, `?dryRun=1` default) iterates `dp_frames.image_url`, `organizations.logo_url/banner_url`, and `links.qr_config.logo` that start with `data:`. It uploads to R2 and rewrites each column to the key, then reports counts.
- Production sizes: 6 frames, 2 org images, 4 QR logos.
- The endpoint is deleted in a follow-up commit after the run.
- Templates: the owner uploads the `.docx` files once with `wrangler r2 object put eypi-media/templates/<file> --file <path>` (documented in `docs/operations.md`). Then remove the backend `assets` block, `backend/assets/forms/`, and the `.gitignore` rule.

### 8.3 Frames

- Public payload returns `{ frames: [{ id, label, url, width, height }] }`, with `Cache-Control: public, max-age=60`.
- Upload validation: PNG with alpha, square, ≥ 1080 px, ≤ 3 MB.
- Canvas sized from the frame.
- Visitor photo pipeline: `createImageBitmap` downscale to ≤ 2160 px longest side, an error toast for undecodable files (HEIC hint), input reset.
- Save: `navigator.share({ files })` when supported, else download.
- Atomic create (F-FRAME-3), serialized adds with a conditional insert (F-FRAME-4), download counter rate limit (F-FRAME-2).
- Slug history: `dp_slug_history(old_slug PK, campaign_id)`. The public lookup follows it, and the editor `router.replace`s (F-FRAME-7).
- **OG tags:** the frontend worker `HTMLRewriter` injects title, description, and `og:image` (first frame) for `/frames/:slug` (F-SEO-1).

### 8.4 Forms

- `shared/formsCatalog.ts`: single catalog.
- `composables/useDocxGenerator.ts`: fetch template (ETag, `private, max-age=3600`), render, typed errors (template missing / template tag error / validation), save; shared CSV via `papaparse` with a preview table and header detection; filename sanitizer with duplicate suffixes; `required` fields; `walkInCount` ≤ 500.

---

## 9. Account, admin, legal (WS8)

### 9.1 `/account` (replaces `/settings`)

- **Profile:** name and email (from Microsoft, read-only), role badge, "Signed in with Microsoft (APC)".
- **Sessions:** device (parsed UA), last active, current marker; revoke one; "Sign out everywhere".
- **Export:**
  - "Download my data (JSON)": profile, links (with analytics aggregates), memberships, invites, owned orgs, consents, sessions metadata.
  - "Download my links (CSV)": same as `/api/links/export.csv`.
- **Delete account:**
  - Type your email to confirm.
  - Blocked while the user owns an org (UI lists the orgs, with a transfer link).
  - Otherwise one ordered batch:
    1. `events.lead_user_id` and `dp_campaigns.creator_id` → reassign to the org owner
    2. `DELETE org_members WHERE user_id=? OR email=?`
    3. `DELETE link_reports` for their links happens by cascade
    4. `DELETE links` (analytics cascade)
    5. sessions and identities (cascade)
    6. `legal_consents`
    7. `DELETE users`
  - R2 QR logos of deleted links are deleted afterwards (best effort, logged).
  - `audit_events` keeps `actor_user_id` but the row's email is replaced with `deleted-user`.

### 9.2 Admin (`/admin`, `requiresAdmin`)

- **Users:** search; role toggle (can't demote yourself or the last admin); disable/enable (also revokes sessions); force logout; delete (same routine as §9.1, refused for org owners).
- **Links:** global search; disable with reason (`abuse`/`admin`); view owner.
- **Reports:** queue (open/resolved), resolve with action (disable link / dismiss), with a link to the target.
- **Orgs:** the existing org management (`/settings/orgs*`) moves here.
- **Audit log:** `audit_events(id, actor_user_id, action, target_type, target_id, meta JSON, created_at)`, written by every admin mutation and by org ownership changes; paginated, filterable.
- Migration `0008_admin_legal`: `audit_events`, `legal_consents`.

### 9.3 Legal

- `src/legal/{privacy,terms,acceptable-use}.ts` export `{ version: '2026-11-01', title, sections }`, rendered by one `LegalView` at `/privacy`, `/terms`, `/acceptable-use`. Each page has a version and effective date.
- **Privacy content (RA 10173)** must cover:
  - controller identity and contact, DPO contact
  - data collected per feature (account, links, analytics fields incl. hashed visitor id, rate-limit IP processing, org data, Tix CSV data and wallet passes, Frames uploads, form inputs never leaving the browser)
  - purposes and legal basis
  - processors (Cloudflare, Turso, Microsoft, Resend, Google Wallet) and cross-border transfer
  - retention (§9.4), rights (access, correction, erasure, portability, objection), and the right to complain to the National Privacy Commission
  - localStorage keys and the session cookie
  - The owner must review the final text; agents draft only.
- `legal_consents(id, user_id → users ON DELETE CASCADE, document, version, accepted_at, ip_hash, user_agent)`.
- `GET /api/me` returns `needsConsent: [{document, version}]` when the latest Privacy/Terms versions aren't accepted. The SPA shows a blocking consent screen (checkboxes plus links). `POST /api/legal/consent` records them. Org-gated and link-mutation APIs return 403 `consent_required` until accepted.
- Footer links to all three pages plus Contact. A cookie notice is **not** needed (only a strictly necessary session cookie); the privacy policy states this.

### 9.4 Retention (cron, daily)

- Expired sessions deleted.
- `event_csv_rows` deleted 30 days after `event_date`.
- `link_reports` resolved > 180 days deleted.
- Rate-limit keys expire via KV TTL.

---

## 10. Platform UX, performance, SEO (WS7)

- **Remove:** `AppCursor`, `AppLoader`, `useKeyboardNav` (and `data-section` uses), `vercel.json`, `.cursor/plans/`, plus the dead files from F-HYG-1.
- **Caching:** `public/_headers` gets `/assets/*` → `public, max-age=31536000, immutable`. HTML stays `no-cache`.
- **Fonts:** self-host Geist and Geist Mono (woff2, `font-display: swap`, preload the two used weights); drop Google Fonts from CSP.
- **CSP:** `script-src 'self'`; add `base-uri 'self'; form-action 'self'; object-src 'none'`; `connect-src 'self' https://api.eypi.cc`; `img-src 'self' data: blob:`.
- **Accessibility:**
  - Dark text on gold everywhere.
  - Focus ring navy (light) / gold (dark).
  - Dark-mode blue token.
  - Shared `useFocusTrap` for the sidebar and dialogs, restoring focus.
  - Scoped Esc.
  - Carousel pause button and inert hidden slides.
  - Route titles plus a polite live-region announcement.
  - Reduced motion respected in JS scrolling.
  - `DESIGN_SYSTEM.md` updated.
- **UX:** scroll restoration; dark mode follows the system by default with a singleton store and no flash (`<meta name="color-scheme" content="light dark">` plus a class applied before mount in `main.ts`, which runs first); toast offset.
- **SEO:**
  - Static `public/robots.txt` (allow all; disallow `/api`, `/account`, `/admin`, `/links`, `/manage`; sitemap URL).
  - Worker-generated `/sitemap.xml` (home, legal pages, public orgs, frames campaigns).
  - The worker sets a **404 status** for unknown multi-segment paths (single-segment paths may be slugs; the SPA renders NotFound for misses, and the worker returns 404 when KV misses and the slug isn't a known SPA route).
  - `HTMLRewriter` meta for `/`, `/orgs/:slug` (plus JSON-LD `Organization`), `/frames/:slug`.
  - `index.html` title "eypi.cc · Links and org tools for APC".
  - Manifest, apple-touch-icon, theme-color.
- **Shared layout:** `PageShell` and `LegalLayout` components replace duplicated markup.

---

## 11. Docs (WS9)

- `AGENTS.md` (repo root): the agent entry point. It covers the stack, commands, where truth lives (`CONTEXT.md`, `DESIGN_SYSTEM.md`, this spec, the plan), safety rules (prod DB, no destructive SQL without approval, secrets), commit rules (D16), and the definition of done. `CLAUDE.md` contains `@AGENTS.md`.
- `CONTEXT.md`: update the auth seam, roles (flat org model; admin role), schema location, R2, sessions, removed modules.
- `docs/operations.md`: Turso PITR restore and branch rehearsal, the migration runner, KV backfill and reconcile, R2 template upload and media migration, Entra secret rotation (expiry date), Resend domain, cron jobs, incident checklist.
- `docs/RELEASE.md` and `README.md`: new env and the deploy order (§12).

## 12. Release order (production)

1. **WS0 hotfix PR** → deploy the backend (and set `PASS_TOKEN_SECRET`).
2. WS1 foundations (migration ledger `--baseline`, 0002).
3. WS4, WS5, WS6, WS7 can deploy independently as they land (each PR deploys green).
4. **Auth cutover** (single window):
   1. Owner creates the Entra app and secrets.
   2. Rehearse 0003/0004 on a Turso branch.
   3. Apply 0003.
   4. Deploy backend + frontend (WS2).
   5. Owner signs in with Microsoft and checks the admin role.
   6. Apply 0004.
   7. Remove `JWT_SECRET`.
5. WS3 and WS8 on top of WS2.
6. Final: full regression checklist (plan, "Final verification").

## 13. Error handling and testing summary

- Every API error is `{ error: { code, message, fields? } }`. Codes are stable snake_case and documented in `backend/src/lib/errors.ts`.
- The SPA maps `ApiError.code` to copy. Field errors render inline. Network errors show a Signal-strip toast "Can't reach eypi.cc. Check your connection."
- Every task ships tests. Authz matrix tests are required for every route touched. Pure logic (slug rules, selection, CSV, KV codec, password hashing, consent gate, OAuth claim checks) is unit-tested. The final gate is `npm run lint && npm run typecheck && npm test && npm run build` green in CI.
