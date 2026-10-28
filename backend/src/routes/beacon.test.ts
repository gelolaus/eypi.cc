import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestApp } from '../test/createTestApp'
import { manilaDay } from '../lib/manilaTime'
import { visitorHash } from '../lib/ipHash'

const env = { IP_HASH_SECRET: 'test-ip-secret' }

async function seed(client: Awaited<ReturnType<typeof createTestApp>>['client']) {
  await client.execute({ sql: "INSERT INTO users (id, email, name) VALUES ('u1', 'o@apc.edu.ph', 'O')", args: [] })
  await client.execute({
    sql: "INSERT INTO organizations (id, name, owner_id, is_public_catalog) VALUES ('acme', 'Acme', 'u1', 1), ('hidden', 'Hidden', 'u1', 0)",
    args: [],
  })
  await client.execute({
    sql: "INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, frame_image_url) VALUES ('c1', 'u1', 'acme', 'T', 't', '')",
    args: [],
  })
  await client.execute({ sql: "INSERT INTO dp_frames (id, campaign_id, image_url) VALUES ('f1', 'c1', 'x')", args: [] })
}

function post(body: unknown, ip = '203.0.113.7', ua = 'Mozilla/5.0') {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'CF-Connecting-IP': ip, 'User-Agent': ua, Origin: 'https://eypi.cc' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  } satisfies RequestInit
}

async function rows(client: Awaited<ReturnType<typeof createTestApp>>['client']) {
  return (await client.execute('SELECT * FROM module_events')).rows
}

afterEach(() => vi.useRealTimers())

