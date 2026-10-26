import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client/node'
import { createTestApp } from './createTestApp'

async function columnInfo(client: Client, table: string) {
  const info = await client.execute(`PRAGMA table_info(${table})`)
  return info.rows.map((row) => ({
    name: String(row.name),
    notnull: Number(row.notnull),
    pk: Number(row.pk),
  }))
}

describe('0008 admin legal migration', () => {
  it('creates audit_events and legal_consents with the consent key and indexes', async () => {
    const { client } = await createTestApp()

    const audit = await columnInfo(client, 'audit_events')
    expect(audit.map((column) => column.name)).toEqual([
      'id',
      'actor_user_id',
      'action',
      'target_type',
      'target_id',
      'meta',
      'created_at',
    ])
    expect(audit.find((column) => column.name === 'id')?.pk).toBe(1)
    expect(audit.find((column) => column.name === 'actor_user_id')?.notnull).toBe(1)
    expect(audit.find((column) => column.name === 'action')?.notnull).toBe(1)
    expect(audit.find((column) => column.name === 'created_at')?.notnull).toBe(1)

    const consents = await columnInfo(client, 'legal_consents')
    expect(consents.map((column) => column.name)).toEqual([
      'id',
      'user_id',
      'document',
      'version',
      'accepted_at',
      'ip_hash',
      'user_agent',
    ])
    expect(consents.find((column) => column.name === 'user_id')?.notnull).toBe(1)
    expect(consents.find((column) => column.name === 'document')?.notnull).toBe(1)
    expect(consents.find((column) => column.name === 'version')?.notnull).toBe(1)
    expect(consents.find((column) => column.name === 'accepted_at')?.notnull).toBe(1)

    const consentFk = await client.execute('PRAGMA foreign_key_list(legal_consents)')
    expect(consentFk.rows).toHaveLength(1)
    expect(String(consentFk.rows[0]?.table)).toBe('users')
    expect(String(consentFk.rows[0]?.from)).toBe('user_id')
    expect(String(consentFk.rows[0]?.on_delete).toUpperCase()).toBe('CASCADE')

    const auditFk = await client.execute('PRAGMA foreign_key_list(audit_events)')
    expect(auditFk.rows).toHaveLength(0)

    const indexes = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_audit_events_created_at', 'idx_legal_consents_user_id') ORDER BY name",
    )
    expect(indexes.rows.map((row) => String(row.name))).toEqual([
      'idx_audit_events_created_at',
      'idx_legal_consents_user_id',
    ])
  })

  it('rejects a duplicate user, document, and version', async () => {
    const { client } = await createTestApp()
    await client.execute({
      sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
      args: ['ada-id', 'ada@apc.edu.ph', 'Ada'],
    })
    await client.execute({
      sql: `INSERT INTO legal_consents (id, user_id, document, version) VALUES (?, ?, ?, ?)`,
      args: ['consent-1', 'ada-id', 'privacy', '2026-11-01'],
    })

    await expect(client.execute({
      sql: `INSERT INTO legal_consents (id, user_id, document, version) VALUES (?, ?, ?, ?)`,
      args: ['consent-2', 'ada-id', 'privacy', '2026-11-01'],
    })).rejects.toThrow()
  })

  it('cascades legal consents and keeps the audit row when the user is deleted', async () => {
    const { client } = await createTestApp()
    await client.execute('PRAGMA foreign_keys = ON')
    await client.execute({
      sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
      args: ['ada-id', 'ada@apc.edu.ph', 'Ada'],
    })
    await client.execute({
      sql: `INSERT INTO legal_consents (id, user_id, document, version) VALUES (?, ?, ?, ?)`,
      args: ['consent-1', 'ada-id', 'privacy', '2026-11-01'],
    })
    await client.execute({
      sql: `INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, meta)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: ['audit-1', 'ada-id', 'org.transfer', 'organization', 'org-1', '{"from":"a"}'],
    })

    await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: ['ada-id'] })

    const consents = await client.execute('SELECT COUNT(*) AS n FROM legal_consents')
    const audits = await client.execute('SELECT actor_user_id, action FROM audit_events')
    expect(Number(consents.rows[0]?.n)).toBe(0)
    expect(audits.rows).toHaveLength(1)
    expect(String(audits.rows[0]?.actor_user_id)).toBe('ada-id')
    expect(String(audits.rows[0]?.action)).toBe('org.transfer')
  })
})
