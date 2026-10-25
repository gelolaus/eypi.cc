# Release runbook

Backend before frontend. Additive migrations before both.

## 1. Before you start

On `main`, with a clean tree: `git pull`, then `npm run release:check`. It must exit 0.

## 2. Schema (only if the release includes a migration)

Apply the migration **before** deploying the backend:

```bash
cd backend
node run-migration.mjs <file>
```

Migrations must be additive or backward compatible — frontend and backend deploy at different times. Destructive migrations need explicit owner approval (`CONTEXT.md`). Record the filename and date in your release notes (outside the repo). `*.sql` stays gitignored.

## 3. Verify secret names (read-only)

These commands print names, not values.

```bash
cd backend
npx wrangler secret list --config wrangler.jsonc
```

Expect `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `RESEND_API_KEY`, plus wallet names if used.

For the frontend, after `npm run build`:

```bash
npx wrangler secret list --config dist/eypicc_frontend/wrangler.json
```

Expect `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. Confirm this list before the first release that relies on frontend click logging.

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

All targets must `PASS`.

## 8. Tag (after a good deploy, only when the owner asks to push)

```bash
git tag vYYYY.MM.DD
git push origin vYYYY.MM.DD
```

## 9. Rollback

Workers keep prior versions. Check the current command with `npx wrangler rollback --help` before use. Do not run it without owner approval.
