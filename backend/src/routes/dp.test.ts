import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp, type TestUser } from '../test/createTestApp'

const ORIGIN = 'https://eypi.cc'
const IP_A = '203.0.113.10'
const IP_B = '203.0.113.11'

const member: TestUser = {
  id: 'user-member',
  email: 'member@student.apc.edu.ph',
  name: 'Member',
  role: 'user',
}

function framePng(width = 1080, height = 1080): Uint8Array {
  const bytes = new Uint8Array(26)
  bytes.set([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  bytes[24] = 8
  bytes[25] = 6
  return bytes
}

function frameDataUrl(width = 1080, height = width): string {
  return `data:image/png;base64,${Buffer.from(framePng(width, height)).toString('base64')}`
}

async function seedOrg(client: Client) {
  await client.execute({
    sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
    args: [member.id, member.email, member.name, member.role],
  })
  await client.execute({
    sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
    args: ['org-1', 'Alpha', member.id],
  })
  await client.execute({
    sql: 'INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)',
    args: ['org-1', member.email, member.id, '2026-01-01T00:00:00.000Z'],
  })
}

function json(method: string, body: unknown, extra: Record<string, string> = {}): RequestInit {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'X-Active-Org-Id': 'org-1',
      ...extra,
    },
    body: JSON.stringify(body),
  }
}

async function frameCount(client: Client, campaignId: string): Promise<number> {
  const result = await client.execute({
    sql: 'SELECT COUNT(*) AS cnt FROM dp_frames WHERE campaign_id = ?',
    args: [campaignId],
  })
  return Number(result.rows[0]?.cnt ?? 0)
}

async function downloadCount(client: Client, campaignId: string): Promise<number> {
  const result = await client.execute({
    sql: 'SELECT download_count FROM dp_campaigns WHERE id = ?',
    args: [campaignId],
  })
  return Number(result.rows[0]?.download_count ?? 0)
}

