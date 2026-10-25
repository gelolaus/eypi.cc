# eypi.cc API

Cloudflare Worker (`backend/`) serving `/api/*`. See the [root README](../README.md) for local setup.

| Command | What it does |
|---|---|
| `npm run dev` | Wrangler on `127.0.0.1:8787` (uses `backend/.dev.vars`) |
| `npm run deploy` | Deploy this Worker to production |
| `npm run backfill-kv` | Copy Turso links into `LINKS_KV` |
| `node run-migration.mjs <file>` | Apply one `.sql` file to production Turso |
| `npm run cf-typegen` | Generate Wrangler binding types |

`npm run setup` and `npm run doctor` live in the repo root. Do not commit `.dev.vars`.
