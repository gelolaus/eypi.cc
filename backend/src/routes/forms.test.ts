import { describe, it, expect, vi } from 'vitest'
import type { Bindings } from '../lib/db'

vi.mock('../middleware/orgGuard', () => ({
  isOrgFeature: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
    c.set('orgId', 'org-test')
    await next()
  },
}))

import app from '../index'

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

describe('form templates', () => {
  it('does not serve /forms/templates/* without the org gate', async () => {
    const res = await app.request('/forms/templates/waiver_form.docx')

    expect(res.status).toBe(404)
    expect(await responseBody(res)).toEqual(NOT_FOUND)
  })

  it('serves allowlisted templates only through /api/forms/templates/:file for activated members', async () => {
    const fetchAsset = vi.fn(async () => new Response(DOCX_BYTES.slice(), { status: 200 }))
    const env = { ASSETS: { fetch: fetchAsset } } as unknown as Bindings

    const allowed = await app.request('/api/forms/templates/waiver_form.docx', {}, env)

    expect(allowed.status).toBe(200)
    expect(new Uint8Array(await allowed.arrayBuffer())).toEqual(DOCX_BYTES)
    expect(fetchAsset).toHaveBeenCalledOnce()

    fetchAsset.mockClear()

    const blocked = await app.request('/api/forms/templates/secret.docx', {}, env)

    expect(blocked.status).toBe(404)
    expect(fetchAsset).not.toHaveBeenCalled()
  })
})
