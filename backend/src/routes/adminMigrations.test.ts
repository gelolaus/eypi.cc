import type { Client } from '@libsql/client'
import { describe, expect, it } from 'vitest'
import { createTestApp, type TestUser } from '../test/createTestApp'

const ORIGIN = 'https://eypi.cc'

const admin: TestUser = {
  id: 'user-admin',
  email: 'admin@student.apc.edu.ph',
  name: 'Admin',
  role: 'admin',
}

const member: TestUser = {
  id: 'user-member',
  email: 'member@student.apc.edu.ph',
  name: 'Member',
  role: 'user',
}

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
  ])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xc0,
    0x00, 0x0b,
    0x08,
    0x00, 0x00,
    0x00, 0x00,
    0x01,
    0x01, 0x11, 0x00,
    0xff, 0xd9,
  ])
  const view = new DataView(bytes.buffer)
  view.setUint16(7, height)
  view.setUint16(9, width)
  return bytes
}

function dataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
}

const frameBytes = png(32, 32)
const logoBytes = png(16, 16)
const bannerBytes = jpeg(20, 10)
const qrBytes = png(12, 12)
const frameData = dataUrl(frameBytes, 'image/png')
const logoData = dataUrl(logoBytes, 'image/png')
const bannerData = dataUrl(bannerBytes, 'image/jpeg')
const qrData = dataUrl(qrBytes, 'image/png')
const keptFrameKey = 'frames/camp-1/kept.png'
const untouchedLogo = 'https://cdn.example/logo.png'
const campaignFrame = 'data:image/png;base64,not-a-frame-row'
const plainQr = JSON.stringify({
  dotType: 'square',
  eyeFrameType: 'square',
  eyeBallType: 'square',
  color: '#DEAC4B',
  logoDataUrl: null,
})

async function sha8(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', copy))
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 8)
}

async function insertUser(client: Client, user: TestUser): Promise<void> {
  await client.execute({
    sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
    args: [user.id, user.email, user.name, user.role],
  })
}

