import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client/node'
import { createTestApp } from './createTestApp'

async function columnNames(client: Client, table: string): Promise<string[]> {
  const info = await client.execute(`PRAGMA table_info(${table})`)
  return info.rows.map((row) => String(row.name))
}

describe('0009 media migration', () => {
  it('keeps old frame slugs pointed at their campaign and drops them with the campaign', async () => {
    const { client } = await createTestApp()
    await client.execute('PRAGMA foreign_keys = ON')

    expect(await columnNames(client, 'dp_slug_history')).toEqual(['old_slug', 'campaign_id'])

    const foreignKeys = await client.execute('PRAGMA foreign_key_list(dp_slug_history)')
    expect(foreignKeys.rows).toEqual([
      expect.objectContaining({
        table: 'dp_campaigns',
        from: 'campaign_id',
        to: 'id',
        on_delete: 'CASCADE',
      }),
    ])

    await client.execute({
      sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
      args: ['user-1', 'frame@student.apc.edu.ph', 'Frame'],
    })
    await client.execute({
      sql: `INSERT INTO dp_campaigns (id, creator_id, title, frame_image_url, slug)
            VALUES (?, ?, ?, '', ?)`,
      args: ['camp-1', 'user-1', 'Camp', 'current-slug'],
    })
    await client.execute({
      sql: 'INSERT INTO dp_slug_history (old_slug, campaign_id) VALUES (?, ?)',
      args: ['old-slug', 'camp-1'],
    })

    const duplicate = await client.execute({
      sql: 'INSERT INTO dp_slug_history (old_slug, campaign_id) VALUES (?, ?)',
      args: ['old-slug', 'camp-1'],
    }).then(() => null).catch((err: unknown) => err)
    expect(duplicate).toBeInstanceOf(Error)

    await client.execute({
      sql: 'DELETE FROM dp_campaigns WHERE id = ?',
      args: ['camp-1'],
    })
    const remaining = await client.execute('SELECT old_slug FROM dp_slug_history')
    expect(remaining.rows).toEqual([])
  })
})
