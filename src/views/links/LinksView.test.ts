// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LinksView from './LinksView.vue'

const { push, route } = vi.hoisted(() => {
  const push = vi.fn()
  const route = {
    fullPath: '/links',
    name: 'links',
    query: {} as Record<string, unknown>,
    params: {},
  }
  return { push, route }
})

vi.mock('@/router', () => ({
  default: {
    push,
    replace: vi.fn(),
    currentRoute: { value: route },
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
  }),
  useRoute: () => route,
}))

beforeEach(() => {
  localStorage.clear()
  push.mockReset()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ links: [] }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LinksView session expiry', () => {
  it('does not replace the login route that already carries returnTo', async () => {
    mount(LinksView)
    await flushPromises()

    expect(push).toHaveBeenCalledWith({
      name: 'login',
      query: { returnTo: '/links' },
    })
    expect(push.mock.calls.some((call) => call[0] === '/login')).toBe(false)
  })
})
