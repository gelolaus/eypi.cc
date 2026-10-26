# Release runbook

Backend before frontend. Additive migrations before both.

Ordinary releases use sections 1 to 9. The one-time Microsoft sign-in cutover has its own section, [10](#10-microsoft-sign-in-cutover-one-time). Day-two procedures (restore, KV drift, secret rotation, incidents) live in [operations.md](operations.md).

Steps marked **owner** change production, secrets, or Cloudflare, Entra, Resend, or Turso settings. An agent must not run them.

## 1. Before you start

On `main`, with a clean tree: `git pull`, then `npm run release:check`. It must exit 0.

## 2. Schema (only if the release includes a migration)

Apply the migration **before** deploying the backend. Read the plan first, then apply:

```bash
npm run migrate --prefix backend -- --status
npm run migrate --prefix backend -- --dry-run
npm run migrate --prefix backend -- --yes
```

If `0004` is pending, the apply step needs `--yes --allow-destructive` (see section 10 for the hold-back procedure).

The runner prints the target database host and every pending file, applies pending files in version order, and records each in `schema_migrations`. It has no "stop after N" option. Details, flags, and the hold-back technique are in [operations.md](operations.md#migration-runner).

Migrations must be additive or backward compatible, because frontend and backend deploy at different times. Destructive migrations need explicit owner approval (`CONTEXT.md`). Record the filename and date in your release notes (outside the repo).

## 3. Verify secret names (read-only)

These commands print names, not values.

```bash
cd backend
npx wrangler secret list --config wrangler.jsonc
```

Expect these backend names:

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `PASS_TOKEN_SECRET`, `AUTH_COOKIE_SECRET`, `IP_HASH_SECRET`
- `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_ALLOWED_TENANT_IDS`
- `FRONTEND_ORIGIN`, `ENVIRONMENT`
- `RESEND_API_KEY`
- optional: `SAFE_BROWSING_API_KEY`, `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY`

`JWT_SECRET` must not be listed after the cutover (section 10).

For the frontend, after `npm run build`:

```bash
npx wrangler secret list --config dist/eypicc_frontend/wrangler.json
```

Expect `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `IP_HASH_SECRET`. The frontend Worker logs clicks and hashes visitors itself, so its `IP_HASH_SECRET` must hold the **same value** as the backend's. Without it, unique-visitor hashes are stored as null.

Both Workers bind the R2 bucket `eypi-media`. The bucket must exist before either deploy, or `wrangler deploy` fails.

## 4. Deploy backend first

```bash
cd backend
npm run deploy
```

## 5. Deploy frontend second

From the repo root:

```bash
npm run deploy
```

This runs `predeploy` (`release:check`), then `vite build`, then `wrangler deploy`.

## 6. Redirects only if `redirects/` changed

```bash
cd redirects
npx wrangler deploy
```

## 7. Smoke

```bash
npm run smoke
```

All targets must `PASS`. The targets are `https://eypi.cc/` and `https://api.eypi.cc/api/health`.

## 8. Tag (after a good deploy, only when the owner asks to push)

```bash
git tag vYYYY.MM.DD
git push origin vYYYY.MM.DD
```

## 9. Rollback

Workers keep prior versions. Check the current command with `npx wrangler rollback --help` before use. Do not run it without owner approval. Schema changes are not rolled back by a Worker rollback; see [operations.md](operations.md#turso-restore-and-branch-rehearsal).

## 10. Microsoft sign-in cutover (one time)

This replaces email and password with Sign in with Microsoft, pinned to the APC tenant. It is a hard cutover: password login is removed in the same release, and every existing browser session ends. The existing `users` rows are kept. Each user is matched by lowercased email on their first Microsoft sign-in.

All steps in this section are **owner** steps. In `docs/superpowers/plans/2026-10-25-eypi-overhaul.md`, Task 2.6 Steps 1 to 3 stay unticked until the owner has done them.

### 10.1 Why the order matters

- Migration `0003_auth_additive` only adds tables and columns. The old password backend keeps working after it.
- Migration `0004_auth_cleanup` deletes the unverified users and drops `users.password_hash`, `verification_token`, and `is_verified`. The old backend breaks after it. Apply it only after the new backend is live and sign-in works.
- The runner has no way to stop after `0003`. It applies every pending file in version order. The window therefore hides `0004` from the runner until the new code is live (10.4, step 3).
- Migrations `0005` to `0009` are additive and are **not** on production yet. The new backend and the frontend Worker depend on them (invites, link expiry and click logging, Tix, audit and consent, frame slug history). Apply them in the same pass as `0003`.
- Never `DROP TABLE users` or rebuild it. Foreign keys are on and `links` cascades, so every link and its analytics would be deleted. `0004` uses `ALTER TABLE ... DROP COLUMN`.

### 10.2 Prerequisites (before the window)

1. **Entra app registration** (personal Entra, [spec section 3.1](superpowers/specs/2026-10-25-eypi-overhaul-design.md)):
   - Supported account types: any organizational directory (multitenant). No personal Microsoft accounts.
   - Platform Web, exact redirect URIs `https://api.eypi.cc/api/auth/microsoft/callback` and `http://localhost:8787/api/auth/microsoft/callback`.
   - Delegated permissions `openid`, `profile`, `email` only.
   - Client secret with a 24-month life. Record its expiry date in [operations.md](operations.md#entra-client-secret-rotation).
2. **R2 bucket** `eypi-media` exists, and the seven form templates are uploaded ([operations.md](operations.md#r2-templates-and-media)).
3. **Reserved-slug check** (read-only, owner). If any row returns, stop and rename those links before deploy:

   ```sql
   SELECT slug FROM links WHERE slug IN ('admin','account','api','assets','auth','logout','signup','help','about','qr','static','invites','report','unlock','expired','media','p');
   ```

4. **Backend secrets** (names from section 3; each is `npx wrangler secret put <NAME> --config wrangler.jsonc` from `backend/`):
   - `MS_CLIENT_ID`, `MS_CLIENT_SECRET` from the Entra app.
   - `MS_ALLOWED_TENANT_IDS`: `aeb745e6-8166-4f8f-9233-179e8109c49e` (the APC tenant, public in its OIDC metadata). A comma list is accepted.
   - `AUTH_COOKIE_SECRET`, `IP_HASH_SECRET`, `PASS_TOKEN_SECRET`: random values of at least 32 bytes.
   - `FRONTEND_ORIGIN`: `https://eypi.cc`.
   - `ENVIRONMENT`: `production`. Without it the API still allows `localhost` origins and issues the session cookie without the `__Host-` prefix.
   - `RESEND_API_KEY`, and optionally `SAFE_BROWSING_API_KEY`.
5. **Frontend secrets**: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `IP_HASH_SECRET` (same value as the backend) on the frontend Worker.
6. **Resend**: the `eypi.cc` domain is verified and can send as `eypi.cc <invites@eypi.cc>` ([operations.md](operations.md#resend-domain-and-sender)). Invites still save if sending fails, but the response says `emailSent: false`.
7. Record the current UTC time and the production counts (`SELECT COUNT(*) FROM links`, `users`, `org_members`, `analytics`) in your release notes. They are your restore point and your comparison baseline.
8. **Duplicate-attendee preflight** (read-only, owner). Migration `0007` creates a unique index on `attendees(event_id, lower(email))`. A leftover duplicate makes it fail part-way. Run this against production; it must return no rows:

   ```sql
   SELECT event_id, lower(email) AS email, COUNT(*) FROM attendees GROUP BY 1, 2 HAVING COUNT(*) > 1;
   ```

   If it returns rows, resolve them by hand (for example remove or correct the extra attendee in the Tix UI) before migrating. Do not bulk-delete. The runner repeats this check before applying `0007` and refuses with `Preflight failed for 0007_tix.sql` (it prints event ids only, never emails), also during `--dry-run`.

### 10.3 Rehearsal on a Turso branch (Task 2.6 Step 1)

Never rehearse on production. A branch copies the production data at creation time.

```bash
turso db create eypi-rehearsal --from-db <production-db-name>
turso db show eypi-rehearsal --url
turso db tokens create eypi-rehearsal
```

Point the runner at the branch with environment variables for one shell session. The runner does not override variables that are already set, so `backend/.dev.vars` stays untouched:

```bash
export TURSO_DATABASE_URL=<branch url>
export TURSO_AUTH_TOKEN=<branch token>
npm run migrate --prefix backend -- --status
```

Check that the printed host is the branch, not production.

1. If `--status` lists `0001` as pending although the database already has tables, run `-- --baseline --yes` first. That records `0001` without executing SQL. If `0002` is pending, it drops the empty `board_*` tables, so the later `--yes` run needs `--allow-destructive`.
2. Hide `0004` and apply everything else. See [operations.md](operations.md#migration-runner) for the hold-back commands. Confirm `--dry-run` lists `0003` and `0005` to `0009` and not `0004`.
3. Back up `backend/.dev.vars` (for example to `backend/.dev.vars.prod`, which is gitignored), then point `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `backend/.dev.vars` at the branch. Fill the `MS_*` keys, `AUTH_COOKIE_SECRET`, and set `FRONTEND_ORIGIN=http://localhost:5173`. Run `npm run dev:local` and sign in with Microsoft with an `@apc.edu.ph` account and a `@student.apc.edu.ph` account. Sign in with a non-APC Microsoft account and confirm `?error=tenant` or `?error=domain`.
4. Restore `0004`, then apply it: `npm run migrate --prefix backend -- --yes --allow-destructive`. Its `DELETE FROM users` and `ALTER TABLE ... DROP COLUMN` statements trip the destructive guard, so `--allow-destructive` is required.
5. Run the count queries from 10.2 step 7 against the branch. `links`, `analytics`, and `org_members` counts must match production, and `users` must be lower only by the unverified, never-claimed accounts (2 at audit time). Sign in again.
6. Restore the original `backend/.dev.vars`, `unset TURSO_DATABASE_URL TURSO_AUTH_TOKEN`, and delete the branch (`turso db destroy eypi-rehearsal`).

### 10.4 Production window (Task 2.6 Step 2)

Order follows [spec section 12, step 4](superpowers/specs/2026-10-25-eypi-overhaul-design.md). Do it in one sitting, with the commands ready.

1. On `main`, clean tree, `npm run release:check` exits 0.
2. Production runner target (owner, read-write token). Confirm the printed host is production:

   ```bash
   npm run migrate --prefix backend -- --status
   ```

3. Hide `0004`, dry-run, and apply (hold-back commands in [operations.md](operations.md#migration-runner)). The dry run must list `0003` and `0005` to `0009`, and `0001`/`0002` only if they are not recorded yet. Apply with `--yes`, adding `--allow-destructive` only when `0002` is in the list. Then restore `0004`:

   ```bash
   git checkout -- backend/migrations/0004_auth_cleanup.sql
   git status --short        # must be clean before predeploy
   ```

4. Deploy the backend, then the frontend, back to back (sections 4 and 5). Between them, the old frontend shows a password form that no longer has an endpoint.
5. Sign in with Microsoft as `arlaus@student.apc.edu.ph`. `0003` seeded that account as `admin`. Accept the privacy and terms screen. Confirm the Admin entry appears in the navigation and `/admin` loads.
6. Apply `0004`. Until it runs, `users.password_hash` still exists; first sign-ins in the window store a fixed non-matchable placeholder there (never a real hash). `0004` deletes unverified legacy users but keeps any user who already has a `user_identities` row, so accounts created during the window survive:

   ```bash
   npm run migrate --prefix backend -- --status
   npm run migrate --prefix backend -- --yes --allow-destructive
   ```

   `0004` contains `DELETE FROM` and `ALTER TABLE ... DROP COLUMN`, so the runner refuses it without `--allow-destructive`. `--status` must now list only `0004` as pending. Re-run the count queries: `links`, `analytics`, and `org_members` unchanged.
7. Remove the retired secret:

   ```bash
   cd backend
   npx wrangler secret delete JWT_SECRET --config wrangler.jsonc
   ```

   Nothing reads it any more. Check `npx wrangler secret list --config wrangler.jsonc` afterwards.

If sign-in fails before step 6, the schema is still compatible with the previous backend version: roll the Workers back (section 9) and investigate. After step 6 the dropped columns cannot come back from a Worker rollback; use [Turso point-in-time restore](operations.md#turso-restore-and-branch-rehearsal).

### 10.5 Verify (Task 2.6 Step 3)

```bash
# anonymous session check: expect 401
curl -s https://api.eypi.cc/api/me -o /dev/null -w "%{http_code}\n"

# health: expect {"ok":true,"db":true}
curl -s https://api.eypi.cc/api/health

# sign-in start: expect 302, a Location on login.microsoftonline.com/organizations,
# and Set-Cookie: eypi_oauth=...; HttpOnly; Secure; SameSite=Lax; Path=/api/auth
curl -sI "https://api.eypi.cc/api/auth/microsoft/start?returnTo=/links"

# old password endpoint is gone: expect 404 (the Origin header gets past the CSRF check)
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Origin: https://eypi.cc" https://api.eypi.cc/api/auth/login

# localhost must not be a CORS origin in production: expect no access-control-allow-origin line
curl -sI -H "Origin: http://localhost:5173" https://api.eypi.cc/api/health

# templates are not public: expect 404, and 401 without a session on the gated route
curl -s -o /dev/null -w "%{http_code}\n" https://api.eypi.cc/forms/templates/waiver_form.docx
curl -s -o /dev/null -w "%{http_code}\n" https://api.eypi.cc/api/forms/templates/waiver_form.docx
```

Then, in a browser:

- an `@apc.edu.ph` professor account signs in and lands on the dashboard;
- an `@student.apc.edu.ph` student account signs in;
- a Microsoft account outside the APC tenant is sent back to `/login?error=tenant` (or `domain`);
- `Sign out` ends the session, and `/account` lists the current session.

Tick Task 2.6 Steps 1 to 3 in the plan only after the owner has done and checked them.
