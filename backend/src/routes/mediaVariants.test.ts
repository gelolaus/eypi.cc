import { describe, expect, it } from 'vitest'
import { createTestApp, type TestUser } from '../test/createTestApp'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseImageMeta, variantKey } from '../lib/media'
import { PROFILE_WIDTHS } from './mediaVariants'

const ORIGIN = 'https://eypi.cc'

const member: TestUser = { id: 'member-1', email: 'member@student.apc.edu.ph', name: 'Member', role: 'user' }
const outsider: TestUser = { id: 'outsider-1', email: 'outsider@student.apc.edu.ph', name: 'Outsider', role: 'user' }
const admin: TestUser = { id: 'admin-1', email: 'admin@student.apc.edu.ph', name: 'Admin', role: 'admin' }

const LOGO_KEY = 'orgs/alpha/logo-0123abcd.png'
const BANNER_KEY = 'orgs/alpha/banner-0123abcd.png'
const FRAME_KEY = 'frames/camp-1/frame-1-0123abcd.png'

function png(width: number, height: number, extra = 0): Uint8Array {
  const bytes = new Uint8Array(24 + extra)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

function webp(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30)
  bytes.set([0x52, 0x49, 0x46, 0x46, 22, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58, 0x0a, 0, 0, 0])
  const w = width - 1
  const h = height - 1
  bytes[24] = w & 0xff
  bytes[25] = (w >> 8) & 0xff
  bytes[26] = (w >> 16) & 0xff
  bytes[27] = h & 0xff
  bytes[28] = (h >> 8) & 0xff
  bytes[29] = (h >> 16) & 0xff
  return bytes
}

function dataUrl(bytes: Uint8Array, mime = 'image/png'): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`
}

async function setup(user?: TestUser) {
  const app = await createTestApp({
    user,
    seed: async (db) => {
      for (const u of [member, outsider, admin]) {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
          args: [u.id, u.email, u.name, u.role],
        })
      }
      await db.execute({
        sql: 'INSERT INTO organizations (id, name, owner_id, logo_url, banner_url) VALUES (?, ?, ?, ?, ?)',
        args: ['alpha', 'Alpha', admin.id, LOGO_KEY, BANNER_KEY],
      })
      await db.execute({
        sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
        args: ['beta', 'Beta', outsider.id],
      })
      await db.execute({
        sql: 'INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
        args: ['alpha', member.email, member.id],
      })
      await db.execute({
        sql: `INSERT INTO dp_campaigns (id, creator_id, org_id, title, slug, frame_image_url)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: ['camp-1', admin.id, 'alpha', 'Launch', 'launch', ''],
      })
      await db.execute({
        sql: 'INSERT INTO dp_frames (id, campaign_id, image_url, label, position) VALUES (?, ?, ?, ?, ?)',
        args: ['frame-1', 'camp-1', FRAME_KEY, null, 0],
      })
    },
  })
  await app.env.MEDIA.put(LOGO_KEY, png(1000, 1000))
  await app.env.MEDIA.put(BANNER_KEY, png(2400, 800))
  await app.env.MEDIA.put(FRAME_KEY, png(1080, 1080))
  return app
}

type Setup = Awaited<ReturnType<typeof setup>>

function put(app: Setup, body: unknown, raw?: string) {
  return app.request('/api/media/variants', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: raw ?? JSON.stringify(body),
  })
}

function validBody(key = LOGO_KEY, widths = [96, 192]) {
  return {
    key,
    placeholder: dataUrl(png(16, 16)),
    meta: { w: 1000, h: 1000, fmt: 'webp', widths },
    variants: widths.map((width) => ({ width, dataUrl: dataUrl(webp(width, width), 'image/webp') })),
  }
}

async function keys(app: Setup): Promise<string[]> {
  const listed = await (app.env.MEDIA as unknown as { list: () => Promise<{ objects: { key: string }[] }> }).list()
  return listed.objects.map((o) => o.key).sort()
}

