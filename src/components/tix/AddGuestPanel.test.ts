// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import AddGuestPanel from './AddGuestPanel.vue'

const props = { open: true, slug: 'ev', hasCsvRows: false, columnMapping: {}, clusters: [] }

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AddGuestPanel', () => {
  it('renders an accessible dialog teleported to body above the app chrome', async () => {
    const wrapper = mount(AddGuestPanel, { props, attachTo: document.body })
    await nextTick()
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog).toBeTruthy()
    expect(wrapper.element.contains(dialog)).toBe(false)
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    const labelId = dialog.getAttribute('aria-labelledby')!
    expect(document.getElementById(labelId)?.textContent).toContain('Add guest')
    expect((dialog.parentElement as HTMLElement).style.zIndex).toBe('99990')
    wrapper.unmount()
  })

  it('moves focus into the dialog and closes on Escape', async () => {
    const wrapper = mount(AddGuestPanel, { props, attachTo: document.body })
    await nextTick()
    await nextTick()
    const dialog = document.body.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.contains(document.activeElement)).toBe(true)
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })
})
