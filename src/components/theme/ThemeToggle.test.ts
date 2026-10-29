// @vitest-environment happy-dom
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

let wrapper: VueWrapper | undefined

async function setup() {
  vi.resetModules()
  localStorage.clear()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  const { useTheme, initTheme } = await import('@/composables/useTheme')
  const { default: ThemeToggle } = await import('./ThemeToggle.vue')
  initTheme()
  wrapper = mount(ThemeToggle, { attachTo: document.body })
  return useTheme()
}

const radios = () => wrapper!.findAll('[role="radio"]')
const checked = () => radios().find((r) => r.attributes('aria-checked') === 'true')?.text()

beforeEach(() => {
  document.documentElement.className = ''
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('ThemeToggle', () => {
  it('renders a named radiogroup with System checked by default', async () => {
    await setup()
    const group = wrapper!.get('[role="radiogroup"]')
    expect(group.attributes('aria-label')).toBe('Theme')
    expect(radios().map((r) => r.text())).toEqual(['System', 'Light', 'Dark'])
    expect(checked()).toBe('System')
  })

  it('choosing Dark updates the preference and checks Dark', async () => {
    const theme = await setup()
    await radios()[2].trigger('click')
    expect(theme.preference.value.mode).toBe('dark')
    expect(checked()).toBe('Dark')
  })

  it('shows the True black switch only in a dark theme and wires it to setBlack', async () => {
    const theme = await setup()
    await radios()[1].trigger('click')
    expect(wrapper!.find('[role="switch"]').exists()).toBe(false)
    await radios()[2].trigger('click')
    const sw = wrapper!.get('[role="switch"]')
    expect(wrapper!.text()).toContain('True black')
    await sw.trigger('click')
    expect(theme.preference.value.black).toBe(true)
  })

  it.each(['altKey', 'ctrlKey', 'metaKey'])('leaves arrow keys with %s to the browser', async (modifier) => {
    const theme = await setup()
    const before = theme.preference.value.mode
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', [modifier]: true, cancelable: true, bubbles: true })
    radios()[0].element.dispatchEvent(event)
    await nextTick()
    expect(event.defaultPrevented).toBe(false)
    expect(theme.preference.value.mode).toBe(before)
  })

  it('moves selection and focus with the arrow keys and uses a roving tabindex', async () => {
    const theme = await setup()
    expect(radios().map((r) => r.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
    await radios()[0].trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(theme.preference.value.mode).toBe('light')
    expect(document.activeElement).toBe(radios()[1].element)
    await radios()[1].trigger('keydown', { key: 'ArrowDown' })
    expect(theme.preference.value.mode).toBe('dark')
    await radios()[2].trigger('keydown', { key: 'ArrowRight' })
    expect(theme.preference.value.mode).toBe('system')
    await radios()[0].trigger('keydown', { key: 'ArrowLeft' })
    expect(theme.preference.value.mode).toBe('dark')
    await radios()[2].trigger('keydown', { key: 'ArrowUp' })
    expect(theme.preference.value.mode).toBe('light')
    expect(radios().map((r) => r.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
  })

  it('gives every control a 44px target and a focus ring', async () => {
    await setup()
    for (const r of radios()) {
      expect(r.classes()).toContain('min-h-11')
      expect(r.classes().join(' ')).toContain('focus-visible:ring-[3px]')
    }
    await radios()[2].trigger('click')
    expect(wrapper!.get('label').classes()).toContain('min-h-11')
  })
})