describe('PUT /api/media/variants authorization', () => {
  it('refuses anonymous callers with 401 and writes nothing', async () => {
    const app = await setup()
    const res = await put(app, validBody())
    expect(res.status).toBe(401)
    expect(await keys(app)).toEqual([BANNER_KEY, FRAME_KEY, LOGO_KEY].sort())
  })

  it('lets a member of the key org write org variants and records the meta', async () => {
    const app = await setup(member)
    const res = await put(app, validBody())
    expect(res.status).toBe(200)
    const body = await res.json() as { meta: { w: number; h: number; fmt: string; widths: number[]; ph: string } }
    expect(body.meta).toMatchObject({ w: 1000, h: 1000, fmt: 'webp', widths: [96, 192] })
    expect(await keys(app)).toContain(variantKey(LOGO_KEY, 96, 'webp'))
    expect(await keys(app)).toContain(variantKey(LOGO_KEY, 192, 'webp'))
    const row = await app.client.execute("SELECT logo_meta FROM organizations WHERE id = 'alpha'")
    expect(JSON.parse(String(row.rows[0].logo_meta))).toEqual(body.meta)
    const audit = await app.client.execute("SELECT actor_user_id, action, target_id FROM audit_events WHERE action = 'media.variants'")
    expect(audit.rows).toHaveLength(1)
    expect(audit.rows[0].target_id).toBe('alpha')
  })

  it('rejects other org', async () => {
    const app = await setup(outsider)
    const res = await put(app, validBody())
    expect(res.status).toBe(403)
    expect(await keys(app)).toEqual([BANNER_KEY, FRAME_KEY, LOGO_KEY].sort())
    const row = await app.client.execute("SELECT logo_meta FROM organizations WHERE id = 'alpha'")
    expect(row.rows[0].logo_meta).toBeNull()
  })

  it('rejects other org for frame keys too', async () => {
    const app = await setup(outsider)
    const res = await put(app, validBody(FRAME_KEY, [256]))
    expect(res.status).toBe(403)
  })

  it('lets an org member write frame variants for the campaign org', async () => {
    const app = await setup(member)
    const res = await put(app, validBody(FRAME_KEY, [256, 512]))
    expect(res.status).toBe(200)
    const row = await app.client.execute("SELECT image_meta FROM dp_frames WHERE id = 'frame-1'")
    expect(JSON.parse(String(row.rows[0].image_meta)).widths).toEqual([256, 512])
  })

  it('lets an admin write any key', async () => {
    const app = await setup(admin)
    expect((await put(app, validBody())).status).toBe(200)
    expect((await put(app, validBody(BANNER_KEY, [640, 1280]))).status).toBe(200)
  })

  it('lets an admin who belongs to no org write a key', async () => {
    const app = await createTestApp({
      user: { ...admin, id: 'admin-2', email: 'admin2@student.apc.edu.ph' },
      seed: async (db) => {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
          args: ['owner-9', 'o9@student.apc.edu.ph', 'O', 'user'],
        })
        await db.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id, logo_url) VALUES (?, ?, ?, ?)',
          args: ['alpha', 'Alpha', 'owner-9', LOGO_KEY],
        })
      },
    })
    await app.env.MEDIA.put(LOGO_KEY, png(1000, 1000))
    expect((await put(app as unknown as Setup, validBody())).status).toBe(200)
  })

  it('does not treat a pending invite as membership', async () => {
    const app = await createTestApp({
      user: member,
      seed: async (db) => {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
          args: [member.id, member.email, member.name, member.role],
        })
        await db.execute({
          sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
          args: ['owner-9', 'o9@student.apc.edu.ph', 'O', 'user'],
        })
        await db.execute({
          sql: 'INSERT INTO organizations (id, name, owner_id, logo_url) VALUES (?, ?, ?, ?)',
          args: ['alpha', 'Alpha', 'owner-9', LOGO_KEY],
        })
        await db.execute({
          sql: 'INSERT INTO org_members (org_id, email, user_id) VALUES (?, ?, ?)',
          args: ['alpha', member.email, member.id],
        })
      },
    })
    await app.env.MEDIA.put(LOGO_KEY, png(1000, 1000))
    expect((await put(app as unknown as Setup, validBody())).status).toBe(403)
  })
})

