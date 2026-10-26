import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client/node'
import { createTestApp } from './createTestApp'

async function columnNames(client: Client, table: string): Promise<string[]> {
  const info = await client.execute(`PRAGMA table_info(${table})`)
  return info.rows.map((row) => String(row.name))
}

describe('0005 invites migration', () => {
  it('adds invited_by and declined_at on org_members', async () => {
    const { client } = await createTestApp()

    expect(await columnNames(client, 'org_members')).toEqual(expect.arrayContaining([
      'invited_by',
      'declined_at',
    ]))
  })
})
