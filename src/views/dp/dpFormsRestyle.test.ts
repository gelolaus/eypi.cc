// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DpFrameUploader from '@/components/dp/DpFrameUploader.vue'
import DpPublicView from './DpPublicView.vue'
import DpCampaignsView from './DpCampaignsView.vue'
import DpNewCampaignView from './DpNewCampaignView.vue'
import FormsHomeView from '../forms/FormsHomeView.vue'
import ConcessionaireView from '../forms/generators/ConcessionaireView.vue'

import uploader from '@/components/dp/DpFrameUploader.vue?raw'
import dpCampaigns from './DpCampaignsView.vue?raw'
import dpEdit from './DpEditCampaignView.vue?raw'
import dpNew from './DpNewCampaignView.vue?raw'
import dpPublic from './DpPublicView.vue?raw'
import framesLayout from './FramesManageLayout.vue?raw'
import formsHome from '../forms/FormsHomeView.vue?raw'
import formsLayout from '../forms/FormsLayout.vue?raw'
import concessionaire from '../forms/generators/ConcessionaireView.vue?raw'
import letter from '../forms/generators/LetterOfIntentView.vue?raw'
import visitors from '../forms/generators/VisitorsPassView.vue?raw'

vi.mock('file-saver', () => ({ saveAs: vi.fn() }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { slug: 'launch' } }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))

const sources = { uploader, dpCampaigns, dpEdit, dpNew, dpPublic, framesLayout, formsHome, formsLayout, concessionaire, letter, visitors }