describe('PUT /api/media/variants validation', () => {
  it('rejects a width not in the profile', async () => {
    const app = await setup(member)
    const res = await put(app, validBody(LOGO_KEY, [100]))
    expect(res.status).toBe(422)
    // a banner width is not valid for a logo
    expect((await put(app, validBody(LOGO_KEY, [640]))).status).toBe(422)
    expect(await keys(app)).toEqual([BANNER_KEY, FRAME_KEY, LOGO_KEY].sort())
  })

  it('rejects a variant wider than the original', async () => {
    const app = await setup(member)
    await app.env.MEDIA.put(LOGO_KEY, png(150, 150))
    const res = await put(app, validBody(LOGO_KEY, [96, 192]))
    expect(res.status).toBe(422)
    expect(await keys(app)).toEqual([BANNER_KEY, FRAME_KEY, LOGO_KEY].sort())
  })

  it('rejects a non-image data URL', async () => {
    const app = await setup(member)
    const body = validBody(LOGO_KEY, [96])
    body.variants[0].dataUrl = `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`
    expect((await put(app, body)).status).toBe(422)
    body.variants[0].dataUrl = 'data:text/html;base64,PGI+'
    expect((await put(app, body)).status).toBe(422)
    body.variants[0].dataUrl = 'https://evil.example/x.png'
    expect((await put(app, body)).status).toBe(422)
    expect(await keys(app)).toEqual([BANNER_KEY, FRAME_KEY, LOGO_KEY].sort())
  })

  it('rejects a variant over 2 MB', async () => {
    const app = await setup(member)
    const body = validBody(LOGO_KEY, [96])
    body.variants[0].dataUrl = dataUrl(png(96, 96, 2 * 1024 * 1024 + 10))
    expect((await put(app, body)).status).toBe(422)
    expect(await keys(app)).toEqual([BANNER_KEY, FRAME_KEY, LOGO_KEY].sort())
  })

  it('rejects a variant whose real width differs from the declared width', async () => {
    const app = await setup(member)
    const body = validBody(LOGO_KEY, [96])
    body.variants[0].dataUrl = dataUrl(webp(300, 300), 'image/webp')
    expect((await put(app, body)).status).toBe(422)
  })

  it('rejects mixed formats, duplicate widths and too many variants', async () => {
    const app = await setup(member)
    const mixed = validBody(LOGO_KEY, [96, 192])
    mixed.variants[1].dataUrl = dataUrl(png(192, 192))
    expect((await put(app, mixed)).status).toBe(422)
    const dup = validBody(LOGO_KEY, [96])
    dup.variants.push(dup.variants[0])
    expect((await put(app, dup)).status).toBe(422)
    const many = validBody(LOGO_KEY, [96])
    many.variants = Array.from({ length: 5 }, () => many.variants[0])
    expect((await put(app, many)).status).toBe(422)
  })

  it('rejects a bad placeholder and a malformed body', async () => {
    const app = await setup(member)
    const body = validBody(LOGO_KEY, [96])
    body.placeholder = 'data:image/png;base64,AAAA'
    expect((await put(app, body)).status).toBe(422)
    expect((await put(app, null, 'not json')).status).toBe(400)
  })

  it('answers 404 for a key that matches no row', async () => {
    const app = await setup(member)
    await app.env.MEDIA.put('orgs/alpha/logo-ffffffff.png', png(1000, 1000))
    expect((await put(app, validBody('orgs/alpha/logo-ffffffff.png'))).status).toBe(404)
  })

  it('answers 404 for keys outside the naming scheme', async () => {
    const app = await setup(admin)
    for (const key of [
      'orgs/alpha/../beta/logo-0123abcd.png',
      '../orgs/alpha/logo-0123abcd.png',
      'qr-logos/link-1.png',
      'orgs/alpha/logo-0123abcd-96.webp',
      '',
    ]) {
      expect((await put(app, validBody(key))).status).toBe(404)
    }
    expect(await keys(app)).toEqual([BANNER_KEY, FRAME_KEY, LOGO_KEY].sort())
  })

  it('accepts no variants with an empty placeholder', async () => {
    const app = await setup(member)
    const res = await put(app, { key: LOGO_KEY, placeholder: '', meta: { w: 1000, h: 1000, fmt: 'webp', widths: [] }, variants: [] })
    expect(res.status).toBe(200)
    const body = await res.json() as { meta: { widths: number[]; ph: string } }
    expect(body.meta.widths).toEqual([])
    expect(body.meta.ph).toBe('')
  })

  it('refuses an oversized body', async () => {
    const app = await setup(member)
    const res = await put(app, null, 'x'.repeat(10 * 1024 * 1024))
    expect(res.status).toBe(413)
  })

  it('drops variants a re-run no longer lists', async () => {
    const app = await setup(member)
    expect((await put(app, validBody(LOGO_KEY, [96, 192]))).status).toBe(200)
    expect((await put(app, validBody(LOGO_KEY, [96]))).status).toBe(200)
    const all = await keys(app)
    expect(all).toContain(variantKey(LOGO_KEY, 96, 'webp'))
    expect(all).not.toContain(variantKey(LOGO_KEY, 192, 'webp'))
  })
})

