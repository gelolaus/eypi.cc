# eypi.cc Overhaul Implementation Plan

> **For agentic workers (any tool: Cursor, Claude Code, Codex, Grok, etc.):** Run this plan task by task with subagent-driven development: one fresh implementer per task, one fresh reviewer per task, then a whole-branch review per workstream. In Claude Code use `superpowers:subagent-driven-development`; elsewhere follow the same loop by hand. Steps use checkbox (`- [ ]`) syntax. Tick them as you go and commit the ticked plan with the task.

**Goal:** Close every critical and high finding from the 2026-10-25 audit, replace password login with APC-only Microsoft sign-in, and ship the Links, Orgs, Tix, Frames, Forms, account, admin, legal and platform improvements the design locks.

**Architecture:** Keep the Vue 3 SPA (`src/`) + Hono API Worker (`backend/`) + frontend edge Worker (`worker/`) + Turso. Add versioned migrations, cookie sessions, R2 media, a shared API client, and a global error contract. Work is split into workstreams (WS0–WS9) with explicit file ownership so several agents can run in parallel.

**Tech Stack:** Vue 3.5, Vue Router 4, Tailwind 3, Vite, Hono 4.13+, Cloudflare Workers (KV, R2, cron), Turso/libSQL (`@libsql/client`), `jose`, Vitest (+ happy-dom, @vue/test-utils), ESLint 9, Resend.

**Spec:** `docs/superpowers/specs/2026-10-25-eypi-overhaul-design.md` (read it first; section refs below are `§n`). Findings: `docs/superpowers/specs/2026-10-25-eypi-audit-findings.md` (`F-*` IDs). Live schema: `docs/db/schema-baseline.md`.

## Global Constraints

- Allowed sign-in: Entra tenant `aeb745e6-8166-4f8f-9233-179e8109c49e` **and** email ending `@apc.edu.ph` or `@student.apc.edu.ph` (lowercased). Nothing else creates a session.
- Super admin seed: `arlaus@student.apc.edu.ph` (`users.role = 'admin'`).
- Session cookie: `__Host-eypi_session` (prod) / `eypi_session` (dev), `HttpOnly; Secure; SameSite=Lax; Path=/`, 30-day sliding TTL, DB stores `sha256(token)`.
- API error body: `{ "error": { "code": "<snake_case>", "message": "<sentence>", "fields"?: { [name]: string } } }`. 401 only from auth middleware.
- Slug rule: `^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$`; generated slugs are 7 chars `[a-z0-9]`.
- Short-link redirect: **302** with `Cache-Control: private, max-age=0`.
- Link password hash format: `pbkdf2$sha256$100000$<saltB64>$<hashB64>`.
- Quotas: 500 links/user; link create 30/hour; link edit 120/hour; unlock 10 per 15 min per IP+slug; report 5/hour/IP; SPA slug lookup 60/min/IP.
- Times shown to users are Manila (UTC+8). Store UTC.
- Org model stays flat: every activated member keeps today's org powers. Do not add org roles.
- No ticket emails. Apple Wallet is removed.
- Never run destructive SQL against production without the owner's explicit go-ahead. Never `DROP TABLE users` (FK cascade wipes links). Local dev talks to **production** Turso.
- Never commit secrets (`backend/.dev.vars`, `.env*`).
- Copy and UI follow `DESIGN_SYSTEM.md` (sentence case, no emoji, inline field errors, Signal-strip toasts, mica dialogs).
- **Commits:** Conventional Commits in the owner's style: `type(scope): lowercase imperative subject` (≤ ~72 chars, no period) + blank line + `- bullet` body. Scopes from repo history: `auth`, `links`, `orgs`, `tix`, `dp`, `forms`, `ui`, `admin`, `db`, `seo`, `deps`, `config`, `ci`, `docs`, `account`, `legal`, `platform`. **Never add `Co-Authored-By`, `Signed-off-by`, "Generated with", or any AI/tool trailer.** One commit per finished task (more is fine), each green.
- Definition of done per task: its tests pass, `npm run typecheck` and `npm test` pass (and `npm run lint` once WS1 Task 1.5 lands), the change follows the spec, the commit has landed.

## Review Focus

1. **Existing users on first Microsoft sign-in:** a legacy user whose Entra `oid` is new must land on their existing `users.id` with links and orgs intact (matched by lowercased email), not a fresh account. Test in Task 2.3.
2. **Foreign tenants that claim an APC email:** a token from any other `tid` whose `email` claim ends `@apc.edu.ph` must be rejected. Test in Task 2.2.
3. **Existing short links survive every change:** v1 KV values `{id,url}` keep redirecting after the v2 codec ships, and new reserved slugs never silently shadow an existing user link. Tests in Tasks 4.2 and 4.9.
4. **Campus NAT:** many students behind one IP (door check-in, link clicks, sign-in) must not lock each other out. Rate-limit keys include a subject (event + email hash, slug), not IP alone. Tests in Tasks 4.3 and 5.3.
5. **Deploy while a tab is open:** an old tab hitting a missing lazy chunk reloads once into the target route instead of doing nothing, and an expired session routes to `/login?returnTo=` instead of showing raw errors. Tests in Tasks 1.4 and 2.5.

---

## Coordination rules (parallel agents)

- **Branches:** one branch per task or per small group of tasks: `ws<N>/<short-name>` (e.g. `ws4/link-redirects`). PR into `main`. Keep PRs small. Rebase on `main` before merging.
- **Dependency order:** WS0 → WS1 → {WS2, WS4, WS5, WS6, WS7 in parallel} → {WS3, WS8 after WS2}. WS9 runs alongside and finishes last.
- **Shared files (one owner at a time; others rebase):**

| File | Owner | Others may |
|---|---|---|
| `backend/src/index.ts` | WS1, then WS2 | mount a router in one line |
| `src/router/index.ts` | WS7 | add route records in their own block |
| `shared/reservedSlugs.ts` | WS4 | request entries via WS4 |
| `backend/migrations/*` | the WS that creates the numbered file | never edit an applied migration |
| `public/_headers`, `worker/index.ts` | WS7 (headers, meta) and WS4 (redirect path) | coordinate via PR |
| `DESIGN_SYSTEM.md`, `CONTEXT.md` | WS7 and WS9 | propose changes in PR description |

- **Migration numbers are reserved:** 0001 baseline, 0002 hygiene (WS1), 0003 auth additive, 0004 auth cleanup (WS2), 0005 invites (WS3), 0006 links (WS4), 0007 tix (WS5), 0008 admin+legal (WS8), 0009 media (WS6).
- **Test helper:** every backend route test uses `createTestApp()` from Task 1.2. Don't hand-roll DB mocks.

## File map (new files)

```
backend/migrations/0001_baseline.sql … 0009_media.sql
backend/scripts/migrate.mjs                      # replaces run-migration.mjs
backend/src/lib/errors.ts                        # ApiError, error codes, onError
backend/src/lib/reportError.ts                   # JSON-line logger
backend/src/lib/db.ts                            # db(c) helper (modified)
backend/src/lib/ipHash.ts                        # hmacIp(), visitorHash()
backend/src/lib/rateLimit.ts                     # (modified) subject-keyed buckets
backend/src/lib/auth/{oauth.ts,session.ts,identity.ts,cookies.ts}
backend/src/middleware/{requireAuth.ts,requireAdmin.ts,csrf.ts,orgContext.ts,requireConsent.ts}
backend/src/routes/{me.ts,account.ts,admin.ts,legal.ts,reports.ts,media.ts}
backend/src/lib/links/{password.ts,csv.ts,bots.ts}
backend/src/lib/emails/orgInviteEmail.ts
backend/src/test/createTestApp.ts
shared/{slugRules.ts,apcIdentity.ts,formsCatalog.ts,urlSafety.ts}
src/lib/api.ts
src/stores/session.ts
src/lib/tix/selection.ts
src/legal/{privacy.ts,terms.ts,acceptable-use.ts,types.ts}
src/views/{AccountView.vue,InvitesView.vue,UnlockView.vue,ExpiredView.vue,ReportView.vue,LegalView.vue,ConsentView.vue}
src/views/admin/{AdminLayout.vue,AdminUsersView.vue,AdminLinksView.vue,AdminReportsView.vue,AdminAuditView.vue}
src/components/links/{LinkList.vue,LinkRow.vue,LinkFilters.vue,LinkEditorPanel.vue,LinkAdvancedFields.vue,QrDesigner.vue}
src/composables/{useLinks.ts,useFocusTrap.ts,useDocxGenerator.ts}
src/components/{PageShell.vue,LegalLayout.vue}
AGENTS.md, CLAUDE.md, docs/operations.md, public/robots.txt, public/manifest.webmanifest
eslint.config.js, .github/workflows/ci.yml
```

---

# WS0: Hotfix (ship first, own PR, deploy immediately)

### Task 0.1: Stop accepting pass tokens as sessions (F-SEC-1)

**Files:**
- Modify: `backend/src/lib/db.ts` (`getUser`), `backend/src/routes/events.ts:965-971` (pass signing), `backend/src/lib/passes/context.ts:49` (pass verify), `backend/src/lib/env.ts`, `backend/.dev.vars.example`, `scripts/lib/envFile.mjs` + `scripts/setup.mjs` (generate `PASS_TOKEN_SECRET`)
- Test: `backend/src/middleware/requireAuth.test.ts`, `backend/src/lib/passes/context.test.ts` (new)

