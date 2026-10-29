// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import AccountMenu from './AccountMenu.vue'
import { useSession } from '@/stores/session'

const stub = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: stub }, { path: '/account', component: stub }],
})

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  const session = useSession()
  session.user.value = { id: 'user-1', email: 'ada@apc.edu.ph', name: 'Ada', role: 'user', avatarIcon: null, avatarColor: null }
  session.status.value = 'ready'
})

afterEach(() => {
  document.body.innerHTML = ''
  useSession().reset()
  vi.unstubAllGlobals()
})

describe('AccountMenu theme entry', () => {
  it('contains an Appearance entry', async () => {
    await router.push('/')
    await router.isReady()
    const wrapper = mount(AccountMenu, { attachTo: document.body, global: { plugins: [router] } })
    await wrapper.get('[data-account-menu="sidebar"]').trigger('click')
    await flushPromises()
    const menu = document.body.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]')!
    expect(menu.textContent).toContain('Appearance')
    wrapper.unmount()
  })
})
