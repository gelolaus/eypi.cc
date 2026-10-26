# eypi.cc API

Cloudflare Worker (`backend/`) serving `/api/*`. See the [root README](../README.md) for local setup.

| Command | What it does |
|---|---|
| `npm run dev` | Wrangler on `127.0.0.1:8787` (uses `backend/.dev.vars`) |
| `npm run deploy` | Deploy this Worker to production (owner only) |
| `npm run migrate -- --status` | Show applied and pending SQL in `migrations/`. Add `--dry-run`, then `--yes` to apply. See [docs/operations.md](../docs/operations.md#migration-runner) |
| `npm run backfill-kv` | Dry run of copying Turso links into `LINKS_KV`. Add `--yes`, and `--reconcile` to delete stale keys |
| `npm run cf-typegen` | Generate Wrangler binding types |

`npm run setup` and `npm run doctor` live in the repo root. Do not commit `.dev.vars`.
