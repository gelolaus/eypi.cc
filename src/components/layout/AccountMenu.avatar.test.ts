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

function signIn(avatarIcon: 'cat' | null, avatarColor: 'blue' | null) {
  const session = useSession()
  session.user.value = { id: 'user-1', email: 'ada@apc.edu.ph', name: 'Ada Lovelace', role: 'user', avatarIcon, avatarColor }
  session.status.value = 'ready'
}

function chosenIcons(root: Element): number {
  return Array.from(root.querySelectorAll('svg')).filter((svg) => svg.classList.contains('size-[55%]')).length
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
})

afterEach(() => {
  document.body.innerHTML = ''
  useSession().reset()
  vi.unstubAllGlobals()
})

async function open() {
  await router.push('/')
  await router.isReady()
  const wrapper = mount(AccountMenu, { attachTo: document.body, global: { plugins: [router] } })
  await wrapper.get('[data-account-menu="sidebar"]').trigger('click')
  await flushPromises()
  const menu = document.body.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]')!
  return { wrapper, menu }
}

describe('AccountMenu avatar', () => {
  it('shows the chosen icon in the trigger and the menu header', async () => {
    signIn('cat', 'blue')
    const { wrapper, menu } = await open()
    const trigger = wrapper.get('[data-account-menu="sidebar"]').element
    expect(chosenIcons(trigger)).toBe(1)
    expect(chosenIcons(menu)).toBe(1)
    wrapper.unmount()
  })

  it('falls back to initials when no avatar is set', async () => {
    signIn(null, null)
    const { wrapper, menu } = await open()
    const trigger = wrapper.get('[data-account-menu="sidebar"]').element
    expect(chosenIcons(trigger)).toBe(0)
    expect(chosenIcons(menu)).toBe(0)
    expect(trigger.textContent).toContain('AD')
    expect(menu.textContent).toContain('AD')
    wrapper.unmount()
  })
})
