// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LINK_QR_CONFIG } from '@shared/linkQrConfig'
import LinkEditorPanel from './LinkEditorPanel.vue'

vi.mock('@/utils/renderLinkQr', () => ({
  renderLinkQrCanvas: vi.fn(async () => document.createElement('canvas')),
  downloadLinkQrPng: vi.fn(),
}))

vi.mock('@/utils/normalizeQrLogo', () => ({
  normalizeQrLogoDataUrl: vi.fn(async () => 'data:image/png;base64,AAAA'),
}))

class ImmediateReader {
  result: string | null = null
  onload: null | (() => void) = null
  onerror: null | (() => void) = null
  readAsDataURL() {
    this.result = 'data:image/png;base64,AAAA'
    this.onload?.()
  }
}

const staleLogo = '/media/qr-logos/link-1-aaaaaaaa.png'

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function pathname(input: RequestInfo | URL): string {
  return new URL(String(input), 'https://api.eypi.cc').pathname
}

function detail() {
  return {
    id: 'link-1',
    slug: 'alpha1',
    url: 'https://example.com/a',
    clicks: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: null,
    disabledAt: null,
    disabledReason: null,
    protected: false,
    hasLogo: true,
    qrConfig: { ...DEFAULT_LINK_QR_CONFIG, logoDataUrl: staleLogo },
  }
}

describe('LinkEditorPanel image save', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('does not commit a stale QR logo while that upload is in flight', async () => {
    vi.stubGlobal('FileReader', ImmediateReader)
    const saves: Array<{ qrConfig?: { logoDataUrl?: string | null } }> = []
    const pending: { release: ((response: Response) => void) | null } = { release: null }
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = pathname(input)
      const method = init?.method ?? 'GET'
      if (path === '/api/links/link-1' && method === 'GET') return json(detail())
      if (path === '/api/links/link-1/qr-logo' && method === 'PUT') {
        return new Promise<Response>((resolve) => {
          pending.release = resolve
        })
      }
      if (path === '/api/links/link-1' && method === 'PATCH') {
        saves.push(JSON.parse(String(init?.body)) as { qrConfig?: { logoDataUrl?: string | null } })
        return json(detail())
      }
      return json({ error: { code: 'not_found', message: 'Missing.' } })
    }))

    const wrapper = mount(LinkEditorPanel, {
      props: { open: true, linkId: 'link-1' },
      attachTo: document.body,
    })
    await flushPromises()

    const input = document.querySelector('#qr-center-logo')
    if (!(input instanceof HTMLInputElement)) throw new Error('missing logo input')
    const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [file] })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    const releaseUpload = pending.release
    if (!releaseUpload) throw new Error('upload did not start')

    const save = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Save changes')
    expect(save).toBeTruthy()
    save!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(saves).toEqual([])
    expect((save as HTMLButtonElement).disabled).toBe(true)

    releaseUpload(json({
      url: '/media/qr-logos/link-1-bbbbbbbb.png',
      logo: { key: 'qr-logos/link-1-bbbbbbbb.png' },
    }))
    await flushPromises()
    expect(saves).toEqual([])
    wrapper.unmount()
  })
})
