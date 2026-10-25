import { describe, expect, it } from 'vitest'
import { createTestApp } from '../../test/createTestApp'
import { resolveUser } from './identity'

const APC_TENANT = 'aeb745e6-8166-4f8f-9233-179e8109c49e'

describe('resolveUser', () => {
  it('links legacy user juan@student.apc.edu.ph to a new oid and keeps that user id', async () => {
    const { client } = await createTestApp({
      seed: async (db) => {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
          args: ['user-juan', 'juan@student.apc.edu.ph', 'Juan'],
        })
        await db.execute({
          sql: 'INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)',
          args: ['link-juan', 'user-juan', 'https://example.com/juan', 'juan'],
        })
      },
    })

    const result = await resolveUser(client, {
      tid: APC_TENANT,
      oid: 'oid-juan-new',
      email: 'Juan@student.apc.edu.ph',
      name: 'Juan',
    })

    expect(result).toEqual({ userId: 'user-juan', created: false })

    const identities = await client.execute({
      sql: `SELECT provider, tenant_id, subject, user_id
            FROM user_identities
            WHERE provider = 'microsoft' AND tenant_id = ? AND subject = ?`,
      args: [APC_TENANT, 'oid-juan-new'],
    })
    expect(identities.rows).toHaveLength(1)
    expect(identities.rows[0]).toMatchObject({
      provider: 'microsoft',
      tenant_id: APC_TENANT,
      subject: 'oid-juan-new',
      user_id: 'user-juan',
    })

    const users = await client.execute('SELECT id FROM users')
    expect(users.rows).toHaveLength(1)

    const link = await client.execute({
      sql: 'SELECT user_id FROM links WHERE id = ?',
      args: ['link-juan'],
    })
    expect(link.rows[0]?.user_id).toBe('user-juan')
  })

  it('updates users.email when the same oid signs in with a changed email', async () => {
    const { client } = await createTestApp()

    const first = await resolveUser(client, {
      tid: APC_TENANT,
      oid: 'oid-ada',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
    })
    const second = await resolveUser(client, {
      tid: APC_TENANT,
      oid: 'oid-ada',
      email: 'Ada.Lovelace@apc.edu.ph',
      name: 'Ada Lovelace',
    })

    expect(second.userId).toBe(first.userId)
    expect(second.created).toBe(false)

    const users = await client.execute('SELECT id, email, name FROM users')
    expect(users.rows).toHaveLength(1)
    expect(users.rows[0]).toMatchObject({
      id: first.userId,
      email: 'ada.lovelace@apc.edu.ph',
      name: 'Ada Lovelace',
    })

    const identities = await client.execute({
      sql: `SELECT user_id FROM user_identities WHERE provider = 'microsoft' AND subject = ?`,
      args: ['oid-ada'],
    })
    expect(identities.rows).toHaveLength(1)
    expect(identities.rows[0]?.user_id).toBe(first.userId)
  })

  it('creates a user with role user for a new email', async () => {
    const { client } = await createTestApp()

    const result = await resolveUser(client, {
      tid: APC_TENANT,
      oid: 'oid-new',
      email: 'New.Student@student.apc.edu.ph',
      name: 'New Student',
    })

    expect(result.created).toBe(true)
    expect(result.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)

    const users = await client.execute({
      sql: 'SELECT id, email, name, role, last_login_at FROM users WHERE id = ?',
      args: [result.userId],
    })
    expect(users.rows).toHaveLength(1)
    expect(users.rows[0]).toMatchObject({
      id: result.userId,
      email: 'new.student@student.apc.edu.ph',
      name: 'New Student',
      role: 'user',
    })
    expect(users.rows[0]?.last_login_at).toBeTruthy()
  })
})
