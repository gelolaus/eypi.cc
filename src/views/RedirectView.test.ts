// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RedirectView from './RedirectView.vue'

const replace = vi.fn()
const locationReplace = vi.fn()

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { slug: 'promo' }, query: {} }),
  useRouter: () => ({ replace }),
}))

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  replace.mockReset()
  locationReplace.mockReset()
  localStorage.clear()
  Object.defineProperty(document, 'referrer', {
    configurable: true,
    get: () => 'https://referrer.example/from',
  })
  vi.stubGlobal('location', { replace: locationReplace, href: 'http://localhost/promo' })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function mountRedirect() {
  const wrapper = mount(RedirectView)
  await flushPromises()
  return wrapper
}

function requestedUrl(): string {
  const call = vi.mocked(fetch).mock.calls[0]
  return String(call?.[0] ?? '')
}

describe('RedirectView', () => {
  it('resolves through the API with the referrer query', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { url: 'https://example.com/dest' }))

    await mountRedirect()

    const url = requestedUrl()
    expect(url).toContain('/api/links/resolve/promo?r=')
    expect(url).toContain(encodeURIComponent('https://referrer.example/from'))
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit | undefined
    const headers = new Headers(init?.headers)
    expect(headers.get('X-Client-Referrer')).toBeNull()
    expect(locationReplace).toHaveBeenCalledWith('https://example.com/dest')
    expect(replace).not.toHaveBeenCalled()
  })

  it('sends an expired link to /expired', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(410, {
      error: { code: 'link_expired', message: 'This link has expired.' },
    }))

    await mountRedirect()

    expect(replace).toHaveBeenCalledWith('/expired')
    expect(locationReplace).not.toHaveBeenCalled()
  })

  it('sends a protected link to /unlock/:slug', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { protected: true }))

    await mountRedirect()

    expect(replace).toHaveBeenCalledWith('/unlock/promo')
    expect(locationReplace).not.toHaveBeenCalled()
  })
})
