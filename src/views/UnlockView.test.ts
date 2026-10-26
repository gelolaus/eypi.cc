// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UnlockView from './UnlockView.vue'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { slug: 'promo' }, query: {} }),
}))

vi.mock('@/router', () => ({
  default: {
    push,
    currentRoute: { value: { fullPath: '/unlock/promo' } },
  },
}))

const replace = vi.fn()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  push.mockReset()
  replace.mockReset()
  localStorage.clear()
  vi.stubGlobal('location', { replace, href: 'http://localhost/unlock/promo' })
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function submitPassword(password: string) {
  const wrapper = mount(UnlockView)
  await wrapper.get('input[type="password"]').setValue(password)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  return wrapper
}

describe('UnlockView', () => {
  it('shows an inline error when the password is wrong', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(401, {
      error: { code: 'wrong_password', message: 'That password is wrong.' },
    }))

    const wrapper = await submitPassword('nope')

    expect(wrapper.get('#password-error').text()).toBe('That password is wrong.')
    expect(replace).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/api/links/promo/unlock')
    expect(JSON.parse(String(init.body))).toEqual({ password: 'nope' })
  })

  it('replaces the page with the destination after the password is accepted', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { url: 'https://example.com/dest' }))

    await submitPassword('correct-horse')

    expect(replace).toHaveBeenCalledWith('https://example.com/dest')
    expect(push).not.toHaveBeenCalled()
  })
})
