// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

let wrapper: VueWrapper | undefined
const menuOpen = ref(true)

async function setup() {
  vi.resetModules()
  localStorage.clear()
  menuOpen.value = true
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  const { useTheme, initTheme } = await import('@/composables/useTheme')
  const { default: ThemeMenuItems } = await import('./ThemeMenuItems.vue')
  const { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } = await import('@/components/ui/dropdown-menu')
  initTheme()
  const Harness = defineComponent({
    setup: () => () =>
      h(DropdownMenu, { open: menuOpen.value, 'onUpdate:open': (v: boolean) => (menuOpen.value = v) }, () => [
        h(DropdownMenuTrigger, null, () => 'Menu'),
        h(DropdownMenuContent, null, () => h(ThemeMenuItems)),
      ]),
  })
  wrapper = mount(Harness, { attachTo: document.body })
  await flushPromises()
  return useTheme()
}

const trigger = () => document.body.querySelector<HTMLElement>('[data-slot="dropdown-menu-sub-trigger"]')!
const radios = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))

async function openSub() {
  trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
  await flushPromises()
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  document.documentElement.className = ''
  vi.unstubAllGlobals()
})

describe('ThemeMenuItems', () => {
  it('shows an Appearance submenu trigger', async () => {
    await setup()
    expect(trigger().textContent).toContain('Appearance')
    expect(trigger().className).toContain('min-h-11')
  })

  it('lists System, Light and Dark with the current mode checked', async () => {
    await setup()
    await openSub()
    expect(radios().map((r) => r.textContent?.trim())).toEqual(['System', 'Light', 'Dark'])
    expect(radios().filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.textContent?.trim())).toEqual(['System'])
    for (const r of radios()) expect(r.className).toContain('min-h-11')
  })

  it('choosing Dark updates the preference and keeps the menu open', async () => {
    const theme = await setup()
    await openSub()
    radios()[2].click()
    await flushPromises()
    expect(theme.preference.value.mode).toBe('dark')
    expect(radios()[2].getAttribute('aria-checked')).toBe('true')
    expect(menuOpen.value).toBe(true)
    expect(document.body.querySelector('[data-slot="dropdown-menu-content"]')).not.toBeNull()
    expect(radios()).toHaveLength(3)
  })

  it('offers True black only in a dark theme', async () => {
    const theme = await setup()
    await openSub()
    const black = () => Array.from(document.body.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]'))
    expect(black()).toHaveLength(0)
    radios()[2].click()
    await flushPromises()
    expect(black().map((el) => el.textContent?.trim())).toEqual(['True black'])
    black()[0].click()
    await flushPromises()
    expect(theme.preference.value.black).toBe(true)
    expect(black()[0].getAttribute('aria-checked')).toBe('true')
    expect(menuOpen.value).toBe(true)
    expect(radios()).toHaveLength(3)
  })
})
