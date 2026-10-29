import { describe, expect, it, vi } from 'vitest'
import { QR_LOGO_DATA_URL_MAX } from '../../../shared/linkQrConfig'
import { createTestApp, type TestUser } from '../test/createTestApp'

const ORIGIN = 'https://eypi.cc'

const owner: TestUser = {
  id: 'user-1',
  email: 'ada@student.apc.edu.ph',
  name: 'Ada',
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

function dataUrl(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`
}

function putLogo(bytes: Uint8Array): RequestInit {
  return {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
    },
    body: JSON.stringify({ imageData: dataUrl(bytes) }),
  }
}

describe('PUT /api/links/:id/qr-logo', () => {
  it('QR logo replace deletes the old object', async () => {
    const { request, client, env } = await createTestApp({
      user: owner,
      seed: async (db) => {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
          args: [owner.id, owner.email, owner.name, owner.role],
        })
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug, qr_config)
            VALUES (?, ?, ?, ?, ?)`,
          args: [
            'link-1',
            owner.id,
            'https://example.com/a',
            'alpha1',
            JSON.stringify({
              dotType: 'dots',
              eyeFrameType: 'dot',
              eyeBallType: 'dot',
              color: '#112233',
              logoDataUrl: null,
            }),
          ],
        })
      },
    })

    const first = await request('/api/links/link-1/qr-logo', putLogo(png(2, 2)))
    expect(first.status).toBe(200)
    const firstBody = await first.json() as { url: string; logo: { key: string } }
    expect(firstBody.logo).toEqual({ key: expect.stringMatching(/^qr-logos\/link-1-[0-9a-f]{8}\.png$/) })
    expect(firstBody.url).toBe(`/media/${firstBody.logo.key}`)
    expect(await env.MEDIA.get(firstBody.logo.key)).not.toBeNull()

    const second = await request('/api/links/link-1/qr-logo', putLogo(png(3, 5)))
    expect(second.status).toBe(200)
    const secondBody = await second.json() as { url: string; logo: { key: string } }
    expect(secondBody.logo.key).not.toBe(firstBody.logo.key)
    expect(secondBody.url).toBe(`/media/${secondBody.logo.key}`)

    const row = await client.execute({
      sql: 'SELECT qr_config FROM links WHERE id = ?',
      args: ['link-1'],
    })
    const stored = JSON.parse(String(row.rows[0]?.qr_config)) as {
      color?: string
      dotType?: string
      logo?: { key?: string }
      logoDataUrl?: string | null
    }
    expect(stored.logo).toEqual({ key: secondBody.logo.key })
    expect(stored.color).toBe('#112233')
    expect(stored.dotType).toBe('dots')
    expect(JSON.stringify(stored)).not.toContain('data:')
    expect(await env.MEDIA.get(firstBody.logo.key)).toBeNull()
    expect(await env.MEDIA.get(secondBody.logo.key)).not.toBeNull()
  })

  it('clears the stored QR logo when imageData is null', async () => {
    const { request, client, env } = await createTestApp({
      user: owner,
      seed: async (db) => {
        await db.execute({
          sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
          args: [owner.id, owner.email, owner.name, owner.role],
        })
        await db.execute({
          sql: `INSERT INTO links (id, user_id, original_url, slug, qr_config)
            VALUES (?, ?, ?, ?, ?)`,
          args: [
            'link-1',
            owner.id,
            'https://example.com/a',
            'alpha1',
            JSON.stringify({
              dotType: 'square',
              eyeFrameType: 'square',
              eyeBallType: 'square',
              color: '#DEAC4B',
            }),
          ],
        })
      },
    })

    const uploaded = await request('/api/links/link-1/qr-logo', putLogo(png(4, 4)))
    expect(uploaded.status).toBe(200)
    const body = await uploaded.json() as { logo: { key: string } }

    const cleared = await request('/api/links/link-1/qr-logo', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
      body: JSON.stringify({ imageData: null }),
    })
    expect(cleared.status).toBe(200)
    expect(await cleared.json()).toEqual({ url: null, logo: null })

    const row = await client.execute({
      sql: 'SELECT qr_config FROM links WHERE id = ?',
      args: ['link-1'],
    })
    const stored = JSON.parse(String(row.rows[0]?.qr_config)) as { color?: string; logo?: unknown }
    expect(stored.logo).toBeUndefined()
    expect(stored.color).toBe('#DEAC4B')
    expect(await env.MEDIA.get(body.logo.key)).toBeNull()
  })
})