describe('variantKey', () => {
  it('swaps the extension for -{width}.{ext}', () => {
    expect(variantKey('orgs/a/logo-0123abcd.png', 96, 'webp')).toBe('orgs/a/logo-0123abcd-96.webp')
    expect(variantKey('orgs/a/logo-0123abcd.png', 192, 'jpeg')).toBe('orgs/a/logo-0123abcd-192.jpg')
    expect(variantKey('frames/c/f-0123abcd.png', 256, 'png')).toBe('frames/c/f-0123abcd-256.png')
  })
})

describe('meta in payloads and cleanup', () => {
  it('org profile GET returns logoMeta and bannerMeta', async () => {
    const app = await setup(admin)
    expect((await put(app, validBody())).status).toBe(200)
    const res = await app.request('/api/orgs/alpha/profile')
    expect(res.status).toBe(200)
    const body = await res.json() as { profile: { logoMeta: { widths: number[] } | null; bannerMeta: unknown } }
    expect(body.profile.logoMeta?.widths).toEqual([96, 192])
    expect(body.profile.bannerMeta).toBeNull()
  })

  it('replacing a logo deletes old variants from R2 and clears the meta', async () => {
    const app = await setup(admin)
    expect((await put(app, validBody())).status).toBe(200)
    expect(await keys(app)).toContain(variantKey(LOGO_KEY, 96, 'webp'))

    const res = await app.request('/api/orgs/alpha/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ logoUrl: dataUrl(png(400, 400)) }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { profile: { logoUrl: string; logoMeta: unknown } }
    expect(body.profile.logoMeta).toBeNull()
    const all = await keys(app)
    expect(all).not.toContain(LOGO_KEY)
    expect(all).not.toContain(variantKey(LOGO_KEY, 96, 'webp'))
    expect(all).not.toContain(variantKey(LOGO_KEY, 192, 'webp'))
    expect(all).toContain(BANNER_KEY)
  })

  it('public frame payload returns imageMeta, and deleting a frame removes its variants', async () => {
    const app = await setup(admin)
    const second = 'frames/camp-1/frame-2-0123abcd.png'
    await app.client.execute({
      sql: 'INSERT INTO dp_frames (id, campaign_id, image_url, label, position) VALUES (?, ?, ?, ?, ?)',
      args: ['frame-2', 'camp-1', second, null, 1],
    })
    await app.env.MEDIA.put(second, png(1080, 1080))
    expect((await put(app, validBody(FRAME_KEY, [256, 512]))).status).toBe(200)

    const pub = await app.request('/api/dp/launch')
    const body = await pub.json() as { campaign: { frames: { id: string; imageMeta: { widths: number[] } | null }[] } }
    const frames = Object.fromEntries(body.campaign.frames.map((f) => [f.id, f.imageMeta]))
    expect(frames['frame-1']?.widths).toEqual([256, 512])
    expect(frames['frame-2']).toBeNull()

    const del = await app.request('/api/dp/camp-1/frames/frame-1', {
      method: 'DELETE',
      headers: { Origin: ORIGIN, 'X-Active-Org-Id': 'alpha' },
    })
    expect(del.status).toBe(200)
    const all = await keys(app)
    expect(all).not.toContain(FRAME_KEY)
    expect(all).not.toContain(variantKey(FRAME_KEY, 256, 'webp'))
    expect(all).not.toContain(variantKey(FRAME_KEY, 512, 'webp'))
    expect(all).toContain(second)
  })

  it('campaign delete removes every frame variant', async () => {
    const app = await setup(admin)
    expect((await put(app, validBody(FRAME_KEY, [256, 512]))).status).toBe(200)
    const del = await app.request('/api/dp/camp-1', {
      method: 'DELETE',
      headers: { Origin: ORIGIN, 'X-Active-Org-Id': 'alpha' },
    })
    expect(del.status).toBe(200)
    const all = await keys(app)
    expect(all).not.toContain(FRAME_KEY)
    expect(all).not.toContain(variantKey(FRAME_KEY, 256, 'webp'))
    expect(all).not.toContain(variantKey(FRAME_KEY, 512, 'webp'))
  })

  it('replacing a banner deletes its old variants and clears bannerMeta', async () => {
    const app = await setup(admin)
    expect((await put(app, validBody(BANNER_KEY, [640, 1280]))).status).toBe(200)
    const res = await app.request('/api/orgs/alpha/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ bannerUrl: dataUrl(png(1500, 500)) }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as { profile: { bannerMeta: unknown } }
    expect(body.profile.bannerMeta).toBeNull()
    const all = await keys(app)
    expect(all).not.toContain(BANNER_KEY)
    expect(all).not.toContain(variantKey(BANNER_KEY, 640, 'webp'))
    expect(all).not.toContain(variantKey(BANNER_KEY, 1280, 'webp'))
  })

  it('corrupt stored meta reads as null in GET /api/orgs', async () => {
    const app = await setup(admin)
    await app.client.execute("UPDATE organizations SET logo_url = '/media/orgs/alpha/logo-0123abcd.png', logo_meta = '{nope' WHERE id = 'alpha'")
    const res = await app.request('/api/orgs')
    const body = await res.json() as { orgs: { org_id: string; logoMeta: unknown }[] }
    const alpha = body.orgs.find((o) => o.org_id === 'alpha')
    expect(alpha).toBeDefined()
    expect(alpha?.logoMeta).toBeNull()
  })

  it('admin org delete removes logo and banner originals and variants', async () => {
    const app = await setup(admin)
    await app.client.execute({
      sql: 'INSERT INTO organizations (id, name, owner_id, logo_url, banner_url) VALUES (?, ?, ?, ?, ?)',
      args: ['gamma', 'Gamma', admin.id, 'orgs/gamma/logo-0123abcd.png', 'orgs/gamma/banner-0123abcd.png'],
    })
    await app.env.MEDIA.put('orgs/gamma/logo-0123abcd.png', png(1000, 1000))
    await app.env.MEDIA.put('orgs/gamma/banner-0123abcd.png', png(2400, 800))
    expect((await put(app, validBody('orgs/gamma/logo-0123abcd.png', [96, 192]))).status).toBe(200)
    expect((await put(app, validBody('orgs/gamma/banner-0123abcd.png', [640]))).status).toBe(200)
    expect((await keys(app)).filter((k) => k.startsWith('orgs/gamma/'))).toHaveLength(5)

    const del = await app.request('/api/orgs/admin/gamma', { method: 'DELETE', headers: { Origin: ORIGIN } })
    expect(del.status).toBe(200)
    const all = await keys(app)
    expect(all.filter((k) => k.startsWith('orgs/gamma/'))).toEqual([])
    expect(all).toContain(LOGO_KEY)
  })

  it('stores the placeholder with the sniffed format, not the declared MIME', async () => {
    const app = await setup(member)
    const body = validBody(LOGO_KEY, [96])
    body.placeholder = dataUrl(png(16, 16), 'image/webp')
    const res = await put(app, body)
    expect(res.status).toBe(200)
    const out = await res.json() as { meta: { ph: string } }
    expect(out.meta.ph.startsWith('data:image/png;base64,')).toBe(true)
  })

  it('rate limits variant writes per user', async () => {
    const app = await setup(member)
    let last = 0
    for (let i = 0; i < 31; i += 1) last = (await put(app, null, 'not json')).status
    expect(last).toBe(429)
  })
})

describe('parseImageMeta bounds', () => {
  const ok = { w: 100, h: 100, fmt: 'webp', widths: [96], ph: '' }
  it('accepts a sane meta and rejects out-of-range values', () => {
    expect(parseImageMeta(JSON.stringify(ok))).not.toBeNull()
    expect(parseImageMeta(JSON.stringify({ ...ok, w: 0 }))).toBeNull()
    expect(parseImageMeta(JSON.stringify({ ...ok, h: 20001 }))).toBeNull()
    expect(parseImageMeta(JSON.stringify({ ...ok, widths: [1, 2, 3, 4, 5] }))).toBeNull()
    expect(parseImageMeta(JSON.stringify({ ...ok, widths: [5000] }))).toBeNull()
    expect(parseImageMeta(JSON.stringify({ ...ok, ph: 'javascript:alert(1)' }))).toBeNull()
    expect(parseImageMeta(JSON.stringify({ ...ok, ph: 'data:image/png;base64,AAAA' }))).not.toBeNull()
  })
})

describe('legacy /media/-prefixed rows', () => {
  it('records meta on org and frame rows stored with the prefix', async () => {
    const app = await setup(admin)
    await app.client.execute({ sql: 'UPDATE organizations SET logo_url = ? WHERE id = ?', args: [`/media/${LOGO_KEY}`, 'alpha'] })
    await app.client.execute({ sql: 'UPDATE dp_frames SET image_url = ? WHERE id = ?', args: [`/media/${FRAME_KEY}`, 'frame-1'] })

    expect((await put(app, validBody(LOGO_KEY))).status).toBe(200)
    expect((await put(app, validBody(`/media/${LOGO_KEY}`))).status).toBe(200)
    expect((await put(app, validBody(FRAME_KEY, [256]))).status).toBe(200)

    const org = await app.client.execute("SELECT logo_url, logo_meta FROM organizations WHERE id = 'alpha'")
    expect(org.rows[0].logo_url).toBe(`/media/${LOGO_KEY}`)
    expect(JSON.parse(String(org.rows[0].logo_meta)).widths).toEqual([96, 192])
    const frame = await app.client.execute("SELECT image_meta FROM dp_frames WHERE id = 'frame-1'")
    expect(JSON.parse(String(frame.rows[0].image_meta)).widths).toEqual([256])
  })
})

describe('image profiles', () => {
  it('match the browser maker in src/lib/images/profiles.ts', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/images/profiles.ts'), 'utf8')
    for (const [kind, widths] of Object.entries(PROFILE_WIDTHS)) {
      const match = new RegExp(`${kind}:\\s*\\[([^\\]]+)\\]`).exec(source)
      expect(match, kind).not.toBeNull()
      expect(match![1].split(',').map((n) => Number(n.trim()))).toEqual([...widths])
    }
  })
})
