# Operations

Runbook for the owner. Deploy order and the Microsoft cutover are in [RELEASE.md](RELEASE.md). Everything here that touches production (Turso, Cloudflare, Entra, Resend) is an owner action. Agents prepare and verify; they do not run it.

## Migration runner

Versioned SQL lives in `backend/migrations/`. The runner is `backend/scripts/migrate.mjs`, run from the repo root as `npm run migrate --prefix backend -- <flags>`. It reads `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from `backend/.dev.vars`, prints the target database host, records applied files and their checksums in `schema_migrations`, and applies files in filename order.

| Flag | Effect |
|---|---|
| `--status` | Show applied and pending files. Writes nothing. |
| `--dry-run` | Print what would run. Writes nothing. |
| `--yes` | Apply every pending file. |
| `--allow-destructive` | Required for a file that contains `DROP TABLE`, `ALTER TABLE ... DROP COLUMN`, any `DELETE FROM`, or an `UPDATE` without `WHERE`. `0002` (drops empty `board_*` tables) and `0004` (deletes unverified users, drops the password columns) need it. |
| `--baseline` | Mark the current live schema as applied without running it. First use only. |

Rules:

- Always run `--status` and `--dry-run` first, against a branch database (see [Turso restore and branch rehearsal](#turso-restore-and-branch-rehearsal)).
- A changed checksum on an already-applied file stops the run. Never edit an applied migration; add a new one.
- Never `DROP TABLE users` or rebuild it. Foreign keys are on and `links` cascades, so every link and its analytics would be deleted.
- Migrations `0005` to `0009` are additive. The new code needs them, so they are applied in the same pass as `0003`.

### Applying 0003 and 0004 together (cutover)

The runner has no stop-after option: it applies every pending file. `0003` adds sessions and roles. `0004` removes the legacy password columns and must wait until Microsoft sign-in is verified in production. To hold `0004` back, move the file out of `backend/migrations/` before the run. Files missing from the folder are ignored by the checksum check. Once sign-in is verified, restore it with `git checkout -- backend/migrations/` and run the runner again with `--yes --allow-destructive`; `0004` is refused without `--allow-destructive`. The exact window and order are in [RELEASE.md section 10](RELEASE.md#10-microsoft-sign-in-cutover-one-time).

## Turso restore and branch rehearsal

Rehearse every migration on a copy first. Production data is real students' data.

Branch for rehearsal (Turso CLI; confirm flags with `turso db create --help`):

```bash
turso db create eypi-rehearsal --from-db <production-db-name>
turso db show eypi-rehearsal --url
turso db tokens create eypi-rehearsal
```

Put that URL and token in a throwaway env (not the committed `.dev.vars`), run `--status`, `--dry-run`, then `--yes` against the branch, and smoke test. Destroy it when done: `turso db destroy eypi-rehearsal`.

Point-in-time restore: Turso keeps point-in-time history for the database. Before any production migration, note the current UTC time. If a migration goes wrong, create a new database from the production one at that timestamp (`turso db create <new-name> --from-db <production-db-name> --timestamp <RFC3339>`), verify it, then repoint `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` for both Workers. The retention window depends on the Turso plan; check it in the Turso dashboard before relying on it.

## KV backfill and reconcile

Short-link redirects are served from `LINKS_KV` (slug to destination). The database is the source of truth. Run from the repo root; the script uses `wrangler` and your Cloudflare login.

```bash
npm run backfill-kv --prefix backend                       # dry run (default): prints keys to add and stale keys
npm run backfill-kv --prefix backend -- --yes              # writes missing keys
npm run backfill-kv --prefix backend -- --yes --reconcile  # also deletes keys with no live link
```

Run the dry run first and read the delete list before using `--reconcile`. Use it after a restore, after a migration that touches `links`, or when redirects disagree with the dashboard (KV drift).

## R2 templates and media

The `.docx` templates are not in git. Keep the originals in a private backup outside this repository. A clean checkout does not contain them, and the public site does not serve the `templates/` prefix.

The bucket is `eypi-media` (binding `MEDIA` in both Workers). The backend reads each template from `templates/<file>`. Activated org members download it through `GET /api/forms/templates/<file>`.

Upload each file once, from `backend/`, with the Cloudflare account that owns the bucket. Do not commit the files. Do not point this command at a different bucket.

```bash
wrangler r2 object put eypi-media/templates/<file> --file <path> --remote
```

`<file>` is the object name. `<path>` is the local backup. `--remote` is required, otherwise wrangler writes to a local simulator. The allowlist is:

- `concessionaire_reply_form.docx`
- `memorandum_of_agreement.docx`
- `terms_and_conditions.docx`
- `waiver_form.docx`
- `products_and_equipments.docx`
- `visitors_pass.docx`
- `letter_of_intent_and_waiver.docx`

Repeat for every file. Re-run the same command to replace one. Until an allowlisted file is uploaded, the form API returns `template_missing`.

### Media migration

Old org logos, banners, QR logos and frames were stored as data URLs in Turso. `POST /api/admin/migrations/media` moves them to R2. It is admin-only (`users.role = 'admin'`, signed in with the session cookie, same-origin request).

- Default is a dry run: anything other than `?dryRun=0` only reports counts (`frames`, `orgImages`, `qrLogos`) and writes nothing.
- `?dryRun=0` performs the move.

Run the dry run, read the counts, then run it with `?dryRun=0`. Take a Turso branch or note the restore timestamp first.

## Entra client secret rotation

Sign-in uses one Entra app registration (authorization code with PKCE), pinned to tenant `aeb745e6-8166-4f8f-9233-179e8109c49e`. The client secret expires. When it does, sign-in fails with `/login?error=server`.

Record the expiry here every time the secret changes:

| Field | Value |
|---|---|
| Secret created | _owner to fill_ |
| Secret expires | _owner to fill_ |
| Rotate by (30 days before expiry) | _owner to fill_ |

Rotation:

1. In the Entra app registration, create a new client secret. Keep the old one until step 4.
2. Run `wrangler secret put MS_CLIENT_SECRET` from `backend/` and paste the new value.
3. Sign in on production to confirm it works.
4. Delete the old secret in Entra. Update the table above.

Never paste the secret into a file, ticket or chat.

## Resend domain and sender

Invites are sent through Resend from `eypi.cc <invites@eypi.cc>`. In Resend, add and verify the `eypi.cc` domain (the SPF and DKIM DNS records Resend lists), create an API key, then run `wrangler secret put RESEND_API_KEY` from `backend/`. If the key is unset, no invite email is sent. Check delivery in the Resend dashboard if invitees say nothing arrived.

## Scheduled retention (cron)

The backend Worker has a cron trigger `0 19 * * *` (19:00 UTC, 03:00 Manila). It runs `runRetention`, which deletes:

- sessions past `expires_at`;
- `event_csv_rows` for events whose date is more than 30 days past;
- resolved `link_reports` older than 180 days.

A failure is reported through `reportError` with code `retention_failed` and does not break the Worker. If it stops running, check the trigger in the Cloudflare dashboard and the Worker logs.

## Incident checklist

First: `curl -s https://api.eypi.cc/api/health`. A 503 with `{"ok":false,"db":false}` means Turso is unreachable; a 503 with text means a required secret is missing.

