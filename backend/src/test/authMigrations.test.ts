import { createClient, type Client } from '@libsql/client/node'
import { describe, expect, it } from 'vitest'
import { applyMigrations, createTestApp } from './createTestApp'

const PASSWORD_HASH = 'x'.repeat(60)
const THROUGH_ADDITIVE = ['0001_baseline.sql', '0002_hygiene.sql', '0003_auth_additive.sql']

async function columnNames(client: Client, table: string): Promise<string[]> {
  const info = await client.execute(`PRAGMA table_info(${table})`)
  return info.rows.map((row) => String(row.name))
}

async function linkCount(client: Client): Promise<number> {
  const result = await client.execute('SELECT COUNT(*) AS n FROM links')
  return Number(result.rows[0].n)
}

describe('auth migrations', () => {
  it('gives a fully migrated users table a role and no password_hash', async () => {
    const { client } = await createTestApp()

    const columns = await columnNames(client, 'users')

    expect(columns).toContain('role')
    expect(columns).toContain('last_login_at')
    expect(columns).toContain('disabled_at')
    expect(columns).not.toContain('password_hash')
    expect(columns).not.toContain('verification_token')
    expect(columns).not.toContain('is_verified')

    const tables = await client.execute(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('user_identities', 'sessions') ORDER BY name`,
    )
    expect(tables.rows.map((row) => row.name)).toEqual(['sessions', 'user_identities'])

    const identityColumns = await columnNames(client, 'user_identities')
    expect(identityColumns).toEqual(expect.arrayContaining([
      'provider', 'tenant_id', 'subject', 'user_id', 'email_at_link', 'created_at',
    ]))

    const sessionColumns = await columnNames(client, 'sessions')
    expect(sessionColumns).toEqual(expect.arrayContaining([
      'id', 'user_id', 'created_at', 'last_seen_at', 'expires_at', 'user_agent', 'ip_hash',
    ]))

    const indexes = await client.execute('PRAGMA index_list(sessions)')
    const indexedColumns = []
    for (const index of indexes.rows) {
      const info = await client.execute(`PRAGMA index_info(${String(index.name)})`)
      indexedColumns.push(info.rows.map((row) => String(row.name)))
    }
    expect(indexedColumns.some((columns) => columns.includes('user_id'))).toBe(true)
  })

  it('keeps a verified user link when 0004 drops password columns', async () => {
    const client = createClient({ url: ':memory:' })
    await client.execute('PRAGMA foreign_keys = ON')
    await applyMigrations(client, THROUGH_ADDITIVE)
    await client.execute({
      sql: `INSERT INTO users (id, email, password_hash, is_verified, name) VALUES (?, ?, ?, 1, ?)`,
      args: ['user-verified', 'juan@student.apc.edu.ph', PASSWORD_HASH, 'Juan'],
    })
    await client.execute({
      sql: `INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)`,
      args: ['link-kept', 'user-verified', 'https://example.com/kept', 'kept'],
    })

    const before = await linkCount(client)
    await applyMigrations(client, ['0004_auth_cleanup.sql'])
    const after = await linkCount(client)
    const columns = await columnNames(client, 'users')
    const user = await client.execute({
      sql: 'SELECT id FROM users WHERE id = ?',
      args: ['user-verified'],
    })

    expect(before).toBe(1)
    expect(after).toBe(before)
    expect(user.rows).toHaveLength(1)
    expect(columns).not.toContain('password_hash')
    expect(columns).toContain('role')
  })

  it('seeds the admin role for the APC admin email', async () => {
    const client = createClient({ url: ':memory:' })
    await applyMigrations(client, ['0001_baseline.sql', '0002_hygiene.sql'])
    await client.execute({
      sql: `INSERT INTO users (id, email, password_hash, is_verified, name) VALUES (?, ?, ?, 1, ?)`,
      args: ['user-admin', 'arlaus@student.apc.edu.ph', PASSWORD_HASH, 'Angelo'],
    })

    await applyMigrations(client, ['0003_auth_additive.sql'])

    const result = await client.execute({
      sql: 'SELECT role FROM users WHERE email = ?',
      args: ['arlaus@student.apc.edu.ph'],
    })
    expect(result.rows[0].role).toBe('admin')
  })
})