**Interfaces:**
- Produces: env `PASS_TOKEN_SECRET` (required); `signPassToken(env, { attendeeId, eventId, slug }): Promise<string>` and `verifyPassToken(env, token, slug)` both use `PASS_TOKEN_SECRET`.

- [x] **Step 1: Write failing tests.** `requireAuth.test.ts`: `it('rejects a token whose payload has typ')`: a JWT `{sub,email,exp,typ:'pass'}` signed with `JWT_SECRET` → 401. `it('rejects a token without email')` → 401. `context.test.ts`: `it('rejects a pass token signed with JWT_SECRET')`, `it('accepts a pass token signed with PASS_TOKEN_SECRET for the matching slug')`, `it('rejects a pass token for another slug')`.
- [x] **Step 2: Run** `npx vitest run backend/src/middleware/requireAuth.test.ts backend/src/lib/passes/context.test.ts`. Expected: the new cases FAIL.
- [x] **Step 3: Implement.** In `getUser`, return `null` when `payload.typ !== undefined` or `typeof payload.email !== 'string'`. Sign and verify pass tokens with `PASS_TOKEN_SECRET`. Add `PASS_TOKEN_SECRET` to required env (doctor, `.dev.vars.example`, setup seeding).
- [x] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [x] **Step 5: Commit**

```
fix(auth): reject wallet pass tokens as session tokens

- refuse JWTs carrying `typ` or lacking `email` in `getUser`
- sign and verify pass tokens with a separate `PASS_TOKEN_SECRET`
- add the secret to doctor, setup, and `.dev.vars.example`
- cover pass-as-session and cross-slug pass tokens with Vitest
```

### Task 0.2: Put form templates behind the org gate (F-FORM-1)

**Files:**
- Modify: `backend/wrangler.jsonc` (`assets.run_worker_first: true`), `backend/src/index.ts` (unknown non-API paths → 404 JSON, never fall through to raw assets)
- Test: `backend/src/routes/forms.test.ts` (new)

- [x] **Step 1: Write failing test** `it('does not serve /forms/templates/* without the org gate')`: `app.request('/forms/templates/waiver_form.docx')` → status 404; `it('serves allowlisted templates only through /api/forms/templates/:file for activated members')` (mock `isOrgFeature` pass) → reads from `c.env.ASSETS.fetch` stub.
- [x] **Step 2: Run** `npx vitest run backend/src/routes/forms.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement.** Set `"run_worker_first": true` under `assets`; add `app.all('*', c => c.json({ error: { code: 'not_found', message: 'Not found' } }, 404))` after routes so the Worker answers non-API paths.
- [ ] **Step 4: Verify after deploy (owner):** `curl -s -o /dev/null -w "%{http_code}" https://api.eypi.cc/forms/templates/waiver_form.docx`. Expected: `404`.
- [x] **Step 5: Commit**

```
fix(forms): stop serving templates around the org gate

- run the backend Worker before static assets so `isOrgFeature` always applies
- answer unknown non-API paths with a 404 JSON body
- cover direct template URLs and gated template reads with Vitest
```

**WS0 release:** owner sets `PASS_TOKEN_SECRET` (`npx wrangler secret put PASS_TOKEN_SECRET` in `backend/`), runs `npm run deploy --prefix backend`, then runs the Step 4 curl.

---

# WS1: Foundations

### Task 1.1: Versioned migrations and the baseline (F-DB-1, F-DB-11)

**Files:**
- Create: `backend/migrations/0001_baseline.sql` (DDL copied from `docs/db/schema-baseline.md`, including the trigger), `backend/migrations/0002_hygiene.sql`, `backend/scripts/migrate.mjs`, `backend/scripts/migrate.test.mjs`
- Delete: `backend/run-migration.mjs`
- Modify: `.gitignore` (add `!backend/migrations/*.sql` after `*.sql`), `backend/package.json` (`"migrate": "node scripts/migrate.mjs"`), `vitest.config.ts` (include `backend/scripts/**/*.test.mjs`)

**Interfaces:**
- Produces: `npm run migrate --prefix backend -- [--status|--dry-run|--yes|--baseline|--allow-destructive]`; exported `planMigrations(files: {name,sql}[], applied: {version,checksum}[]) → { pending, mismatched }`, `splitStatements(sql) → string[]`, `isDestructive(stmt) → boolean`; ledger table `schema_migrations(version TEXT PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`.

- [x] **Step 1: Write failing tests** in `migrate.test.mjs`: `planMigrations` returns pending files in numeric order; reports a checksum mismatch for an applied file whose SQL changed; `isDestructive('DROP TABLE x')` true, `isDestructive('DELETE FROM x')` true, `isDestructive('DELETE FROM x WHERE id=1')` false; `splitStatements` keeps a `CREATE TRIGGER … BEGIN …; END;` as one statement.
- [x] **Step 2: Run** `npx vitest run backend/scripts/migrate.test.mjs`. Expected: FAIL.
- [x] **Step 3: Implement `migrate.mjs`.** Reads `backend/.dev.vars` for `TURSO_*`; prints DB host + pending list; without `--yes` it only prints; each file runs in one `client.batch(stmts, 'write')` plus its ledger insert; refuses destructive statements unless `--allow-destructive`; `--baseline` records `0001` without executing.
- [x] **Step 4: Write `0002_hygiene.sql`.** `DROP TABLE IF EXISTS` for the 9 `board_*` tables; `CREATE INDEX IF NOT EXISTS` for: `links(user_id, created_at DESC)`, `analytics(link_id, created_at)`, `org_members(user_id)`, `org_members(email)`, `events(org_id)`, `dp_campaigns(org_id)`, `dp_frames(campaign_id, position)`, `check_ins(attendee_id, actioned_at)`.
- [ ] **Step 5: Run** `npm test`. Expected: PASS. Then (owner-approved, read-write token) `npm run migrate --prefix backend -- --baseline --yes` and `npm run migrate --prefix backend -- --yes --allow-destructive` (0002 drops empty tables). Expected `--status`: 0001, 0002 applied.
- [x] **Step 6: Commit**

```
feat(db): add versioned migrations with a ledger and baseline

- add `migrate.mjs` with status, dry-run, baseline, checksum, and destructive guards
- commit `0001_baseline.sql` from the live schema and `0002_hygiene.sql`
- drop unused `board_*` tables and add the missing indexes
- track `backend/migrations/*.sql` despite the global `*.sql` ignore
- cover planning, statement splitting, and destructive detection with Vitest
```

### Task 1.2: Error contract, logging, health, and the route test harness (F-PLAT-1, F-DB-7, F-DB-10)

**Files:**
- Create: `backend/src/lib/errors.ts`, `backend/src/lib/reportError.ts`, `backend/src/test/createTestApp.ts`, `backend/src/lib/errors.test.ts`, `backend/src/routes/health.test.ts`
- Modify: `backend/src/index.ts` (`app.onError`, `app.notFound`, health DB ping), `backend/src/lib/db.ts` (`db(c)` memoized per request on `c.var.db`), `backend/wrangler.jsonc` (`"observability": { "enabled": true }`), every route file's inline `createClient` → `db(c)`

**Interfaces:**
- Produces: `class ApiError extends Error { constructor(status: number, code: string, message: string, fields?: Record<string,string>) }`; helpers `badRequest(code,msg,fields?)`, `unauthorized()`, `forbidden(code,msg)`, `notFound(msg?)`, `conflict(code,msg)`, `tooMany(msg?)`; `onError(err, c)` that returns the Global Constraints body; `reportError(c, err, extra?)` writes one `console.error(JSON.stringify({level:'error',route,code,message,requestId}))` with no emails, tokens or IPs; `db(c): Client`; `createTestApp(opts?: { user?: {id,email,name,role}, seed?: (client) => Promise<void> }) → Promise<{ app, client, request(path, init?) }>`, an in-memory libSQL with every migration in `backend/migrations` applied, mounting the real `index.ts` app with bindings stubbed (KV = in-memory Map fake, R2 = Map fake).

- [x] **Step 1: Write failing tests.** `errors.test.ts`: a thrown `conflict('slug_taken','That slug is taken.')` returns 409 `{error:{code:'slug_taken',message:'That slug is taken.'}}`; an unknown thrown Error returns 500 `{error:{code:'internal',message:'Something went wrong.'}}`. `health.test.ts`: `GET /api/health` → 200 `{ ok: true, db: true }` using `createTestApp()`.
- [x] **Step 2: Run.** Expected: FAIL.
- [x] **Step 3: Implement** the files above. Replace inline `createClient` calls in `auth.ts` and `links.ts` with `db(c)`.
- [x] **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [x] **Step 5: Commit** `feat(platform): add API error contract, JSON logging, and route test harness` (bullets: errors module, onError/notFound, health DB ping, observability on, `createTestApp` on in-memory libSQL, tests).

### Task 1.3: Org context middleware (F-ORG-4)

**Files:**
- Create: `backend/src/middleware/orgContext.ts`, `backend/src/middleware/orgContext.test.ts`
- Modify: `backend/src/lib/db.ts` (`getUserOrgId`: no silent fallback; `ORDER BY o.name`), `backend/src/middleware/orgGuard.ts` (use orgContext; replace placeholder `action_url` with `/invites`), `backend/src/routes/{events,dp,forms}.ts` (read `c.var.orgId`), `backend/src/routes/orgs.ts:295-309` (`ORDER BY name`)

**Interfaces:**
- Consumes: `c.var.user` (from `requireAuth`; until WS2 it is `{ id: userId, email: userEmail }`).
- Produces: `orgContext` sets `c.var.orgId: string`; responds 403 `org_not_accessible` when `X-Active-Org-Id` names an org the user can't access; 403 `no_org` when the user has none.

- [x] **Step 1: Failing tests** (`createTestApp` seeds user U in orgs A and B): header `B` → `orgId` B; header `C` (not a member) → 403 `org_not_accessible`; no header → first org by name; user with zero orgs → 403 `no_org`; pending (not activated) membership doesn't count.
- [x] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`. Expected: PASS.
- [x] **Step 5: Commit** `fix(orgs): reject inaccessible active org headers instead of falling back`.

### Task 1.4: Frontend API client, session store shell, and error recovery (F-PLAT-2, F-PLAT-3)

**Files:**
- Create: `src/lib/api.ts`, `src/lib/api.test.ts`, `src/stores/session.ts`, `src/stores/session.test.ts`
- Modify: `src/main.ts` (`app.config.errorHandler` → `reportClientError` + toast), `src/router/index.ts` (`router.onError` chunk reload), every view and component that calls `fetch(`; migrate all 75 call sites to `api`
- Modify: `vitest.config.ts` (`environmentMatchGlobs: [['src/**/*.test.ts','happy-dom']]`), add dev deps `happy-dom`, `@vue/test-utils`