**Sign-in is down**
1. Does `/api/auth/microsoft/start` redirect to Microsoft or to `/login?error=server`? The latter means a missing or expired `MS_CLIENT_ID` / `MS_CLIENT_SECRET`, or a missing `AUTH_COOKIE_SECRET`.
2. Check the Entra secret expiry in the table above and the redirect URI `https://api.eypi.cc/api/auth/microsoft/callback`.
3. Confirm `ENVIRONMENT` and `FRONTEND_ORIGIN` are still set on the backend.
4. Existing sessions keep working while sign-in is down; do not mass-revoke them.

**Turso is down**
1. Check the Turso status page and the dashboard.
2. Short-link redirects are served from KV where the key exists; everything that needs the database returns errors.
3. Do not migrate or rotate secrets while it is down. If data was damaged, use point-in-time restore above.

**KV drift** (a link redirects wrong, or 404s while it exists)
1. Dry-run `backfill-kv` and read the diff.
2. Apply with `--yes`; add `--reconcile` only after reading the delete list.

**Abuse report surge** (many `link_reports`)
1. Open the admin panel reports view; triage the highest-count links first.
2. Disable or delete the offending links in the admin links view.
3. If one account is the source, handle it in the admin users view.
4. Check that `SAFE_BROWSING_API_KEY` is set (the check runs on create and edit, and fails open).

## Accepted risks

Findings or review notes that are deferred or unfixed. Each is **pending owner sign-off**. IDs refer to `docs/superpowers/specs/2026-10-25-eypi-audit-findings.md`; the rest come from the overhaul review log.

| Item | Severity | Risk | Status |
|---|---|---|---|
| F-SEC-7 | MED | The KV rate limiter is a non-atomic read-then-write, so bursts can slip past a limit. Acceptable for coarse limits. | pending owner sign-off |
| Rate-limit key without `IP_HASH_SECRET` | MED | If `IP_HASH_SECRET` is unset, the rate-limit KV key can contain the raw IP. The secret must be set on the backend and on the frontend Worker. | pending owner sign-off |
| F-TIX-2 (residual) | HIGH | A caught finalize failure unlocks the event, but a crash between the lock update and the write can leave it locked. Manual fix: set `selection_locked = 0` for that event. | pending owner sign-off |
| F-TIX-12 (residual) | MED | CSV import ignores parser errors (an unclosed quote can import surviving rows), a missing `lastName` can still return 500 after the event insert, and `POST /api/events` attendees are not capped at 5,000. | pending owner sign-off |
| F-TIX-14 (residual) | MED | The Google Wallet save token still embeds `reviewStatus: UNDER_REVIEW`. | pending owner sign-off |
| Last-admin guard | MED | The check that blocks removing the last admin is check-then-update, not atomic. | pending owner sign-off |
| Account deletion scope | MED | Deleting an account also deletes org-less events and campaigns with their attendees, check-ins and CSV rows. This is beyond the original brief. | pending owner sign-off |
| Consent writes | MED | Consent is inserted per document; a failure mid-loop can leave a partial record. | pending owner sign-off |
| Media cleanup | MED | Deleting a link does not remove its R2 object; an oversized data URL on PATCH can clear a stored logo. | pending owner sign-off |
| Safe Browsing | MED | The malware check fails open on timeout or an unexpected response shape. | pending owner sign-off |
| F-SEO-1 (residual) | MED | `HEAD` requests skip meta rewriting; frames still stored as `data:` URLs get the generic page shell until migrated. | pending owner sign-off |
| Privacy copy | LOW | The privacy page says the session cookie is the only cookie; sign-in also sets the short-lived `eypi_oauth` cookie. | pending owner sign-off |
