import { describe, expect, it } from 'vitest'
import { createTestApp } from './createTestApp'

describe('0013 user avatar migration', () => {
  it('adds nullable avatar columns that existing users read as null', async () => {
    const { client } = await createTestApp()
    await client.execute({
      sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
      args: ['user-1', 'avatar@student.apc.edu.ph', 'Avatar'],
    })

    const info = await client.execute('PRAGMA table_info(users)')
    for (const name of ['avatar_icon', 'avatar_color']) {
      const column = info.rows.find((row) => row.name === name)
      expect(column).toBeDefined()
      expect(Number(column?.notnull)).toBe(0)
      expect(column?.dflt_value).toBeNull()
    }

    const user = await client.execute("SELECT avatar_icon, avatar_color FROM users WHERE id = 'user-1'")
    expect(user.rows[0]?.avatar_icon).toBeNull()
    expect(user.rows[0]?.avatar_color).toBeNull()
  })
})