class FakeImage {
  naturalWidth = 1200
  naturalHeight = 1200
  width = 1200
  height = 1200
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_v: string) { queueMicrotask(() => this.onload?.()) }
}

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1 })
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).includes('/api/dp/launch')) {
      return new Response(JSON.stringify({ status: 'ok', campaign: { id: 'c', title: 'Launch', slug: 'launch', description: null, captionTemplate: 'hi', frames: [{ id: 'f', imageUrl: '/f.png', url: '/f.png', label: null, width: 1200, height: 1200, position: 0 }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    if (String(url).includes('/api/dp')) {
      return new Response(JSON.stringify({ status: 'ok', campaigns: [{ id: 'c1', slug: 'launch', title: 'Launch', description: null, downloadCount: 2, frameCount: 1 }] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response('missing', { status: 404 })
  }))
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ clearRect: vi.fn(), drawImage: vi.fn() })) as never
})
afterEach(() => vi.unstubAllGlobals())

describe('dp and forms restyle', () => {
  it.each(Object.entries(sources))('%s has no legacy classes, scoped styles or hard-coded colours', (_n, src) => {
    expect(src).not.toMatch(/(?<![a-z])g-(text|muted|border|accent|primary|surface|bg)|mica|gold|tap-scale|apc-|btn-(primary|secondary|danger|gold|lg)|\bcontrol\b|field-input|dark:(bg|text|border)-(slate|gray|white)|\bslate-\d|\bgray-\d|\bred-\d|\bemerald-\d|bg-white|text-white|#[0-9a-fA-F]{3,8}\b|\breveal\b|\bdelay-|text-data|text-card-title|text-section-title|@apply|@reference|<style|useReveal|dp-checker/)
  })

  it('public view: zoom is the Slider primitive, labelled, keyboard drives the same values', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close() {} })))
    const w = mount(DpPublicView, { global: { stubs: { RouterLink: true } }, attachTo: document.body })
    await flushPromises(); await flushPromises()
    expect(w.find('[data-slot="slider"]').exists()).toBe(false) // only once a photo is chosen
    const input = w.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [new File([new Uint8Array([1])], 'p.jpg', { type: 'image/jpeg' })] })
    await input.trigger('change')
    await flushPromises()
    expect(w.find('input[type="range"]').exists()).toBe(false)
    const thumb = w.get('[data-slot="slider-thumb"]')
    expect(thumb.attributes('role')).toBe('slider')
    expect(thumb.attributes('aria-label')).toBe('Zoom')
    expect(thumb.attributes('aria-valuemin')).toBe('20')
    expect(thumb.attributes('aria-valuemax')).toBe('800')
    expect(thumb.attributes('aria-valuenow')).toBe('100')
    await thumb.trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(w.get('[data-slot="slider-thumb"]').attributes('aria-valuenow')).toBe('101')
    w.unmount()
  })

  it('public view: canvas is not painted with theme colours', async () => {
    const w = mount(DpPublicView, { global: { stubs: { RouterLink: true } } })
    await flushPromises(); await flushPromises()
    expect(dpPublic).not.toMatch(/fillStyle|fillRect|getComputedStyle|--background|var\(--/)
    const canvas = w.get('canvas')
    expect(canvas.classes().join(' ')).not.toMatch(/\bbg-/)
    expect(canvas.attributes('style') ?? '').not.toMatch(/background/)
  })

  it('uploader: drop zone is bg-dot-grid with focus ring and toggles a ring on drag-over', async () => {
    const w = mount(DpFrameUploader, { props: { frames: [] } })
    const zone = w.get('[role="button"]')
    expect(zone.classes()).toContain('bg-dot-grid')
    expect(zone.classes().join(' ')).toContain('focus-visible:ring')
    expect(zone.attributes('data-dragging')).toBe('false')
    expect(zone.classes()).not.toContain('ring-3')
    await zone.trigger('dragover')
    expect(w.get('[role="button"]').attributes('data-dragging')).toBe('true')
    expect(w.get('[role="button"]').classes()).toContain('ring-3')
    await zone.trigger('dragleave')
    expect(w.get('[role="button"]').attributes('data-dragging')).toBe('false')
    expect(w.get('[role="button"]').classes()).not.toContain('ring-3')
    await zone.trigger('dragover')
    await zone.trigger('drop', { dataTransfer: { files: [] } })
    expect(w.get('[role="button"]').classes()).not.toContain('ring-3')
  })

  it('uploader: row controls are primitives larger than xs', () => {
    const w = mount(DpFrameUploader, { props: { frames: [{ id: 'a', src: 'data:image/png;base64,aa' }] } })
    for (const label of ['Move up', 'Move down', 'Remove frame']) {
      const b = w.get(`[aria-label="${label}"]`)
      expect(b.attributes('data-slot')).toBe('button')
      expect(b.attributes('data-size')).not.toBe('xs')
    }
  })

  it('campaigns list: Input search, Card items and Button actions', async () => {
    const w = mount(DpCampaignsView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
    await flushPromises()
    expect(w.get('input[type="search"]').attributes('data-slot')).toBe('input')
    expect(w.findAll('[data-slot="card"]').length).toBeGreaterThan(0)
    expect(w.findAll('button[data-slot="button"]').map((b) => b.text())).toContain('Copy link')
  })

  it('new campaign: every field has a Label and the submit is a full-width primitive button', () => {
    const w = mount(DpNewCampaignView, { global: { stubs: { RouterLink: true } } })
    for (const id of ['new-campaign-title', 'new-campaign-slug', 'new-campaign-description', 'new-campaign-caption']) {
      expect(w.find(`label[data-slot="label"][for="${id}"]`).exists()).toBe(true)
    }
    expect(w.get('textarea').attributes('data-slot')).toBe('textarea')
    const submit = w.get('button[type="submit"]')
    expect(submit.attributes('data-slot')).toBe('button')
    expect(submit.classes()).toContain('w-full')
    expect(w.text()).not.toContain('—')
  })

  it('forms catalog: cards use Card and the search is an Input', async () => {
    const w = mount(FormsHomeView)
    await flushPromises()
    expect(w.findAll('[data-slot="card"]').length).toBeGreaterThan(0)
    expect(w.get('input[type="search"]').attributes('data-slot')).toBe('input')
  })

  it('generator: labelled Inputs with aria-invalid and a primitive submit button', async () => {
    const w = mount(ConcessionaireView)
    expect(w.find('label[data-slot="label"][for="COMPANY_NAME"]').exists()).toBe(true)
    expect(w.get('input#COMPANY_NAME').attributes('data-slot')).toBe('input')
    const submit = w.get('button[type="submit"]')
    expect(submit.attributes('data-slot')).toBe('button')
    expect(submit.attributes('data-size') ?? 'default').not.toBe('xs')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(w.get('#COMPANY_NAME').attributes('aria-invalid')).toBe('true')
  })
})
