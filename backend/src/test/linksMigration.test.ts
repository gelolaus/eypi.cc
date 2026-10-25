import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client/node'
import { createTestApp } from './createTestApp'

async function columnNames(client: Client, table: string): Promise<string[]> {
  const info = await client.execute(`PRAGMA table_info(${table})`)
  return info.rows.map((row) => String(row.name))
}

describe('0006 links migration', () => {
  it('adds expiry, protection, click source, and link reports', async () => {
    const { client } = await createTestApp()

    expect(await columnNames(client, 'links')).toEqual(expect.arrayContaining([
      'expires_at',
      'disabled_at',
      'disabled_reason',
      'password_hash',
      'updated_at',
    ]))
    expect(await columnNames(client, 'analytics')).toEqual(expect.arrayContaining([
      'visitor_hash',
      'source',
    ]))

    const reports = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'link_reports'",
    )
    expect(reports.rows).toHaveLength(1)
    expect(await columnNames(client, 'link_reports')).toEqual(expect.arrayContaining([
      'id',
      'link_id',
      'slug',
      'reason',
      'details',
      'reporter_ip_hash',
      'reporter_user_id',
      'created_at',
      'resolved_at',
      'resolved_by',
      'resolution',
    ]))
  })
})
