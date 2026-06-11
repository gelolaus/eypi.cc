// Apply a .sql migration to the Turso DB without needing the turso CLI.
//
// Usage (from the backend/ folder):
//   node run-migration.mjs migrations/0002_tix_tables.sql
//
// Credentials are read from environment variables, or from a local `.dev.vars`
// file (KEY=value lines) if present. You need:
//   TURSO_DATABASE_URL   — your core DB URL (Turso dashboard → your DB → "URL")
//   TURSO_AUTH_TOKEN     — a token for it   (Turso dashboard → your DB → tokens)

import { createClient } from '@libsql/client/node'
import { readFileSync, existsSync } from 'node:fs'

function loadDevVars() {
  if (!existsSync('.dev.vars')) return
  for (const line of readFileSync('.dev.vars', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

loadDevVars()

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN
const file = process.argv[2] ?? 'migrations/0002_tix_tables.sql'

if (!url || !authToken) {
  console.error('Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.')
  console.error('Set them as env vars, or put them in backend/.dev.vars')
  process.exit(1)
}

const sql = readFileSync(new URL(file, import.meta.url), 'utf8')
const client = createClient({ url, authToken })

try {
  await client.executeMultiple(sql)
  console.log(`✓ Applied ${file} to ${url}`)
} catch (e) {
  console.error('✗ Migration failed:', e)
  process.exit(1)
}
