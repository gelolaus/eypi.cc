import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp, type TestUser } from '../test/createTestApp'

const ORG_NOT_ACCESSIBLE = {
  error: {
    code: 'org_not_accessible',
    message: 'You do not have access to that organization.',
  },
}

const NO_ORG = {
  error: {
    code: 'no_org',
    message: 'You need an active organization membership to continue.',
  },
  action_url: '/invites',
}

const userU: TestUser = {
  id: 'user-u',
  email: 'u@student.apc.edu.ph',
  name: 'User U',
  role: 'user',
}

async function insertUser(client: Client, id: string, email: string, name: string) {
  await client.execute({
    sql: `INSERT INTO users (id, email, password_hash, name, is_verified) VALUES (?, ?, ?, ?, 1)`,
    args: [id, email, 'p'.repeat(60), name],
  })
}

async function insertOrg(client: Client, id: string, name: string, ownerId: string) {
  await client.execute({
    sql: `INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)`,
    args: [id, name, ownerId],
  })
}

async function insertMember(client: Client, orgId: string, email: string, userId: string, activatedAt: string | null) {
  await client.execute({
    sql: `INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)`,
    args: [orgId, email, userId, activatedAt],
  })
}

async function insertEvent(client: Client, id: string, slug: string, orgId: string, leadUserId: string) {
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id)
          VALUES (?, ?, ?, ?, '2026-11-01', '09:00', 'Hall', ?)`,
    args: [id, slug, leadUserId, slug, orgId],
  })
}

async function insertCampaign(client: Client, id: string, title: string, slug: string, orgId: string, creatorId: string) {
  await client.execute({
    sql: `INSERT INTO dp_campaigns (id, creator_id, title, frame_image_url, slug, org_id)
          VALUES (?, ?, ?, '', ?, ?)`,
    args: [id, creatorId, title, slug, orgId],
  })
}

/** Zebra is inserted first. Alpha sorts first by name. Aaa is pending and sorts before both. */
async function seedAccessibleOrgs(client: Client) {
  await insertUser(client, 'user-owner', 'owner@student.apc.edu.ph', 'Owner')
  await insertUser(client, userU.id, userU.email, userU.name)
  await insertOrg(client, 'org-a', 'Zebra', 'user-owner')
  await insertOrg(client, 'org-pending', 'Aaa', 'user-owner')
  await insertOrg(client, 'org-b', 'Alpha', 'user-owner')
  await insertOrg(client, 'org-c', 'Other', 'user-owner')
  await insertMember(client, 'org-a', userU.email, userU.id, '2026-01-01T00:00:00Z')
  await insertMember(client, 'org-pending', userU.email, userU.id, null)
  await insertMember(client, 'org-b', userU.email, userU.id, '2026-01-02T00:00:00Z')
  await insertEvent(client, 'event-a', 'zebraevent', 'org-a', userU.id)
  await insertEvent(client, 'event-b', 'alphaevent', 'org-b', userU.id)
  await insertCampaign(client, 'camp-a', 'Zebra frame', 'zebraframe', 'org-a', userU.id)
  await insertCampaign(client, 'camp-b', 'Alpha frame', 'alphaframe', 'org-b', userU.id)
}

async function slugs(res: Response): Promise<string[]> {
  const body = await res.json() as { events?: { slug: string }[] }
  return (body.events ?? []).map((event) => event.slug)
}

async function titles(res: Response): Promise<string[]> {
  const body = await res.json() as { campaigns?: { title: string }[] }
  return (body.campaigns ?? []).map((campaign) => campaign.title)
}

describe('orgContext', () => {
  it('uses the org named by X-Active-Org-Id', async () => {
    const { request } = await createTestApp({ user: userU, seed: seedAccessibleOrgs })

    const forms = await request('/api/forms', { headers: { 'X-Active-Org-Id': 'org-b' } })
    expect(forms.status).toBe(200)
    expect(await forms.json()).toMatchObject({ orgId: 'org-b' })

    const events = await request('/api/events', { headers: { 'X-Active-Org-Id': 'org-b' } })
    expect(events.status).toBe(200)
    expect(await slugs(events)).toEqual(['alphaevent'])

    const dp = await request('/api/dp', { headers: { 'X-Active-Org-Id': 'org-b' } })
    expect(dp.status).toBe(200)
    expect(await titles(dp)).toEqual(['Alpha frame'])
  })

  it('returns 403 org_not_accessible and does not fall back when the header is not accessible', async () => {
    const { request } = await createTestApp({ user: userU, seed: seedAccessibleOrgs })

    for (const path of ['/api/forms', '/api/events', '/api/dp']) {
      const res = await request(path, { headers: { 'X-Active-Org-Id': 'org-c' } })
      expect(res.status, path).toBe(403)
      expect(await res.json(), path).toEqual(ORG_NOT_ACCESSIBLE)
    }
  })

  it('defaults to the first accessible org ordered by name', async () => {
    const { request } = await createTestApp({ user: userU, seed: seedAccessibleOrgs })

    const forms = await request('/api/forms')
    expect(forms.status).toBe(200)
    expect(await forms.json()).toMatchObject({ orgId: 'org-b' })

    const events = await request('/api/events')
    expect(events.status).toBe(200)
    expect(await slugs(events)).toEqual(['alphaevent'])

    const dp = await request('/api/dp')
    expect(dp.status).toBe(200)
    expect(await titles(dp)).toEqual(['Alpha frame'])
  })

  it('returns 403 no_org when the user has zero orgs', async () => {
    const empty: TestUser = {
      id: 'user-empty',
      email: 'empty@student.apc.edu.ph',
      name: 'Empty',
      role: 'user',
    }
    const { request } = await createTestApp({
      user: empty,
      seed: async (client) => {
        await insertUser(client, empty.id, empty.email, empty.name)
      },
    })

    for (const path of ['/api/forms', '/api/events', '/api/dp']) {
      const res = await request(path)
      expect(res.status, path).toBe(403)
      expect(await res.json(), path).toEqual(NO_ORG)
    }
  })

  it('does not count a pending membership', async () => {
    const pending: TestUser = {
      id: 'user-pending',
      email: 'pending@student.apc.edu.ph',
      name: 'Pending',
      role: 'user',
    }
    const { request: pendingOnly } = await createTestApp({
      user: pending,
      seed: async (client) => {
        await insertUser(client, 'user-owner', 'owner@student.apc.edu.ph', 'Owner')
        await insertUser(client, pending.id, pending.email, pending.name)
        await insertOrg(client, 'org-pending', 'Aaa', 'user-owner')
        await insertMember(client, 'org-pending', pending.email, pending.id, null)
      },
    })

    const alone = await pendingOnly('/api/forms')
    expect(alone.status).toBe(403)
    expect(await alone.json()).toEqual(NO_ORG)

    const { request } = await createTestApp({ user: userU, seed: seedAccessibleOrgs })
    const header = await request('/api/events', { headers: { 'X-Active-Org-Id': 'org-pending' } })
    expect(header.status).toBe(403)
    expect(await header.json()).toEqual(ORG_NOT_ACCESSIBLE)
  })

  it('counts an owner who has no membership row', async () => {
    const owner: TestUser = {
      id: 'user-solo',
      email: 'solo@student.apc.edu.ph',
      name: 'Solo',
      role: 'user',
    }
    const { request } = await createTestApp({
      user: owner,
      seed: async (client) => {
        await insertUser(client, owner.id, owner.email, owner.name)
        await insertOrg(client, 'org-solo', 'Solo', owner.id)
        await insertEvent(client, 'event-solo', 'soloevent', 'org-solo', owner.id)
      },
    })

    const forms = await request('/api/forms')
    expect(forms.status).toBe(200)
    expect(await forms.json()).toMatchObject({ orgId: 'org-solo' })

    const events = await request('/api/events')
    expect(events.status).toBe(200)
    expect(await slugs(events)).toEqual(['soloevent'])
  })

  it('lists the user orgs ordered by name', async () => {
    const { request } = await createTestApp({ user: userU, seed: seedAccessibleOrgs })

    const res = await request('/api/orgs')
    expect(res.status).toBe(200)
    const body = await res.json() as { orgs: { org_id: string; org_name: string }[] }
    expect(body.orgs.map((org) => org.org_name)).toEqual(['Alpha', 'Zebra'])
    expect(body.orgs.map((org) => org.org_id)).not.toContain('org-pending')
  })
})
