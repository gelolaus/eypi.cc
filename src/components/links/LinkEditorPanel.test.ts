// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LinkEditorPanel from './LinkEditorPanel.vue'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('@/router', () => ({
  default: {
    push,
    replace: vi.fn(),
    currentRoute: { value: { fullPath: '/links', name: 'links' } },
  },
}))

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

describe('LinkEditorPanel slug availability', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const slug = new URL(requestUrl(input)).searchParams.get('slug')
      if (slug === 'taken-slug') return json({ available: false, reason: 'taken' })
      if (slug === 'links') return json({ available: false, reason: 'reserved' })
      if (slug === 'no') return json({ available: false, reason: 'invalid' })
      return json({ available: true })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  function editorRoot(): HTMLElement {
    const root = document.getElementById('link-editor')
    if (!root) throw new Error('missing link editor')
    return root
  }

  async function setControl(selector: string, value: string) {
    const input = editorRoot().querySelector(selector)
    if (!(input instanceof HTMLInputElement)) throw new Error(`missing ${selector}`)
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
  }

  async function typeSlug(value: string) {
    const wrapper = mount(LinkEditorPanel, {
      props: { open: true, linkId: null },
      attachTo: document.body,
      global: { stubs: { QrDesigner: { template: '<div />' } } },
    })
    await setControl('[aria-label="Custom slug"]', value)
    return wrapper
  }

  it('debounces slug typing by 300 ms and shows availability', async () => {
    const wrapper = await typeSlug('c')
    await vi.advanceTimersByTimeAsync(200)
    await wrapper.get('[aria-label="Custom slug"]').setValue('Campus-Day')
    await vi.advanceTimersByTimeAsync(299)

    const early = fetchMock.mock.calls.filter((call) => String(requestUrl(call[0])).includes('slug-available'))
    expect(early).toHaveLength(0)
    expect(editorRoot().textContent).not.toContain('Available')

    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()

    const checks = fetchMock.mock.calls
      .map((call) => requestUrl(call[0]))
      .filter((url) => url.includes('slug-available'))
    expect(checks).toEqual([
      expect.stringContaining('/api/links/slug-available?slug=campus-day'),
    ])
    expect(editorRoot().textContent).toContain('Available')
    wrapper.unmount()
  })

  it('shows Taken, Reserved, and Not allowed', async () => {
    const taken = await typeSlug('taken-slug')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(editorRoot().textContent).toContain('Taken')
    taken.unmount()

    const reserved = await typeSlug('links')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(editorRoot().textContent).toContain('Reserved')
    reserved.unmount()

    const invalid = await typeSlug('no')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(editorRoot().textContent).toContain('Not allowed')
    invalid.unmount()
  })

  it('shows an inline error and does not create a link for another shortener', async () => {
    const wrapper = mount(LinkEditorPanel, {
      props: { open: true, linkId: null },
      attachTo: document.body,
      global: { stubs: { QrDesigner: { template: '<div />' } } },
    })
    await setControl('[aria-label="Destination"]', 'https://bit.ly/abc')
    const create = [...editorRoot().querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Create link')
    expect(create).toBeTruthy()
    create!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()

    expect(editorRoot().textContent).toContain('Use the full destination instead of another shortener.')
    const posts = fetchMock.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === 'POST')
    expect(posts).toHaveLength(0)
    wrapper.unmount()
  })

  it('ignores a late link load after opening another link or closing the panel', async () => {
    const pending = new Map<string, (response: Response) => void>()
    fetchMock.mockImplementation((input: RequestInfo | URL) => new Promise<Response>((resolve) => {
      const id = new URL(requestUrl(input)).pathname.split('/').pop() ?? ''
      pending.set(id, resolve)
    }))

    function detail(id: string, slug: string): Response {
      return json({
        id,
        slug,
        url: `https://example.com/${slug}`,
        clicks: 0,
        createdAt: null,
        expiresAt: null,
        disabledAt: null,
        disabledReason: null,
        protected: id === 'link-a',
        hasLogo: false,
        qrConfig: null,
      })
    }

    function destination(): string {
      const input = editorRoot().querySelector('[aria-label="Destination"]')
      if (!(input instanceof HTMLInputElement)) throw new Error('missing destination')
      return input.value
    }

    const wrapper = mount(LinkEditorPanel, {
      props: { open: true, linkId: 'link-a' },
      attachTo: document.body,
      global: { stubs: { QrDesigner: { template: '<div />' } } },
    })

    await wrapper.setProps({ linkId: 'link-b' })
    pending.get('link-b')?.(detail('link-b', 'beta'))
    await flushPromises()
    expect(destination()).toBe('https://example.com/beta')

    pending.get('link-a')?.(detail('link-a', 'alpha'))
    await flushPromises()
    expect(destination()).toBe('https://example.com/beta')
    expect(editorRoot().textContent).not.toContain('Remove password')

    await wrapper.setProps({ linkId: 'link-a' })
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true, linkId: null })
    pending.get('link-a')?.(detail('link-a', 'alpha'))
    await flushPromises()
    expect(destination()).toBe('')

    wrapper.unmount()
  })
})