**Interfaces:**
- Produces:
  - `api.get<T>(path, opts?)`, `api.post<T>(path, body?, opts?)`, `api.patch<T>`, `api.put<T>`, `api.del<T>`, `api.raw(path, init) → Response`, all with `credentials: 'include'`, JSON, `X-Active-Org-Id` from `localStorage.active_org_id`, and (until WS2 Task 2.5) `Authorization: Bearer` from `localStorage.eypi_token`
  - `class ApiError { status; code; message; fields? }`; non-JSON error bodies become `ApiError(status,'http_error','Something went wrong.')`
  - 401 → `session.reset()` + `router.push({ name: 'login', query: { returnTo } })`
  - `useSession()` returns `{ user: Ref<SessionUser|null>, status: Ref<'idle'|'loading'|'ready'>, load(): Promise<void>, reset(): void, logout(): Promise<void> }`; `SessionUser = { id, email, name, role: 'user'|'admin' }`
  - `isChunkLoadError(err) → boolean`

- [x] **Step 1: Failing tests.** `api.test.ts`: sends `credentials:'include'` and the active org header; parses `{error:{code,message,fields}}` into `ApiError`; an HTML 502 body becomes `ApiError(502,'http_error',…)`; a 401 calls `session.reset` once and navigates to login with `returnTo`. `session.test.ts`: `load()` dedupes concurrent calls. `router` test: `isChunkLoadError(new TypeError('Failed to fetch dynamically imported module'))` true; on chunk error the router reloads once per target path (guard key `eypi_chunk_reload:<path>` in `sessionStorage`).
- [x] **Step 2: Run.** Expected: FAIL. **Step 3: Implement**, then migrate call sites view by view (no behavior change). `grep -rn "fetch(" src --include=*.vue --include=*.ts` must only show `src/lib/api.ts` afterwards.
- [x] **Step 4: Run** `npm test && npm run typecheck && npm run build`. Expected: PASS.
- [x] **Step 5: Commit** `refactor(platform): route all SPA requests through one API client` (bullets: api client, ApiError, 401 handling, chunk-reload recovery, global error handler, call-site migration, tests).

### Task 1.5: CI, lint, and dependency upgrades (F-OPS-1, F-OPS-2, F-DEP-1..3)

**Files:**
- Create: `eslint.config.js`, `.github/workflows/ci.yml`
- Delete: `.github/workflows/test.yml`
- Modify: `package.json` (`"lint": "eslint ."`, deploy script runs `vue-tsc -b`), `backend/package.json` (`"predeploy": "node ../scripts/release-check.mjs"`), `tsconfig.json` (reference `tsconfig.node.json`), both lockfiles

- [x] **Step 1:** Add ESLint 9 flat config: `typescript-eslint` recommended, `eslint-plugin-vue` `flat/recommended`, `eslint-plugin-vuejs-accessibility` `flat/recommended`; ignore `dist`, `backend/worker-configuration.d.ts`. Fix or locally disable (with reason) every error; warnings are allowed.
- [x] **Step 2:** `npm audit fix` in root and `backend/`; upgrade `hono` to ≥ 4.13.14, `dompurify` latest, `wrangler` and `@cloudflare/vite-plugin` latest; remove `@tursodatabase/database`. Leave `xlsx` for WS5 Task 5.5 and `node-forge` for Task 5.6.
- [x] **Step 3:** `ci.yml` on push and pull_request: Node 22; `npm ci`; `npm ci --prefix backend`; `npm run lint`; `npm run typecheck`; `npm test`; `npm run build`; `npx wrangler deploy --dry-run --config dist/eypicc_frontend/wrangler.json`; `npx wrangler deploy --dry-run --config backend/wrangler.jsonc`; `npm audit --omit=dev --audit-level=high` (root and backend; temporarily allow the documented `xlsx`/`node-forge` advisories via `--omit` notes until WS5).
- [x] **Step 4: Run** the same commands locally. Expected: all exit 0.
- [x] **Step 5: Commit** `ci: run lint, typecheck, tests, build, and audit on Node 22` (separate commit `chore(deps): upgrade hono, dompurify, and wrangler and fix audit findings`).

---

# WS2: Microsoft sign-in and sessions (§3)

**Owner prerequisites (before Task 2.6 deploy):** create the Entra app per §3.1; put `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_ALLOWED_TENANT_IDS=aeb745e6-8166-4f8f-9233-179e8109c49e`, `AUTH_COOKIE_SECRET`, `IP_HASH_SECRET`, `FRONTEND_ORIGIN`, `ENVIRONMENT` in `backend/.dev.vars` and as Worker secrets/vars.

### Task 2.1: Auth migrations and identity helpers

**Files:**
- Create: `backend/migrations/0003_auth_additive.sql`, `backend/migrations/0004_auth_cleanup.sql`, `shared/apcIdentity.ts`, `shared/apcIdentity.test.ts`, `backend/src/lib/ipHash.ts`, `backend/src/lib/ipHash.test.ts`

**Interfaces:**
- Produces:
  - `APC_EMAIL_DOMAINS = ['apc.edu.ph','student.apc.edu.ph']`; `normalizeEmail(s) → string` (trim + lowercase); `isApcEmail(email) → boolean` (exact domain match, rejects `x@evil.apc.edu.ph.com` and `x@sub.apc.edu.ph`)
  - `hmacIp(secret, ip) → Promise<string>` (hex, 32 chars)
  - `visitorHash(secret, dayYYYYMMDD, ip, ua) → Promise<string>` (16 hex)
  - Schema exactly as §3.8: 0003 adds the identities and sessions tables, `role`/`last_login_at`/`disabled_at`, and seeds admin; 0004 nulls `org_members.user_id` for unverified users, deletes unverified users, and drops `password_hash`, `verification_token`, `is_verified` via `ALTER TABLE … DROP COLUMN`.