describe('frame campaigns', () => {
  it('never stores more than 10 frames when adds run concurrently', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (db) => {
        await seedOrg(db)
        await db.execute({
          sql: `INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, frame_image_url)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: ['camp-1', member.id, 'org-1', 'Launch', 'launch', ''],
        })
        await db.batch(Array.from({ length: 9 }, (_, index) => ({
          sql: 'INSERT INTO dp_frames (id, campaign_id, image_url, position) VALUES (?, ?, ?, ?)',
          args: [`frame-${index}`, 'camp-1', `frames/camp-1/frame-${index}.png`, index],
        })))
      },
    })

    // Hold each cap check until every racer has read the count. A separate
    // SELECT-then-INSERT lets all five observe 9 frames and then insert.
    // A single conditional INSERT never matches this gate.
    const originalExecute = client.execute.bind(client)
    let capReads = 0
    const waiting: Array<() => void> = []
    let releaseTimer: ReturnType<typeof setTimeout> | undefined
    const releaseWaiting = () => {
      if (releaseTimer) clearTimeout(releaseTimer)
      releaseTimer = undefined
      waiting.splice(0).forEach((release) => release())
    }
    client.execute = (async (statement: unknown) => {
      const sql = typeof statement === 'string'
        ? statement
        : statement && typeof statement === 'object' && 'sql' in statement
          ? String(statement.sql)
          : ''
      const isCapCheck = /^\s*select\s+count\(\*\)/i.test(sql) && sql.includes('dp_frames')
      const result = await originalExecute(statement as Parameters<Client['execute']>[0])
      if (!isCapCheck) return result
      capReads += 1
      if (capReads >= 5) {
        releaseWaiting()
        return result
      }
      if (releaseTimer) clearTimeout(releaseTimer)
      releaseTimer = setTimeout(releaseWaiting, 200)
      await new Promise<void>((resolve) => { waiting.push(resolve) })
      return result
    }) as Client['execute']

    const responses = await Promise.all(Array.from({ length: 5 }, () => request(
      '/api/dp/camp-1/frames',
      json('POST', { imageData: frameDataUrl() }),
    )))
    const statuses = responses.map((response) => response.status)

    expect(await frameCount(client, 'camp-1')).toBe(10)
    expect(statuses.filter((status) => status === 201)).toHaveLength(1)
    expect(statuses.filter((status) => status === 400)).toHaveLength(4)
  })

  it('leaves no campaign row when creating the frames fails', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: async (db) => {
        await seedOrg(db)
        await db.execute(`
          CREATE TRIGGER dp_frames_fail_insert
          BEFORE INSERT ON dp_frames
          BEGIN
            SELECT RAISE(ABORT, 'frame insert failed');
          END
        `)
      },
    })

    const response = await request('/api/dp', json('POST', {
      title: 'Launch',
      slug: 'launch',
      frames: [{ imageData: frameDataUrl() }],
    }))

    expect(response.status).toBeGreaterThanOrEqual(400)
    const campaigns = await client.execute('SELECT id FROM dp_campaigns')
    expect(campaigns.rows).toHaveLength(0)
  })

  it('returns the stored key and url for each new frame', async () => {
    const { request, client } = await createTestApp({ user: member, seed: seedOrg })

    const created = await request('/api/dp', json('POST', {
      title: 'Launch',
      slug: 'launch-keys',
      frames: [{ imageData: frameDataUrl() }, { imageData: frameDataUrl() }],
    }))
    expect(created.status).toBe(201)
    const body = await created.json() as {
      campaign: { id: string; frames: { id: string; key: string; url: string }[] }
    }
    const rows = await client.execute('SELECT id, image_url FROM dp_frames ORDER BY position')
    expect(body.campaign.frames).toHaveLength(2)
    body.campaign.frames.forEach((frame, index) => {
      expect(frame.id).toBe(String(rows.rows[index]?.id))
      expect(frame.key).toBe(String(rows.rows[index]?.image_url))
      expect(frame.key).toMatch(/^frames\/[^/]+\/[^/]+-[0-9a-f]{8}\.png$/)
      expect(frame.url).toBe(`/media/${frame.key}`)
    })

    const added = await request(`/api/dp/${body.campaign.id}/frames`, json('POST', { imageData: frameDataUrl() }))
    expect(added.status).toBe(201)
    const addedBody = await added.json() as { frame: { id: string; key: string; url: string; position: number } }
    const row = await client.execute({ sql: 'SELECT image_url FROM dp_frames WHERE id = ?', args: [addedBody.frame.id] })
    expect(addedBody.frame.key).toBe(String(row.rows[0]?.image_url))
    expect(addedBody.frame.url).toBe(`/media/${addedBody.frame.key}`)
    expect(addedBody.frame.position).toBe(2)
  })

  it('resolves an old slug through dp_slug_history', async () => {
    const { request, client } = await createTestApp({
      user: member,
      seed: seedOrg,
    })

    const created = await request('/api/dp', json('POST', {
      title: 'Launch',
      slug: 'launch-night',
      frames: [{ imageData: frameDataUrl(), label: 'Gold' }],
    }))
    expect(created.status).toBe(201)
    const createdBody = await created.json() as { campaign: { id: string } }

    const stored = await client.execute('SELECT image_url FROM dp_frames')
    expect(String(stored.rows[0]?.image_url)).toMatch(/^frames\//)

    const renamed = await request(`/api/dp/${createdBody.campaign.id}`, json('PATCH', {
      slug: 'reunion',
    }))
    expect(renamed.status).toBe(200)

    const response = await request('/api/dp/launch-night')
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store') // signed-in viewers bypass the edge cache
    const body = await response.json() as {
      campaign: {
        id: string
        slug: string
        frames: { url: string; width: number; height: number; label: string | null }[]
      }
    }
    expect(body.campaign.id).toBe(createdBody.campaign.id)
    expect(body.campaign.slug).toBe('reunion')
    expect(body.campaign.frames[0]).toMatchObject({
      url: expect.stringMatching(/^\/media\/frames\//),
      width: 1080,
      height: 1080,
      label: 'Gold',
    })

    const history = await client.execute({
      sql: 'SELECT campaign_id FROM dp_slug_history WHERE old_slug = ?',
      args: ['launch-night'],
    })
    expect(history.rows[0]?.campaign_id).toBe(createdBody.campaign.id)
  })

  describe('download counter', () => {
    async function setup() {
      const app = await createTestApp({
        user: member,
        seed: async (db) => {
          await seedOrg(db)
          await db.batch([
            {
              sql: `INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, frame_image_url)
                    VALUES (?, ?, ?, ?, ?, ?)`,
              args: ['camp-a', member.id, 'org-1', 'A', 'camp-a', ''],
            },
            {
              sql: `INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, frame_image_url)
                    VALUES (?, ?, ?, ?, ?, ?)`,
              args: ['camp-b', member.id, 'org-1', 'B', 'camp-b', ''],
            },
          ])
        },
      })
      const download = (id: string, ip: string) =>
        app.request(`/api/dp/${id}/download`, {
          method: 'POST',
          headers: { Origin: ORIGIN, 'CF-Connecting-IP': ip },
        })
      return { client: app.client, download, request: app.request }
    }

    it('counts every save from the same connection', async () => {
      const { client, download } = await setup()
      for (let i = 0; i < 3; i++) expect((await download('camp-a', IP_A)).status).toBe(200)
      expect(await downloadCount(client, 'camp-a')).toBe(3)
    })

    it('refuses the 31st save in an hour without counting it', async () => {
      const { client, download } = await setup()
      for (let i = 0; i < 30; i++) expect((await download('camp-a', IP_A)).status).toBe(200)
      const over = await download('camp-a', IP_A)
      expect(over.status).toBe(429)
      expect(((await over.json()) as { message: string }).message).toBe('You are saving too fast. Try again in a little while.')
      expect(await downloadCount(client, 'camp-a')).toBe(30)
    })

    it('gives each connection its own hourly allowance', async () => {
      const { client, download } = await setup()
      for (let i = 0; i < 30; i++) expect((await download('camp-a', IP_A)).status).toBe(200)
      expect((await download('camp-a', IP_A)).status).toBe(429)
      expect(await downloadCount(client, 'camp-a')).toBe(30)
      expect((await download('camp-a', IP_B)).status).toBe(200)
      expect(await downloadCount(client, 'camp-a')).toBe(31)
    })

    it('limits each frame on its own', async () => {
      const { client, download } = await setup()
      for (let i = 0; i < 30; i++) await download('camp-a', IP_A)
      expect((await download('camp-b', IP_A)).status).toBe(200)
      expect(await downloadCount(client, 'camp-b')).toBe(1)
    })

    it('public payload counts downloads and shares the way insights does', async () => {
      const { client, request } = await setup()
      const event = (subject: string, action: string) => client.execute({
        sql: "INSERT INTO module_events (org_id, module, subject_id, action, visitor_hash, day) VALUES ('org-1', 'frames', ?, ?, 'v', '2026-10-28')",
        args: [subject, action],
      })
      await event('camp-a:f1', 'download')
      await event('camp-a:f1', 'download')
      await event('camp-a:f2', 'share')
      await event('camp-a', 'view')
      await event('camp-a', 'photo_added')
      await event('camp-a-other:f1', 'download')
      await event('camp-b:f1', 'download')
      await client.execute({
        sql: 'INSERT INTO dp_slug_history (old_slug, campaign_id) VALUES (?, ?)',
        args: ['camp-a-old', 'camp-a'],
      })
      const get = async (slug: string) => {
        const res = await request(`/api/dp/${slug}`)
        return (await res.json()) as { campaign: { downloadCount: number } }
      }
      expect((await get('camp-a')).campaign.downloadCount).toBe(3)
      expect((await get('camp-a-old')).campaign.downloadCount).toBe(3)
      expect((await get('camp-b')).campaign.downloadCount).toBe(1)
    })

    it('keeps the count out of the editor payload', async () => {
      const { request } = await setup()
      const res = await request('/api/dp/camp-a/edit', { headers: { Origin: ORIGIN, 'X-Active-Org-Id': 'org-1' } })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { campaign: Record<string, unknown> }
      expect(body.campaign).not.toHaveProperty('downloadCount')
    })

    it('returns 404 for an unknown frame without counting', async () => {
      const { client, download } = await setup()
      expect((await download('nope', IP_A)).status).toBe(404)
      expect(await downloadCount(client, 'camp-a')).toBe(0)
      expect(await downloadCount(client, 'camp-b')).toBe(0)
    })
  })
})
