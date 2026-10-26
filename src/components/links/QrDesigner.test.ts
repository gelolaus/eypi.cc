// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LINK_QR_CONFIG, QR_DEFAULT_BACKGROUND } from '@shared/linkQrConfig'
import { downloadLinkQrPng, renderLinkQrCanvas } from '@/utils/renderLinkQr'
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

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

describe('QrDesigner contrast', () => {
  it('defaults to dark modules on a light background', () => {
    expect(luminance(DEFAULT_LINK_QR_CONFIG.color)).toBeLessThan(0.1)
    expect(luminance(QR_DEFAULT_BACKGROUND)).toBeGreaterThan(0.9)
  })

  it('draws the preview on an explicit white container and renders on white', async () => {
    const wrapper = mount(QrDesigner, {
      props: { slug: 'alpha1', linkId: null, trackScans: true, config: { ...DEFAULT_LINK_QR_CONFIG } },
    })
    await flushPromises()
    const preview = wrapper.get('[data-qr-preview]')
    expect(preview.classes()).toContain('bg-white')
    expect(preview.classes().some((c) => c.startsWith('dark:bg-'))).toBe(false)
    const calls = vi.mocked(renderLinkQrCanvas).mock.calls
    const last = calls[calls.length - 1]!
    expect(last[2].color).toBe(DEFAULT_LINK_QR_CONFIG.color)
    expect(last[3]).toBe('white')
    wrapper.unmount()
  })

  it('keeps the matrix colour input working', async () => {
    const wrapper = mount(QrDesigner, {
      props: { slug: 'alpha1', linkId: null, trackScans: true, config: { ...DEFAULT_LINK_QR_CONFIG } },
    })
    await wrapper.get('#qr-matrix-color').setValue('#112233')
    expect(wrapper.emitted('update:config')?.[0]?.[0]).toMatchObject({ color: '#112233' })
    wrapper.unmount()
  })

  it('exports a transparent PNG of dark modules by design', async () => {
    const wrapper = mount(QrDesigner, {
      props: { slug: 'alpha1', linkId: null, trackScans: true, config: { ...DEFAULT_LINK_QR_CONFIG } },
    })
    const exportButton = wrapper.findAll('button').find((b) => b.text().includes('Export PNG'))!
    await exportButton.trigger('click')
    await flushPromises()
    const call = vi.mocked(downloadLinkQrPng).mock.calls[0]!
    expect(call[2].color).toBe(DEFAULT_LINK_QR_CONFIG.color)
    expect(call[4]).toBe('transparent')
    wrapper.unmount()
  })
})
