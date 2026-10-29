# eypi.cc

URL shortener and org-tool suite for the Asia Pacific College student community.

## Prerequisites

- Node 20+ and npm
- A Cloudflare account login is only needed for deploys (`wrangler deploy`), not for local development

## Local setup

```bash
npm run setup
```

That installs both packages, copies `backend/.dev.vars.example` to `backend/.dev.vars` if the file is missing, and fills fresh local values for `PASS_TOKEN_SECRET`, `AUTH_COOKIE_SECRET`, and `IP_HASH_SECRET`. It does not overwrite an existing `.dev.vars`.

### Fill `backend/.dev.vars`

Copy real values from `backend/.dev.vars.example` (comments there say where each value comes from). Status is key names only — never commit this file.

| Key | Required | Used for |
|---|---|---|
| `TURSO_DATABASE_URL` | yes | Production Turso database URL |
| `TURSO_AUTH_TOKEN` | yes | Production Turso database token |
| `PASS_TOKEN_SECRET` | yes | Signs Tix wallet pass tokens (`setup` generates one) |
| `AUTH_COOKIE_SECRET` | yes | Signs the short-lived Microsoft sign-in cookie (`setup` generates one) |
| `IP_HASH_SECRET` | yes | HMAC for hashed IPs in sessions, analytics, and reports (`setup` generates one) |
| `MS_CLIENT_ID`, `MS_CLIENT_SECRET` | no | Sign in with Microsoft. Without them `/api/auth/microsoft/start` redirects to `/login?error=server` |
| `MS_ALLOWED_TENANT_IDS` | no | Comma list of allowed Entra tenant ids. APC is `aeb745e6-8166-4f8f-9233-179e8109c49e` |
| `FRONTEND_ORIGIN` | no | SPA origin for sign-in redirects. `http://localhost:5173` locally, `https://eypi.cc` in production |
| `ENVIRONMENT` | no | `development` locally. `production` drops localhost from CORS and CSRF and uses the `__Host-` session cookie |
| `RESEND_API_KEY` | no | Org invite emails |
| `SAFE_BROWSING_API_KEY` | no | Google Safe Browsing check on link create and edit. Unset skips it |
| `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY` | no | Google Wallet |

`FRONTEND_ORIGIN` and `ENVIRONMENT` are not checked by `doctor`; the example file sets local values. For local Microsoft sign-in, register `http://localhost:8787/api/auth/microsoft/callback` as a redirect URI on the Entra app and fill the `MS_*` keys. Production secret names and the cutover order are in [docs/RELEASE.md](docs/RELEASE.md).

Then check the file:

```bash
npm run doctor
```

`doctor` exits 0 only when every required key (the first five rows) is set (not empty, and not still the example placeholder).

## Run locally

```bash
npm run dev:local
```

Starts the API at `http://127.0.0.1:8787` and the Vite app at `http://localhost:5173` with `VITE_API_BASE_URL=http://localhost:8787`.

Local development uses the **production Turso database**. CONTEXT.md: "Do not insist on a separate dev database unless asked."

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

`npm run smoke` and `npm run release:check` are used before and after a deploy.

## Database, media and operations

Schema changes are versioned SQL in `backend/migrations/`, applied with `npm run migrate --prefix backend -- --status` (then `--dry-run`, then `--yes`). Because local development points at the production database, never run `--yes` without the owner. Org logos, QR logos, frames and the private form templates live in the R2 bucket `eypi-media`. Restore, KV backfill, secret rotation and incident steps are in [docs/operations.md](docs/operations.md). Deploys and the Microsoft cutover are in [docs/RELEASE.md](docs/RELEASE.md). Agents start at [AGENTS.md](AGENTS.md).

## Known issues

- `public/_headers` sets `connect-src 'self' https://api.eypi.cc`. That header is served by the Worker, not by Vite. If a local API call is blocked in the browser console under `wrangler` preview, do not change `_headers` without a follow-up; use `npm run dev:local` (Vite) for day-to-day work.
- Short-link redirects for existing slugs may 404 locally. `LINKS_KV` in `wrangler dev` is a local namespace and is often empty until backfilled.

## License

The code is licensed under the [GNU Affero General Public License v3.0](LICENSE) (`AGPL-3.0-only`). If you run a modified version as a network service, you must offer its complete source to the people who use it, under the same license.

The license covers the source code only. Organization logos and banners, the privacy policy, terms and acceptable use text, and the eypi.cc name and brand are not licensed for reuse.
