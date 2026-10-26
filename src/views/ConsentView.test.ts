// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import router from '@/router'
import { useSession } from '@/stores/session'
import ConsentView from './ConsentView.vue'

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

let consentStatus = 204
let consentMessage = 'Accept the current privacy policy and terms.'
let meNeeds: { document: string; version: string }[] = []

function installFetch() {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    if (url.includes('/api/legal/consent') && method === 'POST') {
      if (consentStatus === 204) return new Response(null, { status: 204 })
      return jsonResponse(consentStatus, {
        error: { code: 'consent_required', message: consentMessage },
      })
    }
    if (url.includes('/api/me')) {
      return jsonResponse(200, {
        user: {
          id: 'user-1',
          email: 'ada@apc.edu.ph',
          name: 'Ada',
          role: 'user',
        },
        pendingInviteCount: 0,
        needsConsent: meNeeds,
        orgs: [],
      })
    }
    return jsonResponse(401, {
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    })
  })
}

async function visit(path: string) {
  if (router.currentRoute.value.fullPath === path) return
  await router.push(path)
  await router.isReady()
}

async function mountConsent(path: string) {
  await visit(path)
  return mount(ConsentView, {
    global: { plugins: [router] },
  })
}

beforeEach(() => {
  consentStatus = 204
  consentMessage = 'Accept the current privacy policy and terms.'
  meNeeds = []
  fetchMock.mockReset()
  installFetch()
  vi.stubGlobal('fetch', fetchMock)
  useSession().reset()
})

describe('ConsentView', () => {
  it('disables Continue until both boxes are checked', async () => {
    const wrapper = await mountConsent('/consent?returnTo=/links')
    const button = wrapper.get('button')
    const boxes = wrapper.findAll('input[type="checkbox"]')

    expect(button.text()).toBe('Continue')
    expect(boxes).toHaveLength(2)
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.find('a[href="/privacy"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/terms"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/acceptable-use"]').exists()).toBe(false)

    await boxes[0].setValue(true)
    expect((button.element as HTMLButtonElement).disabled).toBe(true)

    await boxes[1].setValue(true)
    expect((button.element as HTMLButtonElement).disabled).toBe(false)

    await boxes[0].setValue(false)
    expect((button.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('posts both documents, reloads the session, and opens a same-origin returnTo', async () => {
    const wrapper = await mountConsent('/consent?returnTo=/links')
    const boxes = wrapper.findAll('input[type="checkbox"]')
    await boxes[0].setValue(true)
    await boxes[1].setValue(true)
    await import('@/views/links/LinksView.vue')

    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => {
      expect(router.currentRoute.value.fullPath).toBe('/links')
    }, { timeout: 5000 })

    const post = fetchMock.mock.calls.find((call) => {
      const init = call[1] as RequestInit | undefined
      return String(call[0]).includes('/api/legal/consent') && init?.method === 'POST'
    })
    expect(post).toBeTruthy()
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).toEqual({
      documents: ['privacy', 'terms'],
    })
  })

  it('opens / when returnTo is not a same-origin path', async () => {
    const wrapper = await mountConsent('/consent?returnTo=https://evil.example/phish')
    const boxes = wrapper.findAll('input[type="checkbox"]')
    await boxes[0].setValue(true)
    await boxes[1].setValue(true)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/')
  })

  it('opens / when returnTo is protocol-relative', async () => {
    const wrapper = await mountConsent('/consent?returnTo=//evil.example')
    const boxes = wrapper.findAll('input[type="checkbox"]')
    await boxes[0].setValue(true)
    await boxes[1].setValue(true)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/')
  })

  it('shows the API message and does not navigate when the post fails', async () => {
    consentStatus = 422
    const wrapper = await mountConsent('/consent?returnTo=/links')
    const stayed = router.currentRoute.value.fullPath
    const callsBefore = fetchMock.mock.calls.length
    const boxes = wrapper.findAll('input[type="checkbox"]')
    await boxes[0].setValue(true)
    await boxes[1].setValue(true)

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toBe(consentMessage)
    expect(router.currentRoute.value.fullPath).toBe(stayed)
    const callsAfter = fetchMock.mock.calls.slice(callsBefore)
    expect(callsAfter).toHaveLength(1)
    expect(String(callsAfter[0]?.[0])).toContain('/api/legal/consent')
    expect((callsAfter[0]?.[1] as RequestInit).method).toBe('POST')
  })
})