const LOGO_KEY = 'qr-logos/link-1-abcd1234.png'

function storedQrConfig(logoKey: string): string {
  return JSON.stringify({
    dotType: 'square',
    eyeFrameType: 'square',
    eyeBallType: 'square',
    color: '#112233',
    logo: { key: logoKey },
  })
}

async function linkWithLogo() {
  const harness = await createTestApp({
    user: owner,
    seed: async (db) => {
      await db.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [owner.id, owner.email, owner.name, owner.role],
      })
      await db.execute({
        sql: `INSERT INTO links (id, user_id, original_url, slug, qr_config)
          VALUES (?, ?, ?, ?, ?)`,
        args: ['link-1', owner.id, 'https://example.com/a', 'alpha1', storedQrConfig(LOGO_KEY)],
      })
    },
  })
  await harness.env.MEDIA.put(LOGO_KEY, png(2, 2))
  return harness
}

describe('link logo cleanup', () => {
  it('deletes the R2 logo when the link is deleted', async () => {
    const { request, client, env } = await linkWithLogo()

    const res = await request('/api/links/link-1', {
      method: 'DELETE',
      headers: { Origin: ORIGIN },
    })

    expect(res.status).toBe(200)
    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')
    expect(Number(rows.rows[0]?.n)).toBe(0)
    expect(await env.MEDIA.get(LOGO_KEY)).toBeNull()
  })

  it('still deletes the link when the logo object cannot be removed and logs the key', async () => {
    const { request, client, env } = await linkWithLogo()
    vi.spyOn(env.MEDIA, 'delete').mockRejectedValue(new Error('r2 down'))
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await request('/api/links/link-1', {
      method: 'DELETE',
      headers: { Origin: ORIGIN, 'CF-Connecting-IP': '203.0.113.10' },
    })

    expect(res.status).toBe(200)
    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')
    expect(Number(rows.rows[0]?.n)).toBe(0)
    const logged = errors.mock.calls.map((call) => call.map(String).join(' ')).join('\n')
    expect(logged).toContain(LOGO_KEY)
    expect(logged).not.toContain(owner.email)
    expect(logged).not.toContain('203.0.113.10')
    expect(await env.MEDIA.get(LOGO_KEY)).not.toBeNull()
  })

  it('rejects an oversized logo on PATCH and keeps the stored object', async () => {
    const { request, client, env } = await linkWithLogo()

    const res = await request('/api/links/link-1', {
      method: 'PATCH',
      headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qrConfig: {
          dotType: 'dots',
          eyeFrameType: 'dot',
          eyeBallType: 'dot',
          color: '#AABBCC',
          logoDataUrl: `data:image/png;base64,${'a'.repeat(QR_LOGO_DATA_URL_MAX)}`,
        },
      }),
    })

    expect(res.status).toBe(422)
    const row = await client.execute({
      sql: 'SELECT qr_config FROM links WHERE id = ?',
      args: ['link-1'],
    })
    const stored = JSON.parse(String(row.rows[0]?.qr_config)) as { color?: string; logo?: { key?: string } }
    expect(stored.logo).toEqual({ key: LOGO_KEY })
    expect(stored.color).toBe('#112233')
    expect(await env.MEDIA.get(LOGO_KEY)).not.toBeNull()
  })
})
