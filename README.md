# eypi.cc

URL shortener and org-tool suite for the Asia Pacific College student community.

## Prerequisites

- Node 20+ and npm
- A Cloudflare account login is only needed for deploys (`wrangler deploy`), not for local development

## Local setup

```bash
npm run setup
```

That installs both packages, copies `backend/.dev.vars.example` to `backend/.dev.vars` if the file is missing, and fills a local `JWT_SECRET`. It does not overwrite an existing `.dev.vars`.

### Fill `backend/.dev.vars`

Copy real values from `backend/.dev.vars.example` (comments there say where each value comes from). Status is key names only — never commit this file.

| Key | Required | Used for |
|---|---|---|
| `TURSO_DATABASE_URL` | yes | Production Turso database URL |
| `TURSO_AUTH_TOKEN` | yes | Production Turso database token |
| `JWT_SECRET` | yes | Auth tokens (`setup` generates one if the file is created) |
| `RESEND_API_KEY` | no | Verification emails |
| `APPLE_PASS_TYPE_ID`, `APPLE_TEAM_ID`, `APPLE_PASS_CERT_PEM`, `APPLE_PASS_KEY_PEM`, `APPLE_WWDR_CERT_PEM` | no | Apple Wallet |
| `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY` | no | Google Wallet |

Then check the file:

```bash
npm run doctor
```

`doctor` exits 0 only when every required key is set (not empty, and not still the example placeholder).

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
```

Deploys follow [docs/RELEASE.md](docs/RELEASE.md).

## Known issues

- `public/_headers` sets `connect-src 'self' https://api.eypi.cc`. That header is served by the Worker, not by Vite. If a local API call is blocked in the browser console under `wrangler` preview, do not change `_headers` without a follow-up; use `npm run dev:local` (Vite) for day-to-day work.
- Short-link redirects for existing slugs may 404 locally. `LINKS_KV` in `wrangler dev` is a local namespace and is often empty until backfilled.