async function seedMedia(client: Client): Promise<void> {
  await insertUser(client, admin)
  await client.execute({
    sql: 'INSERT INTO organizations (id, name, owner_id, logo_url, banner_url) VALUES (?, ?, ?, ?, ?)',
    args: ['org-1', 'Alpha', admin.id, logoData, bannerData],
  })
  await client.execute({
    sql: 'INSERT INTO organizations (id, name, owner_id, logo_url, banner_url) VALUES (?, ?, ?, ?, ?)',
    args: ['org-2', 'Beta', admin.id, untouchedLogo, null],
  })
  await client.execute({
    sql: `INSERT INTO dp_campaigns (id, creator_id, title, slug, frame_image_url)
          VALUES (?, ?, ?, ?, ?)`,
    args: ['camp-1', admin.id, 'Launch', 'launch', campaignFrame],
  })
  await client.execute({
    sql: 'INSERT INTO dp_frames (id, campaign_id, image_url, position) VALUES (?, ?, ?, ?)',
    args: ['frame-1', 'camp-1', frameData, 0],
  })
  await client.execute({
    sql: 'INSERT INTO dp_frames (id, campaign_id, image_url, position) VALUES (?, ?, ?, ?)',
    args: ['frame-kept', 'camp-1', keptFrameKey, 1],
  })
  await client.execute({
    sql: `INSERT INTO links (id, user_id, original_url, slug, qr_config)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      'link-1',
      admin.id,
      'https://example.com/a',
      'alpha',
      JSON.stringify({
        dotType: 'dots',
        eyeFrameType: 'dot',
        eyeBallType: 'dot',
        color: '#112233',
        logoDataUrl: qrData,
      }),
    ],
  })
  await client.execute({
    sql: `INSERT INTO links (id, user_id, original_url, slug, qr_config)
          VALUES (?, ?, ?, ?, ?)`,
    args: ['link-plain', admin.id, 'https://example.com/b', 'beta', plainQr],
  })
}

function post(): RequestInit {
  return {
    method: 'POST',
    headers: { Origin: ORIGIN },
  }
}

async function textColumn(client: Client, sql: string): Promise<string | null> {
  const result = await client.execute(sql)
  const value = result.rows[0] ? Object.values(result.rows[0])[0] : null
  return value == null ? null : String(value)
}

async function objectKeys(media: { list: () => Promise<{ objects: { key: string }[] }> }): Promise<string[]> {
  const listed = await media.list()
  return listed.objects.map((object) => object.key).sort()
}

describe('POST /api/admin/migrations/media', () => {
  it('counts data urls on a dry run and leaves the database and R2 unchanged', async () => {
    const { request, client, env } = await createTestApp({
      user: admin,
      seed: seedMedia,
    })

    const res = await request('/api/admin/migrations/media?dryRun=1', post())
    const again = await request('/api/admin/migrations/media', post())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dryRun: true, frames: 1, orgImages: 2, qrLogos: 1 })
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ dryRun: true, frames: 1, orgImages: 2, qrLogos: 1 })
    expect(await textColumn(client, "SELECT image_url FROM dp_frames WHERE id = 'frame-1'")).toBe(frameData)
    expect(await textColumn(client, "SELECT logo_url FROM organizations WHERE id = 'org-1'")).toBe(logoData)
    expect(await textColumn(client, "SELECT banner_url FROM organizations WHERE id = 'org-1'")).toBe(bannerData)
    expect(await textColumn(client, "SELECT qr_config FROM links WHERE id = 'link-1'")).toContain(qrData)
    expect(await objectKeys(env.MEDIA)).toEqual([])
  })

  it('stores R2 keys for a data-url frame, org images, and QR logo, then no-ops', async () => {
    const { request, client, env } = await createTestApp({
      user: admin,
      seed: seedMedia,
    })
    const frameKey = `frames/camp-1/frame-1-${await sha8(frameBytes)}.png`
    const logoKey = `orgs/org-1/logo-${await sha8(logoBytes)}.png`
    const bannerKey = `orgs/org-1/banner-${await sha8(bannerBytes)}.jpg`
    const qrKey = `qr-logos/link-1-${await sha8(qrBytes)}.png`

    const res = await request('/api/admin/migrations/media?dryRun=0', post())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dryRun: false, frames: 1, orgImages: 2, qrLogos: 1 })
    expect(await textColumn(client, "SELECT image_url FROM dp_frames WHERE id = 'frame-1'")).toBe(frameKey)
    expect(await textColumn(client, "SELECT image_url FROM dp_frames WHERE id = 'frame-kept'")).toBe(keptFrameKey)
    expect(await textColumn(client, "SELECT frame_image_url FROM dp_campaigns WHERE id = 'camp-1'")).toBe(campaignFrame)
    expect(await textColumn(client, "SELECT logo_url FROM organizations WHERE id = 'org-1'")).toBe(logoKey)
    expect(await textColumn(client, "SELECT banner_url FROM organizations WHERE id = 'org-1'")).toBe(bannerKey)
    expect(await textColumn(client, "SELECT logo_url FROM organizations WHERE id = 'org-2'")).toBe(untouchedLogo)
    expect(await textColumn(client, "SELECT banner_url FROM organizations WHERE id = 'org-2'")).toBeNull()
    const qr = JSON.parse(String(await textColumn(client, "SELECT qr_config FROM links WHERE id = 'link-1'")))
    expect(qr).toEqual({
      dotType: 'dots',
      eyeFrameType: 'dot',
      eyeBallType: 'dot',
      color: '#112233',
      logo: { key: qrKey },
    })
    expect(await textColumn(client, "SELECT qr_config FROM links WHERE id = 'link-plain'")).toBe(plainQr)
    expect(await objectKeys(env.MEDIA)).toEqual([bannerKey, frameKey, logoKey, qrKey].sort())
    for (const [key, bytes, contentType] of [
      [frameKey, frameBytes, 'image/png'],
      [logoKey, logoBytes, 'image/png'],
      [bannerKey, bannerBytes, 'image/jpeg'],
      [qrKey, qrBytes, 'image/png'],
    ] as const) {
      const stored = await env.MEDIA.get(key)
      expect(stored).not.toBeNull()
      expect(new Uint8Array(await stored!.arrayBuffer())).toEqual(bytes)
      expect(stored!.httpMetadata?.contentType).toBe(contentType)
    }

    const second = await request('/api/admin/migrations/media?dryRun=0', post())

    expect(second.status).toBe(200)
    expect(await second.json()).toEqual({ dryRun: false, frames: 0, orgImages: 0, qrLogos: 0 })
    expect(await textColumn(client, "SELECT image_url FROM dp_frames WHERE id = 'frame-1'")).toBe(frameKey)
    expect(await textColumn(client, "SELECT logo_url FROM organizations WHERE id = 'org-1'")).toBe(logoKey)
    expect(await textColumn(client, "SELECT banner_url FROM organizations WHERE id = 'org-1'")).toBe(bannerKey)
    expect(JSON.parse(String(await textColumn(client, "SELECT qr_config FROM links WHERE id = 'link-1'"))).logo)
      .toEqual({ key: qrKey })
    expect(await objectKeys(env.MEDIA)).toEqual([bannerKey, frameKey, logoKey, qrKey].sort())
  })

  it('rejects a non-admin and an anonymous caller without rewriting data urls', async () => {
    const forbidden = await createTestApp({
      user: member,
      seed: async (client) => {
        await seedMedia(client)
        await insertUser(client, member)
      },
    })
    const anonymous = await createTestApp({ seed: seedMedia })

    const denied = await forbidden.request('/api/admin/migrations/media?dryRun=0', post())
    const unsigned = await anonymous.request('/api/admin/migrations/media?dryRun=0', post())

    expect(denied.status).toBe(403)
    expect(await denied.json()).toEqual({
      error: { code: 'admin_only', message: 'Admin access is required.' },
    })
    expect(unsigned.status).toBe(401)
    expect(await unsigned.json()).toEqual({
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    })
    expect(await textColumn(forbidden.client, "SELECT image_url FROM dp_frames WHERE id = 'frame-1'")).toBe(frameData)
    expect(await textColumn(anonymous.client, "SELECT logo_url FROM organizations WHERE id = 'org-1'")).toBe(logoData)
    expect(await objectKeys(forbidden.env.MEDIA)).toEqual([])
    expect(await objectKeys(anonymous.env.MEDIA)).toEqual([])
  })
})
