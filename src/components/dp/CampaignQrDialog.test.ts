// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import CampaignQrDialog from './CampaignQrDialog.vue'
import { useToast } from '@/composables/useToast'
import { DEFAULT_LINK_QR_CONFIG } from '@shared/linkQrConfig'
import { downloadLinkQrPng, renderLinkQrCanvas } from '@/utils/renderLinkQr'

vi.mock('@/utils/renderLinkQr', () => ({
  renderLinkQrCanvas: vi.fn(),
  downloadLinkQrPng: vi.fn(),
}))

const URL_TEXT = 'https://eypi.cc/frames/launch'
let wrapper: VueWrapper | undefined

async function open() {
  wrapper = mount(CampaignQrDialog, {
    attachTo: document.body,
    props: { open: true, title: 'Launch', slug: 'launch' },
  })
  await flushPromises()
  return wrapper
}

const buttonNamed = (name: string) => [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)

beforeEach(() => {
  vi.mocked(renderLinkQrCanvas).mockReset().mockResolvedValue({ toDataURL: () => 'data:image/png;base64,QR' } as unknown as HTMLCanvasElement)
  vi.mocked(downloadLinkQrPng).mockReset().mockResolvedValue(undefined)
  const toast = useToast()
  while (toast.toasts.value.length > 0) toast.dismiss(toast.toasts.value[0].id)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('CampaignQrDialog', () => {
  it('shows the campaign title, the link as text and the QR for that link', async () => {
    await open()
    expect(document.body.textContent).toContain('Launch')
    expect(document.body.textContent).toContain(URL_TEXT)
    expect(renderLinkQrCanvas).toHaveBeenCalledWith(512, URL_TEXT, DEFAULT_LINK_QR_CONFIG, 'white')
    const image = document.body.querySelector<HTMLImageElement>('[role="dialog"] img')
    expect(image?.getAttribute('src')).toBe('data:image/png;base64,QR')
    expect(image?.getAttribute('alt')).toBe('QR code for https://eypi.cc/frames/launch')
  })

  it('does not draw anything while closed', async () => {
    wrapper = mount(CampaignQrDialog, { attachTo: document.body, props: { open: false, title: 'Launch', slug: 'launch' } })
    await flushPromises()
    expect(renderLinkQrCanvas).not.toHaveBeenCalled()
  })

  it('downloads a 1024 px transparent png named after the link', async () => {
    await open()
    buttonNamed('Download PNG')!.click()
    await flushPromises()
    expect(downloadLinkQrPng).toHaveBeenCalledWith(1024, URL_TEXT, DEFAULT_LINK_QR_CONFIG, 'eypi-frame-launch-qr.png', 'transparent')
  })

  it('says so and stays open when the picture cannot be made', async () => {
    vi.mocked(renderLinkQrCanvas).mockRejectedValue(new Error('no canvas'))
    await open()
    expect(document.body.textContent).toContain('Could not make the QR code.')
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('shows the same error when the download fails', async () => {
    vi.mocked(downloadLinkQrPng).mockRejectedValue(new Error('encode'))
    await open()
    buttonNamed('Download PNG')!.click()
    await flushPromises()
    expect(useToast().toasts.value.map((t) => t.message)).toContain('Could not make the QR code.')
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })
})
