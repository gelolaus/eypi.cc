// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import router from '@/router'
import { useSession } from '@/stores/session'
import LegalView from './LegalView.vue'

beforeEach(() => {
  useSession().reset()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    error: { code: 'unauthorized', message: 'Sign in to continue.' },
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })))
})

describe('LegalView', () => {
  it.each([
    ['/privacy', 'Privacy policy'],
    ['/terms', 'Terms of service'],
    ['/acceptable-use', 'Acceptable use'],
  ])('shows the version and the effective date on %s', async (path, title) => {
    await router.push(path)
    await router.isReady()

    const wrapper = mount(LegalView, {
      global: { plugins: [router] },
    })

    expect(router.currentRoute.value.path).toBe(path)
    expect(wrapper.text()).toContain(title)
    expect(wrapper.text()).toContain('2026-11-01')
    expect(wrapper.text()).toContain('1 November 2026')
  })
})
