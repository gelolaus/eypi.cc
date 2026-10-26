import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isDestructive, planMigrations, preflightProblems, splitStatements } from './migrate.mjs'

function sha256(sql) {
  return createHash('sha256').update(sql, 'utf8').digest('hex')
}

describe('planMigrations', () => {
  it('returns pending files in numeric order', () => {
    const files = [
      { name: '10_later.sql', sql: 'SELECT 10;' },
      { name: '0002_hygiene.sql', sql: 'SELECT 2;' },
      { name: '9_mid.sql', sql: 'SELECT 9;' },
    ]
    const { pending, mismatched } = planMigrations(files, [])
    expect(pending.map((file) => [file.version, file.name])).toEqual([
      ['0002', '0002_hygiene.sql'],
      ['9', '9_mid.sql'],
      ['10', '10_later.sql'],
    ])
    expect(mismatched).toEqual([])
  })

  it('reports a checksum mismatch for an applied file whose SQL changed', () => {
    const originalSql = 'SELECT 1;'
    const applied = [{ version: '0001', checksum: sha256(originalSql) }]
    const changed = planMigrations(
      [{ name: '0001_baseline.sql', sql: 'SELECT 2;' }],
      applied,
    )
    expect(changed.pending).toEqual([])
    expect(changed.mismatched).toEqual([
      {
        version: '0001',
        name: '0001_baseline.sql',
        appliedChecksum: sha256(originalSql),
        fileChecksum: sha256('SELECT 2;'),
      },
    ])

    const unchanged = planMigrations(
      [{ name: '0001_baseline.sql', sql: originalSql }],
      applied,
    )
    expect(unchanged.pending).toEqual([])
    expect(unchanged.mismatched).toEqual([])
  })
})

describe('isDestructive', () => {
  it('treats DROP TABLE as destructive', () => {
    expect(isDestructive('DROP TABLE x')).toBe(true)
    expect(isDestructive('DROP TABLE IF EXISTS board_boards')).toBe(true)
  })

  it('treats DELETE FROM without WHERE as destructive', () => {
    expect(isDestructive('DELETE FROM x')).toBe(true)
  })

  it('treats DELETE FROM with WHERE as destructive', () => {
    expect(isDestructive('DELETE FROM x WHERE id=1')).toBe(true)
    expect(isDestructive('-- clean up\nDELETE FROM users\nWHERE id IS NULL')).toBe(true)
  })

  it('treats ALTER TABLE ... DROP COLUMN as destructive', () => {
    expect(isDestructive('ALTER TABLE users DROP COLUMN password_hash')).toBe(true)
    expect(isDestructive('alter table users\n  drop column is_verified')).toBe(true)
  })

  it('treats UPDATE without WHERE as destructive and UPDATE with WHERE as safe', () => {
    expect(isDestructive("UPDATE users SET role = 'user'")).toBe(true)
    expect(isDestructive("UPDATE users SET role = 'admin' WHERE id = 1")).toBe(false)
  })

  it('does not flag additive statements', () => {
    expect(isDestructive('ALTER TABLE users ADD COLUMN role TEXT')).toBe(false)
    expect(isDestructive('CREATE INDEX idx ON users(email)')).toBe(false)
  })
})

describe('splitStatements', () => {
  it('keeps a CREATE TRIGGER … BEGIN …; END; as one statement', () => {
    const sql = `
CREATE TABLE users (email TEXT);
CREATE TRIGGER enforce_apc_email_insert
BEFORE INSERT ON users
FOR EACH ROW
WHEN (NEW.email NOT LIKE '%@student.apc.edu.ph' AND NEW.email NOT LIKE '%@apc.edu.ph')
BEGIN
    SELECT RAISE(ABORT, 'Database Error: Only APC emails are permitted.');
END;
CREATE INDEX idx_events_slug ON events(slug);
`
    const parts = splitStatements(sql)
    expect(parts).toHaveLength(3)
    expect(parts[1]).toBe(`CREATE TRIGGER enforce_apc_email_insert
BEFORE INSERT ON users
FOR EACH ROW
WHEN (NEW.email NOT LIKE '%@student.apc.edu.ph' AND NEW.email NOT LIKE '%@apc.edu.ph')
BEGIN
    SELECT RAISE(ABORT, 'Database Error: Only APC emails are permitted.');
END`)
    expect(parts[2]).toBe('CREATE INDEX idx_events_slug ON events(slug)')
  })
})

describe('preflight for 0007 attendee email index', () => {
  async function clientBefore0007() {
    const { createClient } = await import('@libsql/client/node')
    const client = createClient({ url: ':memory:' })
    await client.execute('PRAGMA foreign_keys = OFF')
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
    for (const name of readdirSync(dir).filter((file) => file < '0007').sort()) {
      await client.executeMultiple(readFileSync(join(dir, name), 'utf8'))
    }
    return client
  }

  async function addAttendee(client, id, eventId, email) {
    await client.execute({
      sql: 'INSERT INTO attendees (id, event_id, first_name, email, qr_token) VALUES (?, ?, ?, ?, ?)',
      args: [id, eventId, 'A', email, `token-${id}`],
    })
  }

  it('reports duplicate event and lowercased email pairs without printing the emails', async () => {
    const client = await clientBefore0007()
    await addAttendee(client, 'a1', 'event-1', 'Ada@student.apc.edu.ph')
    await addAttendee(client, 'a2', 'event-1', 'ada@student.apc.edu.ph')
    await addAttendee(client, 'a3', 'event-2', 'ada@student.apc.edu.ph')

    const problems = await preflightProblems(client, [{ version: '0007', name: '0007_tix.sql' }])

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('0007_tix.sql')
    expect(problems[0]).toContain('event-1')
    expect(problems[0]).toContain('RELEASE.md')
    expect(problems[0]).not.toContain('ada@')
    expect(problems[0]).not.toContain('event-2')
  })

  it('passes when every email is unique per event, and ignores other versions', async () => {
    const client = await clientBefore0007()
    await addAttendee(client, 'a1', 'event-1', 'ada@student.apc.edu.ph')
    await addAttendee(client, 'a2', 'event-2', 'ada@student.apc.edu.ph')

    expect(await preflightProblems(client, [{ version: '0007', name: '0007_tix.sql' }])).toEqual([])
    await addAttendee(client, 'a3', 'event-2', 'ADA@student.apc.edu.ph')
    expect(await preflightProblems(client, [{ version: '0008', name: '0008_admin_legal.sql' }])).toEqual([])
  })
})
