import { createClient } from '@libsql/client/web'
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const backendDir = join(__dirname, '..')

function encodeLinkKvEntry(entry) {
  return JSON.stringify(entry)
}

export function diffKv(dbLinks, kvKeys) {
  const live = new Set(dbLinks)
  const present = new Set(kvKeys)
  return {
    put: [...dbLinks].filter((slug) => !present.has(slug)),
    delete: [...kvKeys].filter((slug) => !live.has(slug)),
  }
}

export function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')))
  return {
    dryRun: flags.has('--dry-run') || !flags.has('--yes'),
    reconcile: flags.has('--reconcile'),
  }
}

export function liveLinksSql(columnNames) {
  const names = new Set(columnNames)
  const filters = []
  if (names.has('disabled_at')) filters.push('disabled_at IS NULL')
  if (names.has('expires_at')) {
    filters.push("(expires_at IS NULL OR datetime(expires_at) > datetime('now'))")
  }
  const where = filters.length === 0 ? '' : ` WHERE ${filters.join(' AND ')}`
  return `SELECT id, slug, original_url FROM links${where}`
}

export function parseKvKeyList(raw) {
  const start = raw.indexOf('[')
  if (start < 0) throw new Error('KV key list did not return a JSON array.')
  const parsed = JSON.parse(raw.slice(start))
  if (!Array.isArray(parsed)) throw new Error('KV key list did not return a JSON array.')
  return parsed.map((entry, index) => {
    if (typeof entry === 'string') return entry
    if (entry && typeof entry.name === 'string') return entry.name
    throw new Error(`KV key list entry ${index} is missing a name.`)
  })
}

export function writePlan(args, diff) {
  if (args.dryRun) return { put: [], delete: [] }
  return {
    put: diff.put,
    delete: args.reconcile ? diff.delete : [],
  }
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

function invokedDirectly() {
  const entry = process.argv[1]
  if (!entry) return false
  return pathToFileURL(entry).href.toLowerCase() === import.meta.url.toLowerCase()
}

function printSlugs(label, slugs) {
  console.log(`${label} (${slugs.length}):`)
  if (slugs.length === 0) {
    console.log('  (none)')
    return
  }
  for (const slug of slugs) console.log(`  ${slug}`)
}

function listRemoteKvKeys(namespaceId) {
  const raw = execSync(
    `npx wrangler kv key list --namespace-id=${namespaceId} --remote`,
    { cwd: backendDir, encoding: 'utf8' },
  )
  return parseKvKeyList(raw)
}

function bulkPut(namespaceId, entries) {
  const bulkPath = join(backendDir, '.links-kv-backfill.json')
  writeFileSync(bulkPath, JSON.stringify(entries))
  try {
    execSync(`npx wrangler kv bulk put "${bulkPath}" --namespace-id=${namespaceId} --remote`, {
      cwd: backendDir,
      stdio: 'inherit',
    })
  } finally {
    unlinkSync(bulkPath)
  }
}

function bulkDelete(namespaceId, keys) {
  const deletePath = join(backendDir, '.links-kv-delete.json')
  writeFileSync(deletePath, JSON.stringify(keys))
  try {
    execSync(
      `npx wrangler kv bulk delete "${deletePath}" --namespace-id=${namespaceId} --remote --force`,
      { cwd: backendDir, stdio: 'inherit' },
    )
  } finally {
    unlinkSync(deletePath)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
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

The default is a dry run (print the diff, write nothing).
  --yes                 put live slugs missing from KV
  --yes --reconcile     also delete KV slugs that are not enabled, non-expired links
`)
    process.exit(1)
  }

  const db = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN })
  try {
    const namespaceId = getLinksKvNamespaceId()

    const columns = await db.execute({ sql: 'PRAGMA table_info(links)', args: [] })
    const columnNames = columns.rows.map((row) => String(row.name))
    const result = await db.execute({ sql: liveLinksSql(columnNames), args: [] })

    const dbByLower = new Map()
    for (const row of result.rows) {
      dbByLower.set(String(row.slug).toLowerCase(), row)
    }
    const kvByLower = new Map()
    for (const key of listRemoteKvKeys(namespaceId)) {
      kvByLower.set(key.toLowerCase(), key)
    }

    const diff = diffKv([...dbByLower.keys()], [...kvByLower.keys()])
    const plan = writePlan(args, diff)

    console.log(args.dryRun ? 'Dry run. No keys written.' : 'Writing LINKS_KV.')
    printSlugs('put', diff.put)
    printSlugs('delete', diff.delete)
    if (!args.reconcile && diff.delete.length > 0) {
      console.log('Stale keys were not deleted. Pass --yes --reconcile to delete them.')
    }
    if (args.dryRun) return

    if (plan.put.length === 0 && plan.delete.length === 0) {
      console.log('KV already matches the live links.')
      return
    }

    if (plan.put.length > 0) {
      bulkPut(
        namespaceId,
        plan.put.map((slug) => {
          const row = dbByLower.get(slug)
          return {
            key: slug,
            value: encodeLinkKvEntry({ id: String(row.id), url: String(row.original_url) }),
          }
        }),
      )
    }

    if (plan.delete.length > 0) {
      bulkDelete(
        namespaceId,
        plan.delete.map((slug) => kvByLower.get(slug) ?? slug),
      )
    }

    console.log(`Reconcile complete: ${plan.put.length} keys put, ${plan.delete.length} keys deleted.`)
  } finally {
    db.close()
  }
}

if (invokedDirectly()) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
