import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/createTestApp'

const KEYS = [
  'users', 'orgs', 'members', 'links', 'clicks', 'events', 'tickets', 'checkIns', 'frames', 'frameDownloads',
]

describe('GET /api/stats', () => {
  it('returns zero for every key on an empty database', async () => {
    const { request } = await createTestApp()

    const res = await request('/api/stats')
    const body = (await res.json()) as Record<string, number>

    expect(res.status).toBe(200)
    for (const key of KEYS) expect(body[key], key).toBe(0)
  })

  it('counts platform totals and sets a public cache header', async () => {
    const { request } = await createTestApp({
      seed: async (client) => {
        const run = (sql: string, args: (string | number | null)[] = []) => client.execute({ sql, args })
        await run('INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)', ['u1', 'a@student.apc.edu.ph', 'A', 'user'])
        await run('INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)', ['org1', 'Org', 'u1'])
        await run('INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)', ['org1', 'a@student.apc.edu.ph', 'u1'])
        await run('INSERT INTO org_members (org_id, email) VALUES (?, ?)', ['org1', 'pending@student.apc.edu.ph'])
        await run('INSERT INTO links (id, user_id, original_url, slug, clicks) VALUES (?, ?, ?, ?, ?)', ['l1', 'u1', 'https://a.example', 'aa', 3])
        await run('INSERT INTO links (id, user_id, original_url, slug, clicks) VALUES (?, ?, ?, ?, ?)', ['l2', 'u1', 'https://b.example', 'bb', 4])
        await run('INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['e1', 'ev', 'u1', 'E', '2026-01-01', '09:00', 'Hall', 'org1'])
        await run('INSERT INTO attendees (id, event_id, first_name, email, qr_token) VALUES (?, ?, ?, ?, ?)', ['t1', 'e1', 'X', 'x@example.com', 'q1'])
        await run('INSERT INTO attendees (id, event_id, first_name, email, qr_token) VALUES (?, ?, ?, ?, ?)', ['t2', 'e1', 'Y', 'y@example.com', 'q2'])
        await run('INSERT INTO check_ins (id, attendee_id, event_id, action) VALUES (?, ?, ?, ?)', ['c1', 't1', 'e1', 'checked_in'])
        await run('INSERT INTO check_ins (id, attendee_id, event_id, action) VALUES (?, ?, ?, ?)', ['c2', 't2', 'e1', 'removed'])
        await run('INSERT INTO dp_campaigns (id, creator_id, title, frame_image_url, download_count, org_id) VALUES (?, ?, ?, ?, ?, ?)', ['d1', 'u1', 'D', '/x.png', 99, 'org1'])
        const event = (subject: string, action: string) =>
          run("INSERT INTO module_events (org_id, module, subject_id, action, visitor_hash, day) VALUES ('org1', 'frames', ?, ?, 'v', '2026-10-28')", [subject, action])
        await event('d1:f1', 'download')
        await event('d1:f1', 'download')
        await event('d1:f2', 'share')
        await event('d1', 'view')
        await event('d1', 'photo_added')
        await event('gone:f1', 'download')
        await run("INSERT INTO module_events (org_id, module, subject_id, action, visitor_hash, day) VALUES ('org1', 'org', 'org1', 'view', 'v', '2026-10-28')")
      },
    })

    const res = await request('/api/stats')

    expect(res.headers.get('Cache-Control')).toBe('public, max-age=30, stale-while-revalidate=300')
    expect(await res.json()).toEqual({
      users: 1, orgs: 1, members: 1, links: 2, clicks: 7, events: 1, tickets: 2, checkIns: 1, frames: 1, frameDownloads: 3,
    })
  })
})
