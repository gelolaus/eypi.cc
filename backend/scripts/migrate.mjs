import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const backendDir = dirname(fileURLToPath(new URL('..', import.meta.url)))
const migrationsDir = join(backendDir, 'migrations')

const LEDGER_DDL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`

export function checksum(sql) {
  return createHash('sha256').update(sql, 'utf8').digest('hex')
}

export function versionOf(name) {
  const match = /^(\d+)/.exec(name)
  if (!match) throw new Error(`Migration file name must start with a version number: ${name}`)
  return match[1]
}

export function planMigrations(files, applied) {
  const appliedByVersion = new Map(applied.map((row) => [row.version, row]))
  const sorted = [...files].sort((a, b) => {
    const delta = Number(versionOf(a.name)) - Number(versionOf(b.name))
    if (delta !== 0) return delta
    if (a.name < b.name) return -1
    if (a.name > b.name) return 1
    return 0
  })

  const pending = []
  const mismatched = []
  for (const file of sorted) {
    const version = versionOf(file.name)
    const fileChecksum = checksum(file.sql)
    const row = appliedByVersion.get(version)
    if (!row) {
      pending.push({ name: file.name, sql: file.sql, version, checksum: fileChecksum })
      continue
    }
    if (row.checksum !== fileChecksum) {
      mismatched.push({
        version,
        name: file.name,
        appliedChecksum: row.checksum,
        fileChecksum,
      })
    }
  }
  return { pending, mismatched }
}

function sqlWithoutLeadingComments(stmt) {
  let sql = stmt.trim()
  for (;;) {
    if (sql.startsWith('--')) {
      const nl = sql.indexOf('\n')
      sql = (nl === -1 ? '' : sql.slice(nl + 1)).trim()
      continue
    }
    if (sql.startsWith('/*')) {
      const end = sql.indexOf('*/')
      sql = (end === -1 ? '' : sql.slice(end + 2)).trim()
      continue
    }
    return sql
  }
}

export function isDestructive(stmt) {
  const sql = sqlWithoutLeadingComments(stmt)
  if (/^DROP\s+TABLE\b/i.test(sql)) return true
  if (/^ALTER\s+TABLE\b[\s\S]*\bDROP\s+COLUMN\b/i.test(sql)) return true
  if (/^DELETE\s+FROM\b/i.test(sql)) return true
  if (/^UPDATE\b/i.test(sql) && !/\bWHERE\b/i.test(sql)) return true
  return false
}

// Read-only checks that run before a version is applied. A failing check stops the
// runner with a message that names what to fix by hand. Emails are never printed.
const PREFLIGHTS = {
  '0007': {
    table: 'attendees',
    sql: `SELECT event_id, COUNT(*) AS n FROM attendees
          GROUP BY event_id, lower(email) HAVING COUNT(*) > 1`,
    message: (rows) => {
      const events = [...new Set(rows.map((row) => String(row.event_id)))]
      return `${rows.length} duplicate (event_id, lower(email)) group(s) in attendees, in event(s): ${events.join(', ')}. ` +
        'The unique index in 0007 would fail. Resolve the duplicates by hand, then re-run. ' +
        'See docs/RELEASE.md section 10.2 for the read-only query.'
    },
  },
}

export async function preflightProblems(client, files) {
  const problems = []
  for (const file of files) {
    const check = PREFLIGHTS[versionOf(file.name)]
    if (!check) continue
    // A fresh database has no table yet; the migration that creates it is also pending.
    if (check.table) {
      const found = await client.execute({ sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", args: [check.table] })
      if (found.rows.length === 0) continue
    }
    const result = await client.execute(check.sql)
    if (result.rows.length > 0) problems.push(`Preflight failed for ${file.name}: ${check.message(result.rows)}`)
  }
  return problems
}

export function splitStatements(sql) {
  const statements = []
  let current = ''
  let inString = false
  let depth = 0
  let i = 0

  while (i < sql.length) {
    const c = sql[i]
    const next = sql[i + 1]

    if (!inString && c === '-' && next === '-') {
      const end = sql.indexOf('\n', i)
      const chunk = end === -1 ? sql.slice(i) : sql.slice(i, end + 1)
      current += chunk
      i += chunk.length
      continue
    }

    if (!inString && c === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2)
      const chunk = end === -1 ? sql.slice(i) : sql.slice(i, end + 2)
      current += chunk
      i += chunk.length
      continue
    }

    if (c === "'") {
      if (inString && next === "'") {
        current += "''"
        i += 2
        continue
      }
      inString = !inString
      current += c
      i += 1
      continue
    }

    if (!inString && /[A-Za-z_]/.test(c)) {
      const word = /^[A-Za-z_]+/.exec(sql.slice(i))[0]
      const upper = word.toUpperCase()
      if (upper === 'BEGIN') depth += 1
      else if (upper === 'END' && depth > 0) depth -= 1
      current += word
      i += word.length
      continue
    }

    if (!inString && c === ';' && depth === 0) {
      const stmt = current.trim()
      if (stmt) statements.push(stmt)
      current = ''
      i += 1
      continue
    }

    current += c
    i += 1
  }

  const tail = current.trim()
  if (tail) statements.push(tail)
  return statements
}

function databaseHost(url) {
  try {
    const parsed = new URL(url)
    return parsed.hostname || parsed.protocol.replace(':', '')
  } catch {
    return '(unreadable url)'
  }
}

function loadDevVars() {
  const path = join(backendDir, '.dev.vars')
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
      || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1)
    }
    if (!key || process.env[key]) continue
    process.env[key] = value
  }
}

function readMigrationFiles() {
  if (!existsSync(migrationsDir)) return []
  return readdirSync(migrationsDir)
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .map((name) => ({ name, sql: readFileSync(join(migrationsDir, name), 'utf8') }))
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => arg.startsWith('--')))
  return {
    status: flags.has('--status'),
    dryRun: flags.has('--dry-run'),
    yes: flags.has('--yes'),
    baseline: flags.has('--baseline'),
    allowDestructive: flags.has('--allow-destructive'),
  }
}

function destructiveStatements(file) {
  return splitStatements(file.sql).filter((stmt) => isDestructive(stmt))
}

function printPlan(host, applied, pending, args) {
  console.log(`Database: ${host}`)
  if (args.status) {
    console.log('Applied:')
    if (applied.length === 0) console.log('  (none)')
    const listed = [...applied].sort((a, b) => Number(a.version) - Number(b.version))
    for (const row of listed) console.log(`  ${row.version} ${row.name}`)
  }
  console.log('Pending:')
  if (pending.length === 0) console.log('  (none)')
  for (const file of pending) console.log(`  ${file.version} ${file.name}`)
}

async function readApplied(client) {
  const exists = await client.execute({
    sql: "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
  })
  if (exists.rows.length === 0) return []
  const result = await client.execute('SELECT version, name, checksum FROM schema_migrations')
  return result.rows.map((row) => ({
    version: String(row.version),
    name: String(row.name),
    checksum: String(row.checksum),
  }))
}

async function main() {
  loadDevVars()
  const args = parseArgs(process.argv.slice(2))
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url || !authToken) {
    console.error('Missing TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.')
    console.error('Set them as env vars, or put them in backend/.dev.vars')
    process.exit(1)
  }

  const host = databaseHost(url)
  const files = readMigrationFiles()
  const { createClient } = await import('@libsql/client/node')
  const client = createClient({ url, authToken })
  try {
    const applied = await readApplied(client)
    const plan = planMigrations(files, applied)
    printPlan(host, applied, plan.pending, args)

    if (plan.mismatched.length > 0) {
      const lines = plan.mismatched.map((row) => `  ${row.version} ${row.name}`)
      throw new Error(`Checksum mismatch. Applied SQL no longer matches the file:\n${lines.join('\n')}`)
    }

    const write = args.yes && !args.dryRun && !args.status
    const toRun = args.baseline ? plan.pending.filter((file) => file.version === '0001') : plan.pending
    if (!args.allowDestructive) {
      for (const file of toRun) {
        if (args.baseline && file.version === '0001') continue
        const hits = destructiveStatements(file)
        if (hits.length === 0) continue
        const detail = `Refusing destructive statement in ${file.name} without --allow-destructive:\n${hits[0]}`
        if (write) throw new Error(detail)
        console.log(detail)
      }
    }

    if (!args.baseline) {
      const problems = await preflightProblems(client, plan.pending)
      if (problems.length > 0) {
        if (write) throw new Error(problems.join('\n'))
        for (const problem of problems) console.log(problem)
      }
    }

    if (!write) {
      if (args.baseline) console.log('Baseline would record 0001 without executing SQL. Re-run with --baseline --yes.')
      else if (!args.status) console.log('Dry run. Re-run with --yes to apply.')
      return
    }

    await client.execute(LEDGER_DDL)

    if (args.baseline) {
      if (!files.some((file) => versionOf(file.name) === '0001')) {
        throw new Error('0001 baseline migration file is missing.')
      }
      const file = toRun[0]
      if (!file) {
        console.log('0001 is already recorded.')
        return
      }
      await client.batch([
        {
          sql: 'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)',
          args: [file.version, file.name, file.checksum],
        },
      ], 'write')
      console.log('Recorded 0001 without executing SQL.')
      return
    }

    for (const file of plan.pending) {
      const statements = splitStatements(file.sql).map((sql) => ({ sql }))
      statements.push({
        sql: 'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)',
        args: [file.version, file.name, file.checksum],
      })
      await client.batch(statements, 'write')
      console.log(`Applied ${file.name}`)
    }
  } finally {
    client.close()
  }
}

function invokedDirectly() {
  const entry = process.argv[1]
  if (!entry) return false
  return pathToFileURL(entry).href.toLowerCase() === import.meta.url.toLowerCase()
}

if (invokedDirectly()) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
