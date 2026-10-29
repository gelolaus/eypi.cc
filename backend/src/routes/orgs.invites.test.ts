import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Client } from '@libsql/client/node'
import { createTestApp, type TestUser } from '../test/createTestApp'

const sendEmail = vi.hoisted(() => vi.fn())

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendEmail }
  },
}))

const ORIGIN = 'https://eypi.cc'
const DAY_MS = 24 * 60 * 60 * 1000

const owner: TestUser = {
  id: 'owner-1',
  email: 'owner@apc.edu.ph',
  name: 'Owner Ada',
  role: 'user',
}

const invitee: TestUser = {
  id: 'invitee-1',
  email: 'invitee@student.apc.edu.ph',
  name: 'Invitee Bea',
  role: 'user',
}

type ErrorBody = { error: { code: string; message: string } }

function post(body?: unknown): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString()
}

async function insertUser(client: Client, user: TestUser) {
  await client.execute({
    sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
    args: [user.id, user.email, user.name, user.role],
  })
}

async function insertOrg(
  client: Client,
  org: { id: string; name: string; logoUrl?: string | null },
) {
  await client.execute({
    sql: 'INSERT INTO organizations (id, name, owner_id, logo_url) VALUES (?, ?, ?, ?)',
    args: [org.id, org.name, owner.id, org.logoUrl ?? null],
  })
}

