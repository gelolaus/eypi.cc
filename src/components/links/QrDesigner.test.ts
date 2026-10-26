// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LINK_QR_CONFIG } from '@shared/linkQrConfig'
import QrDesigner from './QrDesigner.vue'

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

describe('QrDesigner logo upload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the uploaded logo by URL', async () => {
    vi.stubGlobal('FileReader', ImmediateReader)
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.eypi.cc/api/links/link-1/qr-logo')
      expect(init?.method).toBe('PUT')
      const body = JSON.parse(String(init?.body)) as { imageData?: string }
      expect(body.imageData).toBe('data:image/png;base64,AAAA')
      return new Response(JSON.stringify({
        url: '/media/qr-logos/link-1-abcd1234.png',
        logo: { key: 'qr-logos/link-1-abcd1234.png' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(QrDesigner, {
      props: {
        slug: 'alpha1',
        linkId: 'link-1',
        trackScans: true,
        config: { ...DEFAULT_LINK_QR_CONFIG },
      },
    })
    const input = wrapper.get('#qr-center-logo')
    const file = new File([new Uint8Array([1, 2, 3])], 'logo.png', { type: 'image/png' })
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    await flushPromises()

    const emitted = wrapper.emitted('update:config')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(emitted?.[0]?.[0]).toMatchObject({
      logoDataUrl: '/media/qr-logos/link-1-abcd1234.png',
    })
    expect(JSON.stringify(emitted)).not.toContain('data:')
    wrapper.unmount()
  })
})
