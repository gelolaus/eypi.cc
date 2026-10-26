// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './index'

let wrapper: VueWrapper | undefined
const open = ref(false)
let selected = 0

const Harness = defineComponent({
  setup() {
    return () =>
      h(
        DropdownMenu,
        { open: open.value, 'onUpdate:open': (v: boolean) => (open.value = v) },
        {
          default: () => [
            h(DropdownMenuTrigger, null, () => 'Menu'),
            h(DropdownMenuContent, null, () => [
              h(DropdownMenuLabel, null, () => 'Account'),
              h(DropdownMenuSeparator),
              h(DropdownMenuItem, { onSelect: () => selected++ }, () => [
                'Profile',
                h(DropdownMenuShortcut, null, () => 'P'),
              ]),
              h(DropdownMenuItem, { variant: 'destructive' }, () => 'Delete'),
            ]),
          ],
        },
      )
  },
})

const content = () => document.body.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]')

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  open.value = false
  selected = 0
  document.body.innerHTML = ''
})

describe('DropdownMenu', () => {
  it('opens on click of the trigger and shows the popover surface', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    expect(content()).toBeNull()
    const t = wrapper.get('[data-slot="dropdown-menu-trigger"]')
    await t.trigger('click')
    await nextTick()
    const el = content()!
    expect(el).not.toBeNull()
    expect(el.className).toEqual(expect.stringContaining('bg-popover'))
    expect(el.className).toEqual(expect.stringContaining('ring-1'))
    expect(el.className).toEqual(expect.stringContaining('rounded-lg'))
    expect(document.body.querySelectorAll('[data-slot="dropdown-menu-item"]').length).toBe(2)
    expect(
      document.body.querySelector('[data-slot="dropdown-menu-item"][data-variant="destructive"]'),
    ).not.toBeNull()
    expect(document.body.querySelector('[data-slot="dropdown-menu-separator"]')).not.toBeNull()
    expect(document.body.querySelector('[data-slot="dropdown-menu-shortcut"]')).not.toBeNull()
  })

  it('closes on Escape', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    await wrapper.get('[data-slot="dropdown-menu-trigger"]').trigger('click')
    await nextTick()
    expect(open.value).toBe(true)
    content()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(open.value).toBe(false)
  })

  it('selecting an item emits select and closes the menu', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    await wrapper.get('[data-slot="dropdown-menu-trigger"]').trigger('click')
    await nextTick()
    document.body.querySelector<HTMLElement>('[data-slot="dropdown-menu-item"]')!.click()
    await nextTick()
    expect(selected).toBe(1)
    expect(open.value).toBe(false)
  })
})
