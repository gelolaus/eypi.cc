import { describe, expect, it } from 'vitest'
import type { Client, Row } from '@libsql/client/node'
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
  email: 'Member@student.apc.edu.ph',
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

function ids(rows: Row[]): string[] {
  return rows.map((row) => String(row.org_id))
}

describe('PATCH /api/orgs/admin/:id slug rename', () => {
  it('repoints members, events, and campaigns onto the new org id with foreign keys on', async () => {
    const { client, request } = await createTestApp({
      user: admin,
      seed: async (db) => {
        await enableForeignKeys(db)
        await insertUser(db, admin)
        await insertUser(db, owner)
        await insertUser(db, member)
        await db.execute({
          sql: `INSERT INTO organizations (
                  id, name, owner_id, created_at, is_public_catalog, tagline,
                  about_markdown, banner_url, logo_url, social_links, org_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            'jpcs',
            'Junior Philippine Computer Society',
            owner.id,
            '2026-01-01 00:00:00',
            1,
            'Build things',
            'About the org',
            'https://cdn.example/banner.png',
            'https://cdn.example/logo.png',
            '{"website":"https://jpcs.example"}',
            'special_interest',
          ],
        })
        await db.execute({
          sql: `INSERT INTO org_members (org_id, email, user_id, activated_at)
                VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
          args: [
            'jpcs', owner.email, owner.id, '2026-01-02T00:00:00.000Z',
            'jpcs', member.email, member.id, '2026-01-03T00:00:00.000Z',
          ],
        })
        await db.execute({
          sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id)
                VALUES (?, ?, ?, ?, '2026-11-01', '09:00', 'Hall', ?)`,
          args: ['event-1', 'general-assembly', owner.id, 'General assembly', 'jpcs'],
        })
        await db.execute({
          sql: `INSERT INTO dp_campaigns (id, creator_id, title, frame_image_url, slug, org_id)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: ['camp-1', owner.id, 'Frame', 'https://cdn.example/frame.png', 'jpcs-frame', 'jpcs'],
        })
      },
    })

    const res = await request('/api/orgs/admin/jpcs', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
      },
      body: JSON.stringify({ id: 'jpcs-new' }),
    })
    const body = await res.json() as { org?: { org_id?: string; org_name?: string } }

    expect(res.status, JSON.stringify(body)).toBe(200)
    expect(body.org?.org_id).toBe('jpcs-new')
    expect(body.org?.org_name).toBe('Junior Philippine Computer Society')

    const orgs = await client.execute('SELECT id, name, owner_id, tagline, is_public_catalog, org_type FROM organizations')
    expect(orgs.rows.map((row) => String(row.id))).toEqual(['jpcs-new'])
    expect(orgs.rows[0]).toMatchObject({
      name: 'Junior Philippine Computer Society',
      owner_id: owner.id,
      tagline: 'Build things',
      is_public_catalog: 1,
      org_type: 'special_interest',
    })

    const members = await client.execute('SELECT org_id FROM org_members ORDER BY email')
    const events = await client.execute('SELECT org_id FROM events')
    const campaigns = await client.execute('SELECT org_id FROM dp_campaigns')
    expect(ids(members.rows)).toEqual(['jpcs-new', 'jpcs-new'])
    expect(ids(events.rows)).toEqual(['jpcs-new'])
    expect(ids(campaigns.rows)).toEqual(['jpcs-new'])
  })
})

describe('POST /api/orgs/:id/transfer', () => {
  it('transfers to a member whose stored email differs in case', async () => {
    const { client, request } = await createTestApp({
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

    const res = await request('/api/orgs/jpcs/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
      },
      body: JSON.stringify({ targetEmail: member.email.toLowerCase() }),
    })

    expect(res.status).toBe(200)
    const orgs = await client.execute({
      sql: 'SELECT owner_id FROM organizations WHERE id = ?',
      args: ['jpcs'],
    })
    expect(String(orgs.rows[0]?.owner_id)).toBe(member.id)
  })
})

describe('DELETE /api/orgs/:id/members', () => {
  it('removes a member stored with mixed-case email when that email is sent', async () => {
    const { client, request } = await createTestApp({
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

    const res = await request('/api/orgs/jpcs/members', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
      },
      body: JSON.stringify({ email: member.email }),
    })

    expect(res.status).toBe(200)
    const remaining = await client.execute({
      sql: 'SELECT email FROM org_members WHERE org_id = ? AND lower(email) = lower(?)',
      args: ['jpcs', member.email],
    })
    expect(remaining.rows).toEqual([])
  })
})

describe('POST /api/orgs/:id/leave', () => {
  it('matches the session email with lower()', async () => {
    const { client, request } = await createTestApp({
      user: member,
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

    const res = await request('/api/orgs/jpcs/leave', {
      method: 'POST',
      headers: { Origin: ORIGIN },
    })

    expect(res.status).toBe(200)
    const remaining = await client.execute({
      sql: 'SELECT email FROM org_members WHERE org_id = ? AND lower(email) = lower(?)',
      args: ['jpcs', member.email],
    })
    expect(remaining.rows).toEqual([])
  })
})