async function insertMember(
  client: Client,
  member: {
    orgId: string
    email: string
    userId?: string | null
    invitedAt?: string | null
    activatedAt?: string | null
    invitedBy?: string | null
    declinedAt?: string | null
  },
) {
  await client.execute({
    sql: `INSERT INTO org_members
      (org_id, email, user_id, invited_at, activated_at, invited_by, declined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      member.orgId,
      member.email,
      member.userId ?? null,
      member.invitedAt ?? '2026-10-01T00:00:00.000Z',
      member.activatedAt ?? null,
      member.invitedBy ?? null,
      member.declinedAt ?? null,
    ],
  })
}

async function memberRow(client: Client, orgId: string, email: string) {
  const result = await client.execute({
    sql: `SELECT email, user_id, activated_at, declined_at, invited_by
          FROM org_members
          WHERE org_id = ? AND lower(email) = lower(?)`,
    args: [orgId, email],
  })
  return result.rows
}

function asUser(user: TestUser | undefined, seed: (client: Client) => Promise<void>) {
  return createTestApp({
    user,
    seed: async (client) => {
      await insertUser(client, owner)
      await insertUser(client, invitee)
      await seed(client)
    },
  })
}

beforeEach(() => {
  sendEmail.mockReset()
  sendEmail.mockResolvedValue({ data: { id: 'email_1' }, error: null, headers: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/orgs/invites', () => {
  it('returns 401 when nobody is signed in', async () => {
    const { request } = await createTestApp()

    const res = await request('/api/orgs/invites')

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    })
  })

  it('lists a pending invite with the org, logo, inviter, and time', async () => {
    const { request } = await asUser(invitee, async (client) => {
      await insertOrg(client, {
        id: 'org-alpha',
        name: 'Alpha',
        logoUrl: 'https://cdn.example/alpha.png',
      })
      await insertMember(client, {
        orgId: 'org-alpha',
        email: 'INVITEE@student.apc.edu.ph',
        invitedAt: '2026-10-01T00:00:00.000Z',
        invitedBy: owner.id,
      })
    })

    const res = await request('/api/orgs/invites')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        orgId: 'org-alpha',
        orgName: 'Alpha',
        logoUrl: 'https://cdn.example/alpha.png',
        logoMeta: null,
        invitedByName: 'Owner Ada',
        invitedAt: '2026-10-01T00:00:00.000Z',
      },
    ])
  })

  it('omits a declined invite', async () => {
    const { request } = await asUser(invitee, async (client) => {
      await insertOrg(client, { id: 'org-beta', name: 'Beta' })
      await insertMember(client, {
        orgId: 'org-beta',
        email: invitee.email,
        declinedAt: '2026-10-20T00:00:00.000Z',
        invitedBy: owner.id,
      })
    })

    const res = await request('/api/orgs/invites')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('omits an active membership', async () => {
    const { request } = await asUser(invitee, async (client) => {
      await insertOrg(client, { id: 'org-live', name: 'Live' })
      await insertMember(client, {
        orgId: 'org-live',
        email: invitee.email,
        userId: invitee.id,
        activatedAt: '2026-10-02T00:00:00.000Z',
      })
    })

    const res = await request('/api/orgs/invites')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('POST /api/orgs/invites/:orgId/accept', () => {
  it('sets activated_at for the session email when the stored address differs by case', async () => {
    const { request, client } = await asUser(invitee, async (db) => {
      await insertOrg(db, { id: 'org-alpha', name: 'Alpha' })
      await insertMember(db, {
        orgId: 'org-alpha',
        email: 'Invitee@student.apc.edu.ph',
        invitedBy: owner.id,
      })
    })

    const res = await request('/api/orgs/invites/org-alpha/accept', post())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ orgId: 'org-alpha' })
    const rows = await memberRow(client, 'org-alpha', invitee.email)
    expect(rows).toHaveLength(1)
    expect(rows[0].activated_at).toBeTruthy()
    expect(rows[0].user_id).toBe(invitee.id)
    expect(rows[0].declined_at).toBeNull()
  })
})

describe('POST /api/orgs/invites/:orgId/decline', () => {
  it('keeps the row and sets declined_at', async () => {
    const { request, client } = await asUser(invitee, async (db) => {
      await insertOrg(db, { id: 'org-alpha', name: 'Alpha' })
      await insertMember(db, {
        orgId: 'org-alpha',
        email: 'Invitee@student.apc.edu.ph',
      })
    })

    const res = await request('/api/orgs/invites/org-alpha/decline', post())

    expect(res.status).toBe(200)
    const rows = await memberRow(client, 'org-alpha', invitee.email)
    expect(rows).toHaveLength(1)
    expect(rows[0].declined_at).toBeTruthy()
    expect(rows[0].activated_at).toBeNull()
  })
})

describe('POST /api/orgs/:id/members', () => {
  it('returns 403 when the signed-in user does not own the org', async () => {
    const { request } = await asUser(invitee, async (client) => {
      await insertOrg(client, { id: 'org-alpha', name: 'Alpha' })
    })

    const res = await request('/api/orgs/org-alpha/members', post({ email: 'new@apc.edu.ph' }))

    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      error: { code: 'forbidden', message: 'Only the organization owner can invite members.' },
    })
  })

  it('returns 201 and records a pending invite when the email sends', async () => {
    const { request, client } = await asUser(owner, async (db) => {
      await insertOrg(db, { id: 'org-alpha', name: 'Alpha' })
    })

    const res = await request('/api/orgs/org-alpha/members', post({ email: 'New@apc.edu.ph' }))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ emailSent: true })
    const rows = await memberRow(client, 'org-alpha', 'new@apc.edu.ph')
    expect(rows).toHaveLength(1)
    expect(rows[0].activated_at).toBeNull()
    expect(rows[0].declined_at).toBeNull()
    expect(rows[0].invited_by).toBe(owner.id)
    expect(String(rows[0].email)).toBe('new@apc.edu.ph')
  })

  it('returns 201 emailSent false when Resend rejects the message', async () => {
    sendEmail.mockResolvedValue({
      data: null,
      error: { message: 'mailbox unavailable', statusCode: 500, name: 'application_error' },
      headers: null,
    })
    const { request, client } = await asUser(owner, async (db) => {
      await insertOrg(db, { id: 'org-alpha', name: 'Alpha' })
    })

    const res = await request('/api/orgs/org-alpha/members', post({ email: 'new@apc.edu.ph' }))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ emailSent: false })
    expect(await memberRow(client, 'org-alpha', 'new@apc.edu.ph')).toHaveLength(1)
  })

  it('returns 201 emailSent false when Resend throws, without logging the address', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    sendEmail.mockRejectedValue(new Error('failed for new@apc.edu.ph'))
    const { request } = await asUser(owner, async (db) => {
      await insertOrg(db, { id: 'org-alpha', name: 'Alpha' })
    })

    const res = await request('/api/orgs/org-alpha/members', post({ email: 'new@apc.edu.ph' }))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ emailSent: false })
    const logged = spy.mock.calls.flat().map((part) => String(part)).join('\n')
    expect(logged).not.toContain('new@apc.edu.ph')
  })

  it('sends HTML that escapes a script tag in the org name and links to the inbox', async () => {
    const { request } = await asUser(owner, async (db) => {
      await insertOrg(db, { id: 'org-alpha', name: '<script>alert(1)</script>' })
    })

    const res = await request('/api/orgs/org-alpha/members', post({ email: 'new@apc.edu.ph' }))

    expect(res.status).toBe(201)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const payload = sendEmail.mock.calls[0][0] as { from: string; to: string; subject: string; html: string }
    expect(payload.from).toBe('Eypi <invites@eypi.cc>')
    expect(payload.to).toBe('new@apc.edu.ph')
    expect(payload.subject).toBe("You're invited to join <script>alert(1)</script> on Eypi")
    expect(payload.html).toContain('href="https://eypi.cc/invites"')
    expect(payload.html).not.toContain('<script>')
    expect(payload.html).toContain('&lt;script&gt;')
  })

  it('returns 409 already_member for an active member', async () => {
    const { request } = await asUser(owner, async (client) => {
      await insertOrg(client, { id: 'org-alpha', name: 'Alpha' })
      await insertMember(client, {
        orgId: 'org-alpha',
        email: 'Member@apc.edu.ph',
        userId: invitee.id,
        activatedAt: '2026-10-02T00:00:00.000Z',
      })
    })

    const res = await request('/api/orgs/org-alpha/members', post({ email: 'member@apc.edu.ph' }))

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      error: { code: 'already_member', message: 'That person is already a member.' },
    })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('returns 409 already_invited for a pending invite with different casing', async () => {
    const { request, client } = await asUser(owner, async (db) => {
      await insertOrg(db, { id: 'org-alpha', name: 'Alpha' })
      await insertMember(db, {
        orgId: 'org-alpha',
        email: 'New@apc.edu.ph',
      })
    })

    const res = await request('/api/orgs/org-alpha/members', post({ email: 'new@apc.edu.ph' }))

    expect(res.status).toBe(409)
    const body = await res.json() as ErrorBody
    expect(body.error.code).toBe('already_invited')
    expect(await memberRow(client, 'org-alpha', 'new@apc.edu.ph')).toHaveLength(1)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('returns 429 recently_declined when the decline was within 7 days', async () => {
    const declinedAt = ago(6 * DAY_MS)
    const { request, client } = await asUser(owner, async (db) => {
      await insertOrg(db, { id: 'org-alpha', name: 'Alpha' })
      await insertMember(db, {
        orgId: 'org-alpha',
        email: 'new@apc.edu.ph',
        declinedAt,
      })
    })

    const res = await request('/api/orgs/org-alpha/members', post({ email: 'new@apc.edu.ph' }))

    expect(res.status).toBe(429)
    const body = await res.json() as ErrorBody
    expect(body.error.code).toBe('recently_declined')
    const rows = await memberRow(client, 'org-alpha', 'new@apc.edu.ph')
    expect(String(rows[0].declined_at)).toBe(declinedAt)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('reopens a declined invite once 7 days have passed', async () => {
    const { request, client } = await asUser(owner, async (db) => {
      await insertOrg(db, { id: 'org-alpha', name: 'Alpha' })
      await insertMember(db, {
        orgId: 'org-alpha',
        email: 'new@apc.edu.ph',
        declinedAt: ago(8 * DAY_MS),
      })
    })

    const res = await request('/api/orgs/org-alpha/members', post({ email: 'new@apc.edu.ph' }))

    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ emailSent: true })
    const rows = await memberRow(client, 'org-alpha', 'new@apc.edu.ph')
    expect(rows).toHaveLength(1)
    expect(rows[0].declined_at).toBeNull()
    expect(rows[0].activated_at).toBeNull()
    expect(rows[0].invited_by).toBe(owner.id)
  })

  it('returns 400 for an address outside APC', async () => {
    const { request } = await asUser(owner, async (client) => {
      await insertOrg(client, { id: 'org-alpha', name: 'Alpha' })
    })

    const res = await request('/api/orgs/org-alpha/members', post({ email: 'person@gmail.com' }))

    expect(res.status).toBe(400)
    const body = await res.json() as ErrorBody
    expect(body.error.code).toBe('invalid_email')
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('POST /api/orgs/:id/members/:email/resend', () => {
  it('returns 429 when the invite was sent less than 24 hours ago', async () => {
    const { request } = await asUser(owner, async (client) => {
      await insertOrg(client, { id: 'org-alpha', name: 'Alpha' })
      await insertMember(client, {
        orgId: 'org-alpha',
        email: 'new@apc.edu.ph',
        invitedAt: ago(60 * 60 * 1000),
        invitedBy: owner.id,
      })
    })

    const res = await request(
      '/api/orgs/org-alpha/members/new%40apc.edu.ph/resend',
      post(),
    )

    expect(res.status).toBe(429)
    const body = await res.json() as ErrorBody
    expect(body.error.code).toBe('recently_sent')
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('sends again once 24 hours have passed and then blocks the next try', async () => {
    const { request } = await asUser(owner, async (client) => {
      await insertOrg(client, { id: 'org-alpha', name: 'Alpha' })
      await insertMember(client, {
        orgId: 'org-alpha',
        email: 'New@apc.edu.ph',
        invitedAt: ago(25 * 60 * 60 * 1000),
        invitedBy: owner.id,
      })
    })

    const first = await request(
      '/api/orgs/org-alpha/members/new%40apc.edu.ph/resend',
      post(),
    )
    const second = await request(
      '/api/orgs/org-alpha/members/new%40apc.edu.ph/resend',
      post(),
    )

    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ emailSent: true })
    expect(second.status).toBe(429)
    const body = await second.json() as ErrorBody
    expect(body.error.code).toBe('recently_sent')
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })
})
