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
    ['/privacy', 'Privacy policy', '2026-11-15', '15 November 2026'],
    ['/terms', 'Terms of service', '2026-11-01', '1 November 2026'],
    ['/acceptable-use', 'Acceptable use', '2026-11-01', '1 November 2026'],
  ])('shows the version and the effective date on %s', async (path, title, version, effective) => {
    await router.push(path)
    await router.isReady()

    const wrapper = mount(LegalView, {
      global: { plugins: [router] },
    })

    expect(router.currentRoute.value.path).toBe(path)
    expect(wrapper.text()).toContain(title)
    expect(wrapper.text()).toContain(version)
    expect(wrapper.text()).toContain(effective)
  })
})
