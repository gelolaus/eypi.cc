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

describe('AccountMenu attributes', () => {
  it('does not warn about extraneous attributes with its two root nodes', async () => {
    signIn(null, null)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await router.push('/')
    await router.isReady()
    const wrapper = mount(AccountMenu, { attrs: { 'data-x': '1' }, attachTo: document.body, global: { plugins: [router] } })
    await flushPromises()
    expect(warn.mock.calls.flat().join(' ')).not.toContain('Extraneous non-props attributes')
    wrapper.unmount()
    warn.mockRestore()
  })
})

describe('AccountMenu avatar picker entry', () => {
  const item = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((el) =>
      el.textContent?.includes('Change avatar'),
    )

  it('lists Change avatar before the Appearance items', async () => {
    signIn(null, null)
    const { wrapper, menu } = await open()
    expect(item()).toBeDefined()
    expect(menu.textContent!.indexOf('Change avatar')).toBeLessThan(menu.textContent!.indexOf('Appearance'))
    wrapper.unmount()
  })

  it('opens the picker dialog, and focus returns to the menu trigger when it closes', async () => {
    signIn(null, null)
    const { wrapper } = await open()
    item()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(document.body.querySelector('[data-slot="dialog-content"]')).not.toBeNull()
    expect(document.body.textContent).toContain('Choose your avatar')

    document.body
      .querySelector('[data-slot="dialog-content"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    await new Promise((r) => setTimeout(r, 0))
    expect(document.body.querySelector('[data-slot="dialog-content"]')).toBeNull()
    expect(document.activeElement).toBe(wrapper.get('[data-account-menu="sidebar"]').element)
    wrapper.unmount()
  })
})
