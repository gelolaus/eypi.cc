import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client/node'
import { createTestApp, type TestUser } from '../test/createTestApp'

const ORIGIN = 'https://eypi.cc'

const admin: TestUser = {
  id: 'admin-1',
  email: 'admin@apc.edu.ph',
  name: 'Admin Ana',
  role: 'admin',
}

const owner: TestUser = {
  id: 'owner-1',
  email: 'owner@apc.edu.ph',
  name: 'Owner Omar',
  role: 'user',
}

const member: TestUser = {
  id: 'member-1',
  email: 'member@student.apc.edu.ph',
  name: 'Member Bea',
  role: 'user',
}

async function insertUser(client: Client, user: TestUser) {
  await client.execute({
    sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
    args: [user.id, user.email, user.name, user.role],
  })
}

async function enableForeignKeys(client: Client) {
  await client.execute('PRAGMA foreign_keys = ON')
  const pragma = await client.execute('PRAGMA foreign_keys')
  expect(Number(pragma.rows[0]?.foreign_keys)).toBe(1)
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
    },
    body: JSON.stringify(body),
  }
}

async function auditRows(
  client: Client,
  action: string,
): Promise<{ actor_user_id: string; target_type: string; target_id: string; meta: string | null }[]> {
  const result = await client.execute({
    sql: `SELECT actor_user_id, target_type, target_id, meta
          FROM audit_events WHERE action = ? ORDER BY created_at, id`,
    args: [action],
  })
  return result.rows.map((row) => ({
    actor_user_id: String(row.actor_user_id ?? ''),
    target_type: String(row.target_type ?? ''),
    target_id: String(row.target_id ?? ''),
    meta: row.meta == null ? null : String(row.meta),
  }))
}

describe('org audit trail', () => {
  it('audits organization creation', async () => {
    const { request, client } = await createTestApp({
      user: admin,
      seed: async (db) => {
        await enableForeignKeys(db)
        await insertUser(db, admin)
        await insertUser(db, owner)
      },
    })

    const res = await request('/api/orgs', json('POST', {
      id: 'new-org',
      name: 'New Org',
      ownerEmail: owner.email,
    }))
    expect(res.status).toBe(201)

    const audits = await auditRows(client, 'org.create')
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({
      actor_user_id: admin.id,
      target_type: 'organization',
      target_id: 'new-org',
    })
    expect(JSON.parse(audits[0].meta ?? '{}')).toMatchObject({
      name: 'New Org',
      ownerId: owner.id,
    })
  })

  it('audits renames and ownership transfers through the admin patch', async () => {
    const { request, client } = await createTestApp({
      user: admin,
      seed: async (db) => {
        await enableForeignKeys(db)
        await insertUser(db, admin)
        await insertUser(db, owner)
        await insertUser(db, member)
        await db.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
          args: ['jpcs', 'JPCS', owner.id],
        })
        await db.execute({
          sql: `INSERT INTO org_members (org_id, email, user_id, activated_at)
                VALUES (?, ?, ?, ?)`,
          args: ['jpcs', member.email, member.id, '2026-01-03T00:00:00.000Z'],
        })
      },
    })

    const renamed = await request('/api/orgs/admin/jpcs', json('PATCH', {
      id: 'jpcs-new',
      name: 'JPCS Renamed',
    }))
    expect(renamed.status).toBe(200)

    const updates = await auditRows(client, 'org.update')
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({
      actor_user_id: admin.id,
      target_type: 'organization',
      target_id: 'jpcs-new',
    })
    expect(JSON.parse(updates[0].meta ?? '{}')).toMatchObject({
      name: { from: 'JPCS', to: 'JPCS Renamed' },
      slug: { from: 'jpcs', to: 'jpcs-new' },
    })

    const transferred = await request('/api/orgs/admin/jpcs-new', json('PATCH', {
      ownerEmail: member.email,
    }))
    expect(transferred.status).toBe(200)

    // A pure owner change is a transfer, not a rename.
    expect(await auditRows(client, 'org.update')).toHaveLength(1)
    const transfers = await auditRows(client, 'org.transfer')
    expect(transfers).toHaveLength(1)
    expect(transfers[0]).toMatchObject({
      actor_user_id: admin.id,
      target_type: 'organization',
      target_id: 'jpcs-new',
    })
    expect(JSON.parse(transfers[0].meta ?? '{}')).toEqual({ from: owner.id, to: member.id })
  })

  it('audits an owner-initiated transfer', async () => {
    const { request, client } = await createTestApp({
      user: owner,
      seed: async (db) => {
        await enableForeignKeys(db)
        await insertUser(db, owner)
        await insertUser(db, member)
        await db.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
          args: ['jpcs', 'JPCS', owner.id],
        })
        await db.execute({
          sql: `INSERT INTO org_members (org_id, email, user_id, activated_at)
                VALUES (?, ?, ?, ?)`,
          args: ['jpcs', member.email, member.id, '2026-01-03T00:00:00.000Z'],
        })
      },
    })

    const res = await request('/api/orgs/jpcs/transfer', json('POST', { targetEmail: member.email }))
    expect(res.status).toBe(200)

    const transfers = await auditRows(client, 'org.transfer')
    expect(transfers).toHaveLength(1)
    expect(transfers[0]).toMatchObject({
      actor_user_id: owner.id,
      target_type: 'organization',
      target_id: 'jpcs',
    })
    expect(JSON.parse(transfers[0].meta ?? '{}')).toEqual({ from: owner.id, to: member.id })
  })

  it('audits organization deletion and skips audits when deletion is refused', async () => {
    const { request, client } = await createTestApp({
      user: admin,
      seed: async (db) => {
        await enableForeignKeys(db)
        await insertUser(db, admin)
        await insertUser(db, owner)
        await db.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?), (?, ?, ?)',
          args: ['empty', 'Empty Org', owner.id, 'busy', 'Busy Org', owner.id],
        })
        await db.execute({
          sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id)
                VALUES (?, ?, ?, ?, '2026-11-01', '09:00', 'Hall', ?)`,
          args: ['event-1', 'general-assembly', owner.id, 'General assembly', 'busy'],
        })
      },
    })

    const refused = await request('/api/orgs/admin/busy', { method: 'DELETE', headers: { Origin: ORIGIN } })
    expect(refused.status).toBe(409)
    expect(await auditRows(client, 'org.delete')).toHaveLength(0)

    const deleted = await request('/api/orgs/admin/empty', { method: 'DELETE', headers: { Origin: ORIGIN } })
    expect(deleted.status).toBe(200)

    const audits = await auditRows(client, 'org.delete')
    expect(audits).toHaveLength(1)
    expect(audits[0]).toMatchObject({
      actor_user_id: admin.id,
      target_type: 'organization',
      target_id: 'empty',
    })
    expect(JSON.parse(audits[0].meta ?? '{}')).toEqual({ name: 'Empty Org' })
  })
})