- [x] **Step 1: Failing tests:** `apcIdentity` domain cases above; `ipHash` deterministic and secret-dependent. Migration test via `createTestApp`: after all migrations, `PRAGMA table_info(users)` has no `password_hash` and has `role`; seeding a user plus a link, then applying 0004, keeps the link (`SELECT COUNT(*) FROM links` unchanged).
- [x] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`. Expected: PASS.
- [x] **Step 5: Commit** `feat(auth): add identity and session schema and APC identity rules`.

### Task 2.2: OAuth start and callback with tenant pinning

**Files:**
- Create: `backend/src/lib/auth/oauth.ts`, `backend/src/lib/auth/cookies.ts`, `backend/src/lib/auth/oauth.test.ts`, `backend/src/routes/authMicrosoft.ts`, `backend/src/routes/authMicrosoft.test.ts`

**Interfaces:**
- Produces:
  - `buildAuthorizeUrl(env, { state, nonce, codeChallenge }) → string` (authority `https://login.microsoftonline.com/organizations/oauth2/v2.0`, scope `openid profile email`, `prompt=select_account`, `domain_hint=apc.edu.ph`, `response_mode=query`)
  - `verifyIdToken(env, idToken, { nonce }, jwks?) → Promise<{ tid, oid, email, name }>`, which throws `AuthError('tenant'|'domain'|'token')`
  - `signOAuthCookie(secret, payload) / readOAuthCookie(secret, value)` (HMAC-SHA256, 10-min expiry, payload `{ state, nonce, verifier, returnTo }`)
  - `safeReturnTo(raw) → string` (must start with `/`, not `//`, no `\`; default `/dashboard`)
  - Routes `GET /api/auth/microsoft/start`, `GET /api/auth/microsoft/callback`; errors redirect to `${FRONTEND_ORIGIN}/login?error=<tenant|domain|state|cancelled|disabled|server>`
- [x] **Step 1: Failing tests** (sign test id_tokens with a local JWK set passed as `jwks`):
  - `rejects a token from another tenant even with an @apc.edu.ph email` → `AuthError('tenant')`
  - `rejects an issuer that does not match the tid`
  - `rejects a wrong aud, wrong nonce, expired token`
  - `rejects APC tenant users whose email is not an APC domain` → `'domain'`
  - `prefers email claim, falls back to preferred_username, lowercases`
  - `safeReturnTo('//evil.com')` → `/dashboard`
  - callback with mismatched state → 302 `…/login?error=state`
  - callback `?error=access_denied` → `…?error=cancelled`
- [x] **Step 2: Run.** Expected: FAIL. **Step 3: Implement** with `jose` (`createRemoteJWKSet('https://login.microsoftonline.com/common/discovery/v2.0/keys')` in prod) and PKCE S256 via WebCrypto. Rate limit `start` and `callback` 30/10 min/IP. **Step 4: Run.** Expected: PASS.
- [x] **Step 5: Commit** `feat(auth): add Microsoft sign-in pinned to the APC tenant`.

### Task 2.3: Identity resolution, sessions, and middleware

**Files:**
- Create: `backend/src/lib/auth/identity.ts`, `backend/src/lib/auth/session.ts`, `backend/src/middleware/csrf.ts`, `backend/src/middleware/requireAdmin.ts`, `backend/src/routes/me.ts`, tests for each
- Modify: `backend/src/middleware/requireAuth.ts` (cookie session; sets `c.var.user`), `backend/src/index.ts` (CORS allowlist by `ENVIRONMENT`; mount csrf, me, authMicrosoft; allow header `Content-Type, X-Active-Org-Id` only), `backend/src/routes/authMicrosoft.ts` (callback uses identity + session)

**Interfaces:**
- Produces:
  - `resolveUser(db, { tid, oid, email, name }) → Promise<{ userId, created: boolean }>` (§3.3 order; updates email/name on change; sets `last_login_at`)
  - `createSession(db, env, userId, req) → Promise<{ token, cookie: string }>`
  - `readSession(db, token) → Promise<SessionUser|null>` (rejects expired or disabled; slides expiry at most hourly)
  - `destroySession(db, token)`, `destroyAllSessions(db, userId)`
  - `sessionCookieName(env)`
  - `c.var.user: { id, email, name, role }`
  - `GET /api/me` → `{ user, pendingInviteCount, needsConsent: [], orgs }` (`needsConsent` filled by WS8)
  - `POST /api/auth/logout`
  - CSRF: non-safe methods need `Origin` ∈ allowlist else 403 `bad_origin`
- [x] **Step 1: Failing tests:**
  - legacy user `juan@student.apc.edu.ph` with a link: `resolveUser` with a new `oid` returns the **same** `userId`, and an identity row is inserted
  - a second sign-in with the same `oid` but a changed email updates `users.email`
  - a new email creates a user with `role='user'`
  - a disabled user's session is rejected (401)
  - an expired session → 401
  - `DB throws` → 503 `session_unavailable` (not 401)
  - POST without Origin → 403 `bad_origin`
  - POST from `https://eypi.cc` → passes
  - `GET /api/me` anonymous → 401
  - `requireAdmin` for a user → 403 `admin_only`
- [x] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run.** Expected: PASS.
- [x] **Step 5: Commit** `feat(auth): add cookie sessions, CSRF origin check, and /api/me`.

### Task 2.4: Move every route onto `c.var.user` and roles

**Files:**
- Modify: `backend/src/routes/{links,orgs,events,dp,forms,stats}.ts`, `backend/src/lib/onboarding.ts`, `backend/src/middleware/orgGuard.ts`
- Delete: `shared/admin.ts`, `src/config/admin.ts`, `backend/src/routes/auth.ts` (password routes), `backend/src/lib/emails/verifyAccount*`, `backend/src/routes/orgMembers.ts` (F-ORG-11)
- Modify: `backend/package.json` (remove `bcryptjs`, `@types/bcryptjs`), `backend/src/lib/env.ts` (remove `JWT_SECRET`, `FRONTEND_URL`; add the §3.10 keys), `scripts/doctor.mjs`, `scripts/setup.mjs`, `backend/.dev.vars.example`

- [x] **Step 1: Failing tests:** route authz matrix in `backend/src/routes/authz.test.ts`. For one representative route per router (links create, org update, event create, dp create, forms catalog, admin org create): anonymous → 401, user → expected status, admin-only route as user → 403, as admin → 2xx. Super admin checks use `role`.
- [x] **Step 2: Run.** Expected: FAIL. **Step 3: Implement**; `grep -rn "SUPER_ADMIN_EMAIL\|getUser(\|JWT_SECRET" backend src shared` returns nothing (except pass tokens using `PASS_TOKEN_SECRET`). **Step 4: Run** `npm test && npm run typecheck`. Expected: PASS.
- [x] **Step 5: Commit** `feat(auth)!: replace password login with Microsoft sessions on every route` with a `BREAKING CHANGE:` paragraph: password endpoints and `JWT_SECRET` removed.

### Task 2.5: Frontend sign-in, session store, and route guards

**Files:**
- Modify: `src/stores/session.ts` (calls `/api/me`), `src/lib/api.ts` (drop the bearer adapter), `src/views/LoginView.vue` (single Microsoft button + `?error=` copy), `src/router/index.ts` (guards await `session.load()`; `requiresAdmin` uses `role`; remove `/verify`, `/reset-password`), `src/components/TheHeader.vue` (user menu from session; logout calls `session.logout()`), `src/composables/useAuth.ts` (delete; replace imports with `useSession`), `src/composables/useOrgMembership.ts` (clear cache on logout)
- Delete: `src/views/VerifyView.vue`, `src/views/ResetPasswordView.vue`, password section of `src/views/SettingsView.vue`
- Modify: `worker/index.ts`: `/verify` and `/reset-password` → 301 `/login`
- Test: `src/stores/session.test.ts`, `src/views/LoginView.test.ts`

**Copy (exact):** title "Sign in to eypi.cc"; button "Sign in with Microsoft"; helper "Use your APC Microsoft 365 account (@apc.edu.ph or @student.apc.edu.ph)."; errors: `tenant`/`domain` → "Only APC Microsoft 365 accounts can sign in.", `cancelled` → "Sign-in was cancelled.", `state` → "Your sign-in link expired. Try again.", `disabled` → "This account is disabled. Contact the eypi.cc admin.", `server` → "Something went wrong signing you in. Try again."

- [x] **Step 1: Failing tests:** LoginView renders the button whose `href` is `${API_BASE_URL}/api/auth/microsoft/start?returnTo=<encoded>`; each `?error=` shows its copy; the guard sends anonymous users to `/login?returnTo=/links`; `localStorage.getItem('eypi_token')` is never read (`grep` in test).
- [x] **Step 2: Run.** Expected: FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npm run build`. Expected: PASS.
- [x] **Step 5: Commit** `feat(auth): add Sign in with Microsoft to the SPA and remove password views`.

### Task 2.6: Cutover runbook and rehearsal

**Files:** Modify `docs/RELEASE.md` (cutover section), `README.md` (env table)

- [ ] **Step 1:** Owner creates a branch DB: `turso db create eypi-rehearsal --from-db <prod>`; point `.dev.vars` at it; run `npm run migrate --prefix backend -- --yes` (0003) and, with `--allow-destructive`, 0004; run `npm run dev:local` and sign in with Microsoft; confirm links and orgs are intact.
- [ ] **Step 2: Production (single window, §12.4):** apply 0003 → deploy backend + frontend → owner signs in and sees the Admin nav → apply 0004 → `wrangler secret delete JWT_SECRET`.
- [ ] **Step 3: Verify:** `curl -s https://api.eypi.cc/api/me -o /dev/null -w "%{http_code}"` → `401`; signing in works for an `@apc.edu.ph` professor account and a student account.
- [ ] **Step 4: Commit** `docs(auth): add the Microsoft cutover runbook`.

---

# WS3: Orgs and invites (§5). Needs WS2

### Task 3.1: Invite API completion

**Files:** Create `backend/migrations/0005_invites.sql`, `backend/src/lib/emails/orgInviteEmail.ts` (+ test). Modify `backend/src/routes/orgs.ts` (invites, accept, decline, invite, resend, remove).

**Interfaces:**
- Produces:
  - `GET /api/orgs/invites` → `[{ orgId, orgName, logoUrl, invitedByName, invitedAt }]`
  - `POST /api/orgs/invites/:orgId/accept` → `{ orgId }`
  - `POST /api/orgs/invites/:orgId/decline` sets `declined_at`
  - `POST /api/orgs/:id/members` → 201 `{ emailSent: boolean }` | 409 `already_member` | 409 `already_invited` | 429 `recently_declined`
  - `POST /api/orgs/:id/members/:email/resend` (1 per 24h)
  - `renderOrgInviteEmail({ orgName, inviterName, inviteUrl }) → { subject, html, text }` (subject `You're invited to join ${orgName} on eypi.cc`)
- [x] **Step 1: Failing tests:** accept sets `activated_at` for the session email (case-insensitive); decline keeps the row with `declined_at`; re-invite within 7 days of decline → 429; duplicate pending → 409 `already_invited`; email HTML escapes `<script>` in org name; Resend failure still returns 201 `{emailSent:false}`; declined invites don't appear in the list.
- [x] **Step 2–4:** Run (FAIL) → implement → run (PASS).
- [x] **Step 5: Commit** `feat(orgs): complete invite API with decline state and invite emails`.

### Task 3.2: Invite inbox UI and lockout fix (F-ORG-1, F-ORG-2)

**Files:** Create `src/views/InvitesView.vue` (+ test), `src/components/orgs/InviteCard.vue`. Modify `src/components/OrgLockout.vue` (inline invites; drop the `/orgs/modify` loop), `src/components/NavSidebar.vue` + `TheHeader.vue` (badge from `/api/me.pendingInviteCount`), `src/views/DashboardView.vue` (banner), `src/router/index.ts` (route `/invites`, `requiresAuth`).

**Copy:** card meta "Invited by {name} · {relative time}"; buttons "Accept" / "Decline"; decline confirm title "Decline invite to {org}?"; empty state "No pending invites."; banner "You have {n} pending org invite(s)." with link "Review invites".

- [x] **Step 1: Failing tests:** list renders cards; Accept calls the API then `clearOrgMembershipCache()`, `fetchOrgs()`, sets `active_org_id`, routes to `/orgs/:slug`; Decline asks to confirm; the lockout shows invites when present.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(orgs): restore invite accept and decline with an inbox and badge`.

### Task 3.3: Org management fixes (F-ORG-3, 5, 6, 7, 13, 14)

**Files:** Modify `src/views/settings/OrgManagementEditView.vue` (remove the transfer form), `src/views/orgs/OrgModifyView.vue` (leave refresh, members pick-list, empty and error states, "Cancel invite"/"Resend" for pending, 409 messages), `backend/src/routes/orgs.ts` (slug rename = insert new org → repoint children → delete old, in one batch; lowercase session email for leave).

- [x] **Step 1: Failing tests:** `PATCH /api/orgs/:id` with a new slug on an org that has members, events and campaigns → 200 and all children point at the new id (`createTestApp` has FKs on); leave clears the active org and refetches (component test).
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `fix(orgs): make slug rename FK-safe and refresh state after leaving`.

---

# WS4: Links (§6). Top priority after WS1

### Task 4.1: Make browsers hit the edge redirect (F-LINK-19, F-LINK-3)

**Files:** Modify `wrangler.jsonc` (`assets.run_worker_first: true`), `worker/index.ts` (serve assets via `env.ASSETS.fetch` for everything the worker doesn't redirect; 302 + `Cache-Control: private, max-age=0`; HEAD → 302 without logging). Test: `worker/index.test.ts` (new; add `worker/**/*.test.ts` to vitest include).

- [x] **Step 1: Failing tests:** a navigation request (`Sec-Fetch-Mode: navigate`) for a KV slug → 302 with the cache header; HEAD → 302 and `logLinkClick` not called; reserved slug → `ASSETS.fetch`; `/assets/x.js` → `ASSETS.fetch`.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Verify after deploy:** `curl -sI -H "Sec-Fetch-Mode: navigate" https://eypi.cc/<real-slug>` shows `302` and `cache-control: private, max-age=0`.
- [x] **Step 6: Commit** `fix(links): serve short-link redirects at the edge with 302`.

### Task 4.2: Links schema, KV v2 codec, and click logging (F-LINK-7, F-LINK-8)

**Files:** Create `backend/migrations/0006_links.sql` (§6.1), `backend/src/lib/links/bots.ts` (+ test). Modify `shared/linksKv.ts` (+ test), `shared/linkAnalytics.ts` (+ test), `worker/index.ts`.

**Interfaces:**
- Produces:
  - `encodeLinkKv({ id, url, exp?, pw? }) → string` (v2)
  - `decodeLinkKv(raw) → { id, url, exp?: number, pw?: boolean } | null` (accepts v1 `{id,url}`)
  - `isBot(userAgent) → boolean` (case-insensitive list: `bot`, `crawler`, `spider`, `facebookexternalhit`, `Discordbot`, `WhatsApp`, `Slackbot`, `Twitterbot`, `TelegramBot`, `LinkedInBot`, `SkypeUriPreview`, `Googlebot`, `bingbot`, `preview`)
  - `logLinkClick(client, { linkId, os, country, referrer, source, visitorHash })` runs one batch: insert analytics + `UPDATE links SET clicks = clicks + 1 WHERE id = ?`
  - Worker flow per §6.2 (`exp` past → 302 `/expired`; `pw` → 302 `/unlock/:slug`; strip `src=qr` → `source='qr'`)
- [x] **Step 1: Failing tests:** v1 value decodes; v2 roundtrip; `isBot('Mozilla/5.0 (compatible; Discordbot/2.0)')` true and a normal Chrome UA false; `logLinkClick` increments by id even when the slug changed; worker: expired → `/expired`, protected → `/unlock/abc`, `?src=qr` stripped from the destination, bot UA not logged.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(links): add v2 edge contract with expiry, protection, and bot-free counting`.

### Task 4.3: Links API rewrite (F-LINK-1, 2, 4, 5, 9, 10, 11, 13)

**Files:** Create `shared/slugRules.ts` (+ test), `shared/urlSafety.ts` (+ test; moves `validateDestinationUrl` logic here so client and server share it), `backend/src/lib/links/password.ts` (+ test). Modify `backend/src/routes/links.ts` (+ new `links.test.ts`), `backend/src/lib/rateLimit.ts` (+ test), `src/views/RedirectView.vue` (call `/api/links/resolve/:slug?r=`; handle 410 → `/expired`, `protected` → `/unlock/:slug`).

**Interfaces:**
- Produces:
  - `SLUG_RE`, `normalizeSlugInput(s)`, `validateSlug(s) → 'ok'|'invalid'|'reserved'`, `generateSlug() → string` (7 chars)
  - `validateDestination(url, { selfHosts: ['eypi.cc'] }) → { ok: true, url } | { ok: false, code: 'invalid_url'|'blocked_host'|'self_link'|'shortener'|'userinfo'|'private_address' }`
  - `hashLinkPassword(pw) → Promise<string>`, `verifyLinkPassword(pw, stored) → Promise<boolean>` (constant-time)
  - `checkRateLimit(kv, { bucket, subject, limit, windowSec }) → { ok, retryAfter }`, key `rl:${bucket}:${subject}`
  - Endpoints:
    - `GET /api/links?cursor&q&sort=new|old|clicks&status=all|active|expired|disabled|protected` → `{ items: LinkListItem[], nextCursor }` (no logo bytes; `hasLogo`)
    - `POST /api/links` → 201 `LinkDetail`
    - `GET /api/links/:id`, `PATCH /api/links/:id`, `DELETE /api/links/:id`, `POST /api/links/bulk { ids, action: 'delete'|'disable'|'enable' }`
    - `GET /api/links/slug-available?slug=` → `{ available, reason? }`
    - `POST /api/links/:slug/unlock { password }` → `{ url }`
    - `GET /api/links/resolve/:slug?r=` (SPA fallback; rate limited)
  - `LinkListItem = { id, slug, url, clicks, createdAt, expiresAt, disabledAt, disabledReason, protected, hasLogo }`; `LinkDetail = LinkListItem & { qrConfig }`
- [x] **Step 1: Failing tests** (`createTestApp`):
  - DB error → 500 `internal` (not 401)
  - duplicate custom slug → 409 `slug_taken`
  - slug `a/b` → 422 `fields.slug`
  - `https://apc.edu.ph@evil.tld` → 422 `userinfo`
  - `https://eypi.cc/x` → 422 `self_link`
  - 501st link → 429 `quota_exceeded`
  - 31st create in an hour → 429
  - list omits `qr_config` logo bytes and pages 25 at a time with a stable cursor
  - `GET /api/links/:id` of another user → 404
  - unlock wrong password → 401 `wrong_password` and the 11th try in 15 min → 429
  - unlock right password → `{url}` and one analytics row
  - expired link resolve → 410 `link_expired`
  - disabling a link removes the KV key; enabling restores it
  - `/links?url=` no longer auto-creates (front-end test in 4.5)
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(links): rebuild the links API with paging, quotas, protection, and expiry` (+ separate `fix(links): stop logging users out on database errors` if split).

### Task 4.4: Analytics and CSV export (F-LINK-6, F-LINK-14)

**Files:** Create `backend/src/lib/links/csv.ts` (+ test), `backend/src/lib/manilaTime.ts` (+ test). Modify `backend/src/routes/links.ts`.

**Interfaces:**
- Produces:
  - `GET /api/links/:id/analytics?range=7|30|90` → `{ total, unique, qr, direct, timeline: [{ day, clicks }], topReferrers, topCountries, topOs, peakHour }` (top lists `ORDER BY count DESC LIMIT 5`; Manila days)
  - `GET /api/links/export.csv`
  - `GET /api/links/:id/analytics.csv`
  - `toCsv(rows: string[][]) → string` (RFC 4180; prefix `'` to cells starting with `=`, `+`, `-`, `@`)
- [x] **Step 1: Failing tests:** top lists ordered by count; timeline buckets by Manila day (a click at 2026-10-25T17:00Z lands on 2026-10-26); `toCsv([['=1+1','a,b','he said "hi"']])` → `'\'=1+1,"a,b","he said ""hi"""\r\n'`; export headers `slug,short_url,destination,clicks,created_at,expires_at,status`.
- [x] **Step 2–4:** FAIL → implement → PASS.
- [x] **Step 5: Commit** `feat(links): add unique visitors, QR source, ranked analytics, and CSV export`.

### Task 4.5: Links UI rebuild (§6.4, §6.5, F-LINK-12, 13, 17, 18)

**Files:** Create `src/composables/useLinks.ts` (+ test), `src/components/links/{LinkList,LinkRow,LinkFilters,LinkEditorPanel,LinkAdvancedFields,QrDesigner}.vue` (+ tests for editor and advanced fields). Modify `src/views/links/LinksView.vue` (thin page), `src/components/AnalyticsPanel.vue` (async-loaded, new payload). Delete `src/components/LinkVisualization.vue`.

**Copy:** create button "New link"; slug helper "Optional. Lowercase letters, numbers, and hyphens."; availability "Available" / "Taken" / "Reserved" / "Not allowed"; advanced section "More options" with "Expires", "Password", "UTM tags"; badges "Expired", "Disabled", "Protected", "Disabled by moderator"; bulk "Delete {n} links?"; quota "You've reached 500 links. Delete some to add more."

- [x] **Step 1: Failing tests:** typing a slug debounces 300 ms and shows availability; the UTM builder appends `utm_source` etc. without duplicating existing params; `?url=` prefills but does not create; created link appears via the returned id; the analytics chunk loads only when the panel opens (assert dynamic import).
- [x] **Step 2–4:** FAIL → implement → PASS. `npm run build`: the `LinksView` chunk no longer contains chart.js (check `dist/assets` names).
- [x] **Step 5: Commit** `feat(links): rebuild the links page with filters, bulk actions, and advanced options`.

### Task 4.6: Unlock, expired, and report pages

**Files:** Create `src/views/UnlockView.vue`, `src/views/ExpiredView.vue`, `src/views/ReportView.vue` (+ tests), `backend/src/routes/reports.ts` (+ test). Modify `src/router/index.ts` (routes `/unlock/:slug`, `/expired`, `/report`).

**Interfaces:** `POST /api/reports { slug, reason: 'phishing'|'malware'|'spam'|'inappropriate'|'other', details? }` → 201; 5/hour/IP; unknown slug → 404.

**Copy:** unlock title "This link is password protected", button "Continue"; expired title "This link has expired"; report title "Report a link", success "Thanks. We'll review this link."

- [x] **Step 1–4:** failing tests (wrong password shows the inline error; success calls `location.replace(url)`; report validates reason; 6th report → 429) → implement → PASS.
- [x] **Step 5: Commit** `feat(links): add unlock, expired, and abuse report pages`.

### Task 4.7: Optional Safe Browsing check

**Files:** Modify `shared/urlSafety.ts` (server-only adapter in `backend/src/lib/links/safeBrowsing.ts` + test).

- [x] When `SAFE_BROWSING_API_KEY` is set, `POST https://safebrowsing.googleapis.com/v4/threatMatches:find` on create/edit; a match → 422 `unsafe_destination`; a timeout over 1500 ms or an API error → allow and `reportError` (fail open). Tests stub fetch for match, no match, timeout. Commit `feat(links): check destinations against Google Safe Browsing when configured`.

### Task 4.8: KV reconcile (F-LINK-11)

**Files:** Modify `backend/scripts/backfill-links-kv.mjs` (`--reconcile` deletes KV keys whose slug isn't an enabled, non-expired link; `--dry-run` default).

- [x] Test the pure diff function `diffKv(dbLinks, kvKeys) → { put, delete }`. Commit `feat(links): add a KV reconcile mode to the backfill script`.

### Task 4.9: Reserved slug parity (F-LINK-16, §6.6)

**Files:** Modify `shared/reservedSlugs.ts`, `shared/reservedSlugs.test.ts`.

- [ ] **Step 1:** Read-only production check before adding: `SELECT slug FROM links WHERE slug IN ('admin','account','api','assets','auth','logout','signup','help','about','qr','static','invites','report','unlock','expired','media','p')`. If any rows, stop and tell the owner.
- [x] **Step 2: Failing test** `every top-level route in src/router/index.ts is reserved` (parse `path: '/<seg>'` literals) plus the new entries.
- [x] **Step 3–4:** add entries → PASS. **Commit** `fix(links): reserve suite routes and enforce route parity in tests`.

---

# WS5: Tix (§7)

### Task 5.1: Tix schema and atomic finalize (F-TIX-2, F-DB-2, F-DB-6)

**Files:** Create `backend/migrations/0007_tix.sql`. Modify `backend/src/routes/events.ts` finalize, upload, clusters and raffle to single batches; chunk `IN` lists (≤ 200). Test `backend/src/routes/events.finalize.test.ts`.

- [x] Failing tests: concurrent finalize → exactly one 200, the other 409 `already_finalized`, attendee count = selected rows; a failure mid-batch leaves the event unlocked with zero attendees; a duplicate email in the selection → one attendee. Implement → PASS. Commit `fix(tix): make finalize atomic and idempotent`.

### Task 5.2: Pure selection module and criteria persistence (F-TIX-1, 7, 8)

**Files:** Create `src/lib/tix/selection.ts` (+ test). Modify `src/views/tix/AttendeeSelectionView.vue` (save criteria on leaving the step; hydrate on mount), `backend/src/routes/events.ts` (re-raffle uses the same counting rule).

**Interfaces:** `selectAttendees(rows: Row[], opts: { mapping, clusters: { value, maxCount, filters }[], globalFilters, guaranteed: string[], seed: string }) → { selected: Row[], byCluster: Record<string, number> }` (dedupe by lowercased email before quotas; deterministic for a seed).

- [x] Failing tests: duplicate emails count once; filters exclude ineligible rows; guaranteed rows are kept within quota; same seed → same result; the server re-raffle count excludes removed attendees consistently with GET clusters. Implement → PASS. Commit `fix(tix): persist raffle criteria and extract a tested selection module`.

### Task 5.3: Lookup and pass rate limits, pass data allowlist (F-TIX-3, F-TIX-10, F-TIX-17)

**Files:** Modify `backend/src/routes/events.ts` (lookup key `lookup:${eventId}:${sha256(email)}` 10/15 min plus IP 60/15 min; passes bucket `pass:${attendeeId}` 20/hour; removed attendees get 404; 429 copy "Too many attempts. Wait a few minutes and try again."), `backend/src/lib/passes/context.ts` (only `events.pass_fields` columns; read by `attendees.csv_row_id`), `src/views/tix/EventDetailView.vue` (pass field picker).

- [x] Failing tests: 30 different students from one IP can each look up once; one email hammered → 429 with the distinct copy; pass context includes only allowlisted columns; removed attendee lookup → 404. Implement → PASS. Commit `fix(tix): key lookup limits by event and email and limit pass fields`.

### Task 5.4: Check-in correctness and attendee actions (F-TIX-4, 5, 6, 9, 16, 19)

**Files:** Modify `backend/src/routes/events.ts` (guarded insert; `ORDER BY actioned_at DESC, rowid DESC`; checkout only from `checked_in`; restore action; add-guest uses `requireEventLead`), `src/views/tix/EventDetailView.vue` → split into `src/components/tix/{ScannerPanel,AttendeeTable,ClusterBars,AddGuestPanel}.vue` + `src/composables/{useEventAttendees,useQrScanner}.ts`; per-attendee "Download QR"; "Download all (ZIP)" any time with names `{last}_{first}_{id8}.png`; UTC parsing fix; scanner 5s same-token memory and result-specific feedback.

- [x] Failing tests: two parallel check-ins → one 200, one 409 `already_checked_in`; checkout of a removed attendee → 409; restore returns to `not_checked_in`; ZIP names unique for same-name attendees; `useQrScanner` ignores the same token within 5 s. Implement → PASS. Commit `fix(tix): harden check-in and add per-attendee QR downloads`.

### Task 5.5: Safe CSV and XLSX parsing (F-TIX-11, 12, 13)

**Files:** Remove `xlsx`; add `exceljs` (lazy import) and `papaparse`. Modify `AttendeeSelectionView.vue` (split into step components under `src/components/tix/selection/`), `NewEventView.vue`, `backend/src/routes/events.ts` (5,000-row cap → 422 `too_many_rows`; validate `firstName`).

- [x] Failing tests: a BOM CSV parses headers; quoted commas and newlines parse; a blank header column keeps later columns aligned; `.XLSX` is accepted; 5,001 rows → 422. Implement → PASS; `npm audit` no longer lists `xlsx`. Commit `fix(tix): replace xlsx and harden CSV and spreadsheet parsing`.

### Task 5.6: Remove Apple Wallet; fix Google Wallet (F-TIX-14, F-TIX-18, F-DEP-2)

**Files:** Delete `backend/src/lib/passes/applePass.ts`, the Apple route, `backend/assets/wallet/*` used only by Apple, `backend/scripts/generate-wallet-assets.mjs` if Apple-only; remove `node-forge`, Apple env keys (env.ts, doctor, example, README). Modify `googleWallet.ts` (class upsert via PATCH-or-insert; `validTimeInterval` with `+08:00` start and a 6-hour default end), delete dead `events.ts:56-62` and the post-finalize CSV append, and the hardcoded `isApcAttendee`.

- [x] Failing tests: the class payload is upserted on name change; the interval has an offset and an end. Implement → PASS. Commit `refactor(tix): remove Apple Wallet and keep Google Wallet passes current`.

---

# WS6: R2, Frames, Forms (§8)

**Owner prerequisite:** Cloudflare dashboard → R2 → enable (add a payment method if asked; usage stays in the free tier) → create bucket `eypi-media`.

### Task 6.1: R2 bindings, media route, and upload helper

**Files:** Modify `wrangler.jsonc` and `backend/wrangler.jsonc` (`r2_buckets: [{ binding: 'MEDIA', bucket_name: 'eypi-media' }]`), `worker/index.ts` (`GET /media/<key>` for prefixes `frames/`, `orgs/`, `qr-logos/` only; immutable cache; 404 otherwise). Create `backend/src/lib/media.ts` (+ test), `backend/migrations/0009_media.sql` (`dp_slug_history(old_slug TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES dp_campaigns(id) ON DELETE CASCADE)`).

**Interfaces:** `putImage(env, { prefix, id, bytes, allowed: ('png'|'jpeg'|'webp')[], maxBytes, requireSquare?, minSize? }) → Promise<{ key, width, height }>` (magic-byte sniff, dimension parse, key `${prefix}/${id}-${sha8}.${ext}`); `deleteObject(env, key)`; `mediaUrl(key) → '/media/' + key`.

- [x] Failing tests: an SVG renamed to `.png` → `ApiError(422,'invalid_image')`; a 3.1 MB PNG → `file_too_large`; a non-square frame with `requireSquare` → `not_square`; worker refuses `/media/templates/x.docx` (404). Implement → PASS. Commit `feat(platform): add R2 media storage with validated uploads`.

### Task 6.2: Frames on R2 and public page fixes (F-FRAME-1..10)

**Files:** Modify `backend/src/routes/dp.ts` (store keys; atomic create; conditional add under 10; slug history; download rate limit 1/day/IP/campaign; `Cache-Control: public, max-age=60` on public JSON), `src/views/dp/DpPublicView.vue` (frame-sized canvas; `createImageBitmap` downscale ≤ 2160 px; error toast "We couldn't read that photo. Try a JPG or PNG."; input reset; `navigator.share({files})` with fallback), `src/components/dp/DpFrameUploader.vue` (serial adds; up/down reorder buttons), `src/views/dp/DpEditCampaignView.vue` (`router.replace` on slug change).

- [x] Failing tests: concurrent adds never exceed 10; create failure leaves no campaign; old slug resolves via history; download counter increments once per IP per day. Implement → PASS. Commit `feat(dp): serve frames from R2 and fix mobile photo handling`.

### Task 6.3: Org images and QR logos on R2

**Files:** Modify `backend/src/routes/orgs.ts` (logo/banner upload via `putImage`, return URLs), `backend/src/routes/links.ts` (QR logo upload endpoint `PUT /api/links/:id/qr-logo`; `qr_config.logo = { key }`), `src/views/orgs/OrgModifyView.vue`, `src/components/links/QrDesigner.vue`, `src/utils/renderLinkQr.ts` (load the logo by URL).

- [x] Failing tests: `GET /api/orgs/public` payload has no `data:` strings; QR logo replace deletes the old object. Implement → PASS. Commit `feat(orgs): store org images and QR logos in R2`.

### Task 6.4: One-off media migration

**Files:** Create `backend/src/routes/adminMigrations.ts` (`POST /api/admin/migrations/media?dryRun=1`, `requireAdmin`), test.

- [x] Failing test: seeded `data:` frame, org logo and QR logo → after the run, columns hold keys, the R2 fake has objects, and a second run is a no-op. Implement → PASS. Owner runs dry run, then real run, in production (expected: 6 frames, 2 org images, 4 QR logos). Commit `feat(admin): add one-off media migration to R2`; after the production run, a follow-up commit `chore(admin): remove the completed media migration endpoint`.

### Task 6.5: Templates in R2 and the shared generator (F-FORM-2..6)

**Files:** Create `shared/formsCatalog.ts`, `src/composables/useDocxGenerator.ts` (+ test). Modify `backend/src/routes/forms.ts` (read `templates/<file>` from `MEDIA`; ETag; `private, max-age=3600`), the three generator views, `src/views/forms/FormsHomeView.vue`. Delete the backend `assets` block, `backend/assets/forms/`, and the `.gitignore` template rule. Add `docs/operations.md` steps for `wrangler r2 object put eypi-media/templates/<file> --file <path>`.

- [x] Failing tests: CSV via papaparse detects the header and handles `,` and `;`; the filename sanitizer turns `Juan/Dela Cruz` into `Juan_Dela_Cruz`, and duplicates get `-2`; a missing template gives error code `template_missing` with copy "This form's template is missing. Tell the eypi.cc admin."; `walkInCount` 501 → inline error. Implement → PASS. Commit `refactor(forms): serve templates from R2 and share one DOCX generator`.

### Task 6.6: Frame page share previews

**Files:** Modify `worker/index.ts` (`HTMLRewriter` for `/frames/:slug`: title, description, `og:image` = first frame absolute URL, `twitter:card=summary_large_image`).

- [x] Failing test: a `/frames/abc` HTML response contains `<meta property="og:image" content="https://eypi.cc/media/frames/…">`. Implement → PASS. Commit `feat(seo): add share previews for frame campaigns`.

---

# WS7: Platform UX, accessibility, performance, SEO (§10)

### Task 7.1: Remove dead weight (D13, F-HYG-1, F-PERF-2, F-PERF-4, F-A11Y-1)

**Delete:** `src/components/AppCursor.vue`, `src/components/AppLoader.vue`, `src/composables/useKeyboardNav.ts` (and every `data-section` used only by it), `vercel.json`, `.cursor/plans/`, `src/assets/icons/*.svg`, `vite-svg-loader` (+ `vite.config.ts` plugin, `vite-env.d.ts` declaration), `apc-bg` Tailwind color, the duplicate qr-scanner `?url` import (`EventDetailView` scanner code). Modify `App.vue`, `src/styles/main.css` (restore the native cursor), `HeroSection.vue` (heading visible without reveal). Update `.cursor/rules/local-dev.mdc` for the new auth and migrations.

- [ ] Verify: `npm run build` passes; pressing Space on `/links` scrolls (manual check); `grep -rn "AppCursor\|AppLoader\|useKeyboardNav" src` is empty. Commit `refactor(ui): remove the custom cursor, splash loader, and Space hijack`.

### Task 7.2: Caching, fonts, CSP (F-PERF-1, F-PERF-3, F-SEC-6)

**Files:** Modify `public/_headers` (`/assets/*` immutable; CSP per §10), `index.html` (remove Google Fonts; preload self-hosted woff2), add `src/assets/fonts/` (Geist, Geist Mono variable woff2 + OFL license), `src/styles/main.css` (`@font-face`).

- [ ] Verify after deploy: `curl -sI https://eypi.cc/assets/<index chunk>` shows `cache-control: public, max-age=31536000, immutable`; the browser console shows no CSP violations on `/`, `/links`, `/orgs/<slug>`, `/frames/<slug>`. Commit `perf(ui): cache hashed assets, self-host fonts, and tighten CSP`.

### Task 7.3: Accessibility fixes (F-A11Y-2..7)

**Files:** Create `src/composables/useFocusTrap.ts` (+ test). Modify gold button classes (≈31 sites; add a `btn-gold` utility with dark text in `main.css`), focus ring tokens, dark-mode blue token, `NavSidebar.vue` (`role="dialog" aria-modal="true"`, trap, restore focus), `DialogHost.vue` (restore focus; stop Esc propagation to toasts), `ToastContainer.vue`, `FeaturesCarousel.vue` (`inert` hidden slides; pause button), `TheFooter.vue` (`aria-hidden` on ↗), `TheHeader.vue` (`aria-pressed`), `ContactView.vue` headings, `router/index.ts` (`afterEach` title + live region; reduced-motion scroll), `DESIGN_SYSTEM.md` (contrast rules).

- [x] Failing tests: `useFocusTrap` cycles Tab within the container and restores focus on release; Esc in a dialog doesn't dismiss a toast; each route sets `document.title` to `<Page> · eypi.cc`. ESLint vuejs-accessibility has no errors. Commit `fix(ui): meet WCAG contrast and focus requirements`.

### Task 7.4: UX polish (F-UX-2, 3, 4, F-HYG-2)

**Files:** Modify `router/index.ts` (`scrollBehavior` returns `savedPosition`), `src/composables/useDarkMode.ts` (singleton; default `prefers-color-scheme`; apply the class before mount), `index.html` (`<meta name="color-scheme" content="light dark">`, `theme-color`), toast/scroll-top offset. Create `src/components/PageShell.vue`, `src/components/LegalLayout.vue`; replace the duplicated corner-screw markup.

- [x] Failing tests: `useDarkMode()` returns the same ref across calls; with no saved choice it follows `matchMedia('(prefers-color-scheme: dark)')`. Commit `fix(ui): follow system dark mode and restore scroll on back`.

### Task 7.5: SEO surface (F-SEO-1..3)

**Files:** Create `public/robots.txt`, `public/manifest.webmanifest`, `public/apple-touch-icon.png`. Modify `worker/index.ts` (`/sitemap.xml` from the API's public orgs and campaigns, cached 1 h; `HTMLRewriter` meta for `/` and `/orgs/:slug` with JSON-LD `Organization`; 404 status for unknown multi-segment paths and KV-miss single segments that aren't SPA routes, rendering the SPA `index.html` body), `index.html` (title "eypi.cc · Links and org tools for APC", description).

**robots.txt (exact):**
```
User-agent: *
Disallow: /api/
Disallow: /account
Disallow: /admin
Disallow: /links
Disallow: /manage
Sitemap: https://eypi.cc/sitemap.xml
```

- [x] Failing tests (worker): `/sitemap.xml` returns XML with public org URLs; `/orgs/foo` HTML has an `og:title` with the org name; `/no/such/page` → 404 status with the HTML body. Commit `feat(seo): add robots, sitemap, per-page meta, and real 404 status`.

---

# WS8: Account, admin, legal (§9). Needs WS2

### Task 8.1: Admin and legal schema; consent gate

**Files:** Create `backend/migrations/0008_admin_legal.sql` (`audit_events`, `legal_consents` per §9.2/§9.3, indexes on `audit_events(created_at)`, `legal_consents(user_id)`), `shared/legalVersions.ts` (`LEGAL_VERSIONS = { privacy: '2026-11-01', terms: '2026-11-01', 'acceptable-use': '2026-11-01' }`), `backend/src/middleware/requireConsent.ts` (+ test), `backend/src/routes/legal.ts` (`POST /api/legal/consent { documents: string[] }`), `backend/src/lib/audit.ts` (`recordAudit(db, { actorUserId, action, targetType, targetId, meta })`). Modify `backend/src/routes/me.ts` (`needsConsent`).

- [x] Failing tests: a user with no consents → `/api/me.needsConsent` lists privacy and terms; link create → 403 `consent_required`; after consent → 201; bumping a version re-requires consent. Commit `feat(legal): record versioned consent and gate the API until accepted`.

### Task 8.2: Legal documents and consent screen (F-LEGAL-1)

**Files:** Create `src/legal/{types,privacy,terms,acceptable-use}.ts`, `src/views/LegalView.vue`, `src/views/ConsentView.vue` (+ tests). Delete `src/views/PrivacyView.vue`, `src/views/TermsView.vue`. Modify the router (`/privacy`, `/terms`, `/acceptable-use` → `LegalView`; a guard redirects to `/consent` when `needsConsent` is non-empty) and `TheFooter.vue`.

- [ ] Draft privacy content covering every bullet in §9.3. Mark the top of each file `// OWNER REVIEW REQUIRED before publish`. Tests: the consent screen needs both checkboxes before "Continue" enables; LegalView shows version and effective date. Commit `feat(legal): publish versioned privacy, terms, and acceptable use pages`.

### Task 8.3: Account page (D8, F-LEGAL-2)

**Files:** Create `backend/src/routes/account.ts` (+ test), `src/views/AccountView.vue` (+ test). Modify the router (`/account`; `/settings` → redirect `/account`), delete `src/views/SettingsView.vue` and `src/views/settings/SettingsLayout.vue` if unused after WS8 Task 8.4.

**Interfaces:**
- `GET /api/account/export.json` → attachment `eypi-data-<date>.json`
- `GET /api/account/sessions`, `DELETE /api/account/sessions/:id`, `POST /api/account/sessions/revoke-all`
- `DELETE /api/account { confirmEmail }` → 204; 409 `owns_org` with `{ orgs: [{id,name}] }`

- [ ] Failing tests: export contains links, memberships and consents and excludes other users' data; delete as an org owner → 409 `owns_org`; delete otherwise removes links (and analytics by cascade), memberships by user id **and** email, sessions, identities, consents, the user; reassigns `events.lead_user_id` and `dp_campaigns.creator_id` to the org owner; revoke-all leaves zero sessions. Commit `feat(account): add data export, account deletion, and session management`.

### Task 8.4: Admin panel (D7)

**Files:** Create `backend/src/routes/admin.ts` (+ test), `src/views/admin/{AdminLayout,AdminUsersView,AdminLinksView,AdminReportsView,AdminAuditView}.vue`. Move `src/views/settings/OrgManagement*` under `/admin/orgs`. Every mutation calls `recordAudit`.

**Interfaces:**
- `GET /api/admin/users?q&cursor`
- `PATCH /api/admin/users/:id { role?, disabled? }` (refuse demoting self or the last admin → 409 `last_admin`; disabling revokes sessions)
- `POST /api/admin/users/:id/logout`
- `DELETE /api/admin/users/:id` (same routine as account deletion; 409 `owns_org`)
- `GET /api/admin/links?q&cursor`
- `POST /api/admin/links/:id/disable { reason }`
- `GET /api/admin/reports?status=open|resolved`
- `POST /api/admin/reports/:id/resolve { action: 'disable_link'|'dismiss' }`
- `GET /api/admin/audit?cursor&action`

- [ ] Failing tests: non-admin → 403 on every endpoint; last-admin demotion → 409; resolving a report with `disable_link` sets `disabled_reason='abuse'`, removes KV, and writes an audit row; the owner can't re-enable an abuse-disabled link (403 `moderator_disabled`). Commit `feat(admin): add users, links, reports, and audit log admin panel`.

### Task 8.5: Retention cron (§9.4, F-DB-12)

**Files:** Modify `backend/wrangler.jsonc` (`triggers.crons: ["0 19 * * *"]`, i.e. 03:00 Manila), `backend/src/index.ts` (`export default { fetch: app.fetch, scheduled }`). Create `backend/src/jobs/retention.ts` (+ test). Remove email logging in `onboarding.ts`.

- [ ] Failing tests: expired sessions deleted; `event_csv_rows` of events whose date is more than 30 days ago are deleted, newer ones kept; resolved reports older than 180 days are deleted. Commit `feat(platform): add daily retention cleanup`.

---

# WS9: Docs (runs alongside; finish last)

### Task 9.1: Agent entry point and context refresh

**Files:** Create `AGENTS.md`, `CLAUDE.md` (single line `@AGENTS.md`). Modify `CONTEXT.md` (auth seam = Microsoft + cookie sessions; roles = flat org model + `users.role`; schema in `backend/migrations`; R2; removed modules; fix the "coordinator manages members" line), `README.md`.

`AGENTS.md` must cover: stack and commands (`npm run setup|doctor|dev:local|lint|typecheck|test|build`, `npm run migrate --prefix backend`); where truth lives (CONTEXT, DESIGN_SYSTEM, this spec and plan, schema baseline); safety (production DB, no destructive SQL without approval, never `DROP TABLE users`, never commit secrets); the Global Constraints commit rules (no AI trailers); the definition of done.

- [ ] Commit `docs: add AGENTS.md and refresh CONTEXT for the overhaul` (this task may land first as a stub and be finished last).

### Task 9.2: Operations runbook (F-OPS-3)

**Files:** Create `docs/operations.md`. Modify `docs/RELEASE.md`.

Cover: Turso PITR restore and branch rehearsal commands; the migration runner; KV backfill and reconcile; R2 template upload and media migration; Entra secret rotation (record the expiry date); Resend domain and sender; cron schedule; incident checklist (auth down, Turso down, KV drift, abuse report surge). Commit `docs(ops): add the operations runbook`.

---

## Final verification (after all workstreams)

- [ ] `npm run lint && npm run typecheck && npm test && npm run build` green locally and in CI; `npm audit --omit=dev --audit-level=high` clean in both packages.
- [ ] Every `F-*` finding with severity CRIT/HIGH/MED is either fixed (cite the commit in the PR) or listed in `docs/operations.md` → "Accepted risks" with the owner's sign-off.
- [ ] Manual regression on production (owner, phone and desktop):
  - sign in as a student and as a professor
  - a non-APC Microsoft account is refused
  - create, edit, expire, protect and disable a link; redirect is 302 and edits apply immediately; QR scan is tagged
  - export links CSV; report a link; resolve it as admin
  - invite → email → accept from the inbox → org tools unlock; decline path
  - Frames page loads fast on mobile data, previews on Messenger, saves a photo
  - Forms generate with a CSV; templates are not downloadable anonymously (`curl` 404)
  - Tix: create an event, finalize, look up a ticket, check in twice (second refused), Google Wallet pass
  - `/account` export JSON, sign out everywhere, delete a test account
  - Lighthouse on `/`: Performance ≥ 90, Accessibility ≥ 95, SEO ≥ 95
- [ ] `CONTEXT.md`, `AGENTS.md`, `README.md`, `docs/operations.md` match reality.

## Run prompt (paste into the orchestrating agent)

```
You are implementing docs/superpowers/plans/2026-10-25-eypi-overhaul.md in the eypi.cc repo.
Read AGENTS.md (if present), CONTEXT.md, DESIGN_SYSTEM.md, the spec docs/superpowers/specs/2026-10-25-eypi-overhaul-design.md,
the findings docs/superpowers/specs/2026-10-25-eypi-audit-findings.md, and docs/db/schema-baseline.md first.

Execute with subagent-driven development:
- Work workstreams in dependency order: WS0 → WS1 → (WS2, WS4, WS5, WS6, WS7 in parallel) → (WS3, WS8) → WS9 → Final verification.
- For each task: dispatch a fresh implementer with ONLY that task's text, the Global Constraints, and the Interfaces it consumes.
  The implementer follows the task's steps in order (failing test → run → implement → run → commit).
- After each task, dispatch a fresh reviewer: check the diff against the task, the spec section, and Global Constraints; run
  `npm run typecheck && npm test` (and `npm run lint` after Task 1.5). Reject and loop until clean.
- Respect the coordination rules: shared-file owners, reserved migration numbers, one branch/PR per task group.
- Commit after every finished task using Conventional Commits in this repo's style
  (type(scope): lowercase imperative subject, blank line, "- bullet" body).
  NEVER add Co-Authored-By, Signed-off-by, "Generated with", or any AI/tool trailer.
- Tick the task's checkboxes in the plan file and include that change in the task's commit.
- STOP and ask the owner before: any production migration, any destructive SQL, Entra/R2/Resend/secret setup steps,
  production deploys, and Task 4.9 Step 1 if any reserved slug is already used.
- Never connect a write token to production unless the owner says so. Local dev uses production Turso.
Report after each workstream: tasks done, commits, test counts, open risks.
```
