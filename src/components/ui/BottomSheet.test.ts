// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BottomSheet from './BottomSheet.vue'

function stubMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    media: '',
    addEventListener() {},
    removeEventListener() {},
  }))
}

function mountSheet(open = true, attrs: Record<string, unknown> = {}) {
  return mount(BottomSheet, {
    props: { open, title: 'Account', id: 'sheet-1', ...attrs },
    slots: { default: '<button type="button" data-inside>Inside</button>' },
    attachTo: document.body,
  })
}

const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]')

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('BottomSheet on a phone', () => {
  it('renders a modal dialog in the body with the title and the slot', async () => {
    stubMedia(true)
    const wrapper = mountSheet()
    await flushPromises()
    const sheet = dialog()!
    expect(sheet).not.toBeNull()
    expect(sheet.parentElement).toBe(document.body)
    expect(sheet.getAttribute('aria-modal')).toBe('true')
    expect(sheet.getAttribute('aria-label')).toBe('Account')
    expect(sheet.id).toBe('sheet-1')
    expect(sheet.textContent).toContain('Account')
    expect(sheet.querySelector('[data-inside]')).not.toBeNull()
    wrapper.unmount()
  })

  it('uses the shared sheet classes and a drag handle', async () => {
    stubMedia(true)
    const wrapper = mountSheet()
    await flushPromises()
    const sheet = dialog()!
    for (const cls of ['fixed', 'inset-x-0', 'bottom-0', 'rounded-t-3xl', 'max-h-[80dvh]', 'overflow-y-auto']) {
      expect(sheet.classList.contains(cls)).toBe(true)
    }
    expect(sheet.className).toContain('pb-[calc(0.5rem+env(safe-area-inset-bottom))]')
    expect(sheet.querySelector('.h-1\\.5.w-10.rounded-full')).not.toBeNull()
    expect(document.body.querySelector('[data-sheet-backdrop]')).not.toBeNull()
    wrapper.unmount()
  })

  it('renders nothing while closed', async () => {
    stubMedia(true)
    const wrapper = mountSheet(false)
    await flushPromises()
    expect(dialog()).toBeNull()
    expect(document.body.querySelector('[data-sheet-backdrop]')).toBeNull()
    wrapper.unmount()
  })

  it('moves focus inside when it opens', async () => {
    stubMedia(true)
    const wrapper = mountSheet(false)
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(dialog()!.contains(document.activeElement)).toBe(true)
    wrapper.unmount()
  })

  it('asks to close on Escape', async () => {
    stubMedia(true)
    const wrapper = mountSheet()
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('asks to close when the backdrop is clicked', async () => {
    stubMedia(true)
    const wrapper = mountSheet()
    await flushPromises()
    document.body.querySelector<HTMLButtonElement>('[data-sheet-backdrop]')!.click()
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    wrapper.unmount()
  })

  it('returns focus to whatever was focused when it opened', async () => {
    stubMedia(true)
    const opener = document.createElement('button')
    opener.textContent = 'Open'
    document.body.appendChild(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const wrapper = mountSheet(false)
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(document.activeElement).not.toBe(opener)

    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(opener)
    wrapper.unmount()
  })

  it('stops listening for Escape once closed', async () => {
    stubMedia(true)
    const wrapper = mountSheet()
    await flushPromises()
    await wrapper.setProps({ open: false })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('update:open')).toBeUndefined()
    wrapper.unmount()
  })
})

describe('BottomSheet from sm up', () => {
  it('renders the slot inline as a popover without a dialog role', async () => {
    stubMedia(false)
    const wrapper = mountSheet(true, { class: 'sm:w-72 caller-class' })
    await flushPromises()
    expect(dialog()).toBeNull()
    const panel = wrapper.get('#sheet-1')
    expect(panel.element.parentElement).not.toBe(document.body)
    expect(panel.attributes('aria-modal')).toBeUndefined()
    expect(panel.classes()).toEqual(expect.arrayContaining(['sm:w-72', 'caller-class']))
    expect(panel.find('[data-inside]').exists()).toBe(true)
    expect(panel.text()).not.toContain('Account')
    wrapper.unmount()
  })

  it('still closes on Escape and on a click outside', async () => {
    stubMedia(false)
    const wrapper = mountSheet()
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    wrapper.get('[data-sheet-backdrop]').element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wrapper.emitted('update:open')).toEqual([[false], [false]])
    wrapper.unmount()
  })
})
