import { createClient } from '@libsql/client/web'
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const backendDir = join(__dirname, '..')

function encodeLinkKvEntry(entry) {
  return JSON.stringify(entry)
}

function stripQuotes(value) {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function loadDevVars() {
  const path = join(backendDir, '.dev.vars')
  try {
    const raw = readFileSync(path, 'utf8')
    return Object.fromEntries(
      raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const idx = line.indexOf('=')
          return [line.slice(0, idx).trim(), stripQuotes(line.slice(idx + 1))]
        }),
    )
  } catch {
    return {}
  }
}

function getLinksKvNamespaceId() {
  const wranglerPath = join(backendDir, 'wrangler.jsonc')
  const raw = readFileSync(wranglerPath, 'utf8')
  const match = raw.match(/"binding":\s*"LINKS_KV"[\s\S]*?"id":\s*"([^"]+)"/)
  if (!match?.[1]) {
    throw new Error('LINKS_KV namespace id not found in backend/wrangler.jsonc.')
  }
  return match[1]
}

const env = { ...process.env, ...loadDevVars() }
const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = env
if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
  console.error(`
Backfill needs Turso credentials locally (Worker secrets are not readable from your machine).

Option A — create backend/.dev.vars (recommended):
  1. Copy backend/.dev.vars.example → backend/.dev.vars
  2. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN (Turso dashboard → your DB → Connect)
  3. Run: npm run backfill-kv

Option B — one-off in PowerShell (same session only):
  $env:TURSO_DATABASE_URL="libsql://..."
  $env:TURSO_AUTH_TOKEN="your-new-token"
  npm run backfill-kv
`)
  process.exit(1)
}

const db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })
const namespaceId = getLinksKvNamespaceId()

const result = await db.execute({
  sql: 'SELECT id, slug, original_url FROM links',
  args: [],
})

if (result.rows.length === 0) {
  console.log('No links to backfill.')
  process.exit(0)
}

const bulkPath = join(backendDir, '.links-kv-backfill.json')
const bulk = result.rows.map((row) => {
  const { id, slug, original_url } = row
  return {
    key: slug.toLowerCase(),
    value: encodeLinkKvEntry({ id, url: original_url }),
  }
})

writeFileSync(bulkPath, JSON.stringify(bulk))

try {
  execSync(`npx wrangler kv bulk put "${bulkPath}" --namespace-id=${namespaceId} --remote`, {
    cwd: backendDir,
    stdio: 'inherit',
  })
  console.log(`Backfill complete: ${bulk.length} keys written to LINKS_KV.`)
} finally {
  unlinkSync(bulkPath)
}