describe('POST /api/beacon', () => {
  it('records a frames view with org, manila day and hashed visitor', async () => {
    const { request, client } = await createTestApp({ env, seed })
    const res = await request('/api/beacon', post({ module: 'frames', subjectId: 'c1', action: 'view' }))
    expect(res.status).toBe(204)
    const [row] = await rows(client)
    expect(row).toMatchObject({ org_id: 'acme', module: 'frames', subject_id: 'c1', action: 'view' })
    expect(row.day).toBe(manilaDay(new Date()))
    expect(String(row.visitor_hash)).toMatch(/^[0-9a-f]{16}$/)
    expect(JSON.stringify(row)).not.toContain('203.0.113.7')
  })

  it('stamps the Manila calendar day, which is ahead of UTC late in the evening', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T17:00:00Z')) // 01:00 on 2026-10-28 in Manila
    const { request, client } = await createTestApp({ env, seed })
    await request('/api/beacon', post({ module: 'frames', subjectId: 'c1', action: 'view' }))
    const [row] = await rows(client)
    expect(row.day).toBe('2026-10-28')
  })

  it('does not reuse the click visitor hash for the beacon visitor hash', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-27T05:00:00Z')) // UTC and Manila agree on the day
    const { request, client } = await createTestApp({ env, seed })
    await request('/api/beacon', post({ module: 'frames', subjectId: 'c1', action: 'view' }, '203.0.113.7', 'Mozilla/5.0'))
    const [row] = await rows(client)
    const clickHash = await visitorHash(env.IP_HASH_SECRET, '20261027', '203.0.113.7', 'Mozilla/5.0')
    expect(String(row.visitor_hash)).toMatch(/^[0-9a-f]{16}$/)
    expect(row.visitor_hash).not.toBe(clickHash)
  })

  it('accepts campaign:frame subjects and rejects unknown frames silently', async () => {
    const { request, client } = await createTestApp({ env, seed })
    expect((await request('/api/beacon', post({ module: 'frames', subjectId: 'c1:f1', action: 'download' }))).status).toBe(204)
    expect((await request('/api/beacon', post({ module: 'frames', subjectId: 'c1:nope', action: 'share' }))).status).toBe(204)
    const stored = await rows(client)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ subject_id: 'c1:f1', org_id: 'acme', action: 'download' })
  })

  it('ignores a frame id that belongs to another campaign', async () => {
    const { request, client } = await createTestApp({
      env,
      seed: async (db) => {
        await seed(db)
        await db.execute({
          sql: "INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, frame_image_url) VALUES ('c2', 'u1', 'acme', 'T2', 't2', '')",
          args: [],
        })
        await db.execute({ sql: "INSERT INTO dp_frames (id, campaign_id, image_url) VALUES ('f-other', 'c2', 'x')", args: [] })
      },
    })
    expect((await request('/api/beacon', post({ module: 'frames', subjectId: 'c1:f-other', action: 'download' }))).status).toBe(204)
    expect(await rows(client)).toHaveLength(0)
  })

  it('records org profile views for public orgs only', async () => {
    const { request, client } = await createTestApp({ env, seed })
    expect((await request('/api/beacon', post({ module: 'org', subjectId: 'acme', action: 'view' }))).status).toBe(204)
    expect((await request('/api/beacon', post({ module: 'org', subjectId: 'hidden', action: 'view' }))).status).toBe(204)
    const stored = await rows(client)
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ org_id: 'acme', subject_id: 'acme', module: 'org' })
  })

  it('returns 204 and stores nothing for an unknown subject', async () => {
    const { request, client } = await createTestApp({ env, seed })
    const res = await request('/api/beacon', post({ module: 'frames', subjectId: 'ghost', action: 'view' }))
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(await rows(client)).toHaveLength(0)
  })

  it('returns 400 for an action the module does not have', async () => {
    const { request, client } = await createTestApp({ env, seed })
    const res = await request('/api/beacon', post({ module: 'org', subjectId: 'acme', action: 'download' }))
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('invalid')
    expect(await rows(client)).toHaveLength(0)
  })

  it('returns 400 for malformed bodies', async () => {
    const { request } = await createTestApp({ env, seed })
    for (const body of ['not json', '[]', JSON.stringify({ module: 'x', subjectId: 'c1', action: 'view' }), JSON.stringify({ module: 'frames', subjectId: 5, action: 'view' }), JSON.stringify({ module: 'frames', subjectId: 'a b', action: 'view' })]) {
      const res = await request('/api/beacon', post(body))
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('invalid')
    }
    const big = await request('/api/beacon', post(JSON.stringify({ module: 'frames', subjectId: 'c1', action: 'view', pad: 'x'.repeat(600) })))
    expect(big.status).toBe(400)
  })

  it('rate limits beacons per visitor', async () => {
    const { request, client } = await createTestApp({ env, seed })
    for (let i = 0; i < 25; i++) {
      expect((await request('/api/beacon', post({ module: 'frames', subjectId: 'c1', action: 'view' }))).status).toBe(204)
    }
    expect(await rows(client)).toHaveLength(20)
    // another visitor, another action and another subject are counted separately
    await request('/api/beacon', post({ module: 'frames', subjectId: 'c1', action: 'view' }, '203.0.113.8'))
    await request('/api/beacon', post({ module: 'frames', subjectId: 'c1', action: 'download' }))
    expect(await rows(client)).toHaveLength(22)
  })

  it('limits a visitor per campaign across its frames, not per exact subject', async () => {
    const { request, client } = await createTestApp({
      env,
      seed: async (db) => {
        await seed(db)
        for (const id of ['f2', 'f3', 'f4']) {
          await db.execute({ sql: 'INSERT INTO dp_frames (id, campaign_id, image_url) VALUES (?, ?, ?)', args: [id, 'c1', 'x'] })
        }
        await db.execute({
          sql: "INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, frame_image_url) VALUES ('c10', 'u1', 'acme', 'T', 't10', '')",
          args: [],
        })
      },
    })
    const subjects = ['c1:f1', 'c1:f2', 'c1:f3', 'c1:f4', 'c1']
    for (let i = 0; i < 25; i++) {
      await request('/api/beacon', post({ module: 'frames', subjectId: subjects[i % subjects.length], action: 'download' }))
    }
    expect(await rows(client)).toHaveLength(20)
    // c10 shares a prefix with c1 but is a different campaign
    await request('/api/beacon', post({ module: 'frames', subjectId: 'c10', action: 'download' }))
    expect(await rows(client)).toHaveLength(21)
  })

  it('stores nothing when the hash secret is not configured', async () => {
    const { request, client } = await createTestApp({ seed })
    const res = await request('/api/beacon', post({ module: 'frames', subjectId: 'c1', action: 'view' }))
    expect(res.status).toBe(204)
    expect(await rows(client)).toHaveLength(0)
  })
})
