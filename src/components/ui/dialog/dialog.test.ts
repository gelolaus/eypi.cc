// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './index'

let wrapper: VueWrapper | undefined
const open = ref(false)

const Harness = defineComponent({
  setup() {
    return () =>
      h(
        Dialog,
        { open: open.value, 'onUpdate:open': (v: boolean) => (open.value = v) },
        {
          default: () => [
            h(DialogTrigger, null, () => 'Open'),
            h(DialogContent, null, () => [
              h(DialogHeader, null, () => [
                h(DialogTitle, null, () => 'Title'),
                h(DialogDescription, null, () => 'Description'),
              ]),
              h('input', { id: 'field' }),
              h(DialogFooter, null, () => 'Footer'),
            ]),
          ],
        },
      )
  },
})

const content = () => document.body.querySelector<HTMLElement>('[data-slot="dialog-content"]')

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  open.value = false
  document.body.innerHTML = ''
})

describe('Dialog', () => {
  it('is closed until the trigger is clicked, then opens with the popover surface', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    expect(content()).toBeNull()
    await wrapper.get('[data-slot="dialog-trigger"]').trigger('click')
    await nextTick()
    const el = content()!
    expect(el).not.toBeNull()
    expect(el.className).toEqual(expect.stringContaining('bg-popover'))
    expect(el.className).toEqual(expect.stringContaining('ring-1'))
    expect(el.className).toEqual(expect.stringContaining('rounded-xl'))
    expect(document.body.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull()
    expect(document.body.querySelector('[data-slot="dialog-title"]')!.textContent).toBe('Title')
    expect(document.body.querySelector('[data-slot="dialog-header"]')).not.toBeNull()
    expect(document.body.querySelector('[data-slot="dialog-footer"]')).not.toBeNull()
  })

  it('moves focus into the content when it opens (focus trap entry)', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    await wrapper.get('[data-slot="dialog-trigger"]').trigger('click')
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(content()!.contains(document.activeElement)).toBe(true)
  })

  it('renders a labelled close button that closes it', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    await wrapper.get('[data-slot="dialog-trigger"]').trigger('click')
    await nextTick()
    const close = document.body.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!
    expect(close.textContent).toContain('Close')
    close.click()
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))
    expect(open.value).toBe(false)
    expect(content()).toBeNull()
  })

  it('closes on Escape', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    await wrapper.get('[data-slot="dialog-trigger"]').trigger('click')
    await nextTick()
    content()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(open.value).toBe(false)
  })

  it('closes on overlay click', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    await wrapper.get('[data-slot="dialog-trigger"]').trigger('click')
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    const overlay = document.body.querySelector<HTMLElement>('[data-slot="dialog-overlay"]')!
    overlay.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    expect(open.value).toBe(false)
  })

  it('returns focus to the trigger after closing', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    const trigger = wrapper.get('[data-slot="dialog-trigger"]').element as HTMLElement
    trigger.focus()
    await wrapper.get('[data-slot="dialog-trigger"]').trigger('click')
    await nextTick()
    open.value = false
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))
    expect(document.activeElement).toBe(trigger)
  })
})
