// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './index'

let wrapper: VueWrapper | undefined

const Harness = defineComponent({
  setup() {
    return () =>
      h(TooltipProvider, null, () =>
        h(Tooltip, null, () => [
          h(TooltipTrigger, null, () => 'Hover me'),
          h(TooltipContent, null, () => 'Helpful hint'),
        ]),
      )
  },
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('Tooltip', () => {
  it('shows content on focus with the inverse surface', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    expect(document.body.querySelector('[data-slot="tooltip-content"]')).toBeNull()
    const trigger = wrapper.get('[data-slot="tooltip-trigger"]')
    expect(trigger.attributes('data-slot')).toBe('tooltip-trigger')
    ;(trigger.element as HTMLElement).focus()
    await trigger.trigger('focus')
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))
    const el = document.body.querySelector<HTMLElement>('[data-slot="tooltip-content"]')!
    expect(el).not.toBeNull()
    expect(el.textContent).toContain('Helpful hint')
    expect(el.className).toEqual(expect.stringContaining('bg-foreground'))
    expect(el.className).toEqual(expect.stringContaining('rounded-md'))
    expect(el.className).toEqual(expect.stringContaining('text-xs'))
  })
})
