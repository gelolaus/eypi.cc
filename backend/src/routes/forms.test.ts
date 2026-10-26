import { describe, it, expect, vi } from 'vitest'
import type { Bindings } from '../lib/db'

vi.mock('../middleware/orgGuard', () => ({
  isOrgFeature: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('orgId', 'org-test')
    await next()
  },
}))

import { app } from '../index'

const NOT_FOUND = { error: { code: 'not_found', message: 'Not found' } }

/** DOCX files are ZIP archives; these bytes are the local-file header. */
const DOCX_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00])

async function responseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const TEMPLATE_MISSING = {
  error: {
    code: 'template_missing',
    message: "This form's template is missing. Tell the eypi.cc admin.",
  },
}

const SHARED_CATALOG = [
  {
    id: 'concessionaire',
    title: 'Concessionaire Form',
    description: 'MOA, waiver, reply form, and related docs in one ZIP.',
    route: '/forms/concessionaire',
  },
  {
    id: 'visitors-pass',
    title: 'Visitors Pass',
    description: 'Generate a visitors pass from a CSV list of names.',
    route: '/forms/visitors-pass',
  },
  {
    id: 'letter-of-intent',
    title: 'Letter of Intent & Waiver',
    description: 'Batch generate student waivers into a ZIP file from a CSV list.',
    route: '/forms/letter-of-intent',
  },
]

function mediaEnv() {
  const fetchAsset = vi.fn(async () => new Response(DOCX_BYTES.slice(), { status: 200 }))
  const get = vi.fn(async (key: string) => {
    if (key !== 'templates/waiver_form.docx') return null
    return {
      httpEtag: '"abc123"',
      arrayBuffer: async () => DOCX_BYTES.slice().buffer,
    }
  })
  const env = {
    ASSETS: { fetch: fetchAsset },
    MEDIA: { get },
  } as unknown as Bindings
  return { env, fetchAsset, get }
}

describe('form templates', () => {
  it('does not serve /forms/templates/* without the org gate', async () => {
    const res = await app.request('/forms/templates/waiver_form.docx')

    expect(res.status).toBe(404)
    expect(await responseBody(res)).toEqual(NOT_FOUND)
  })

  it('returns the shared form catalog', async () => {
    const res = await app.request('/api/forms', {}, {} as Bindings)

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ forms: SHARED_CATALOG })
  })

  it('serves allowlisted templates from R2 with an ETag and a private cache', async () => {
    const { env, fetchAsset, get } = mediaEnv()

    const allowed = await app.request('/api/forms/templates/waiver_form.docx', {}, env)

    expect(allowed.status).toBe(200)
    expect(new Uint8Array(await allowed.arrayBuffer())).toEqual(DOCX_BYTES)
    expect(allowed.headers.get('ETag')).toBe('"abc123"')
    expect(allowed.headers.get('Cache-Control')).toBe('private, max-age=3600')
    expect(get).toHaveBeenCalledWith('templates/waiver_form.docx')
    expect(fetchAsset).not.toHaveBeenCalled()

    get.mockClear()

    const blocked = await app.request('/api/forms/templates/secret.docx', {}, env)

    expect(blocked.status).toBe(404)
    expect(await blocked.json()).toEqual(NOT_FOUND)
    expect(get).not.toHaveBeenCalled()
  })

  it('returns 304 when If-None-Match matches the template ETag', async () => {
    const { env } = mediaEnv()

    const res = await app.request('/api/forms/templates/waiver_form.docx', {
      headers: { 'If-None-Match': '"abc123"' },
    }, env)

    expect(res.status).toBe(304)
    expect(res.headers.get('ETag')).toBe('"abc123"')
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600')
    expect(await res.text()).toBe('')
  })

  it('returns template_missing when an allowlisted template is not in R2', async () => {
    const fetchAsset = vi.fn(async () => new Response(null, { status: 404 }))
    const env = {
      ASSETS: { fetch: fetchAsset },
      MEDIA: { get: async () => null },
    } as unknown as Bindings

    const res = await app.request('/api/forms/templates/waiver_form.docx', {}, env)

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual(TEMPLATE_MISSING)
    expect(fetchAsset).not.toHaveBeenCalled()
  })
})
