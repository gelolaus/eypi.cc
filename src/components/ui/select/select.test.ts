// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './index'

let wrapper: VueWrapper | undefined
const model = ref<string | undefined>(undefined)

const Harness = defineComponent({
  setup() {
    return () =>
      h(
        Select,
        { modelValue: model.value, 'onUpdate:modelValue': (v: unknown) => (model.value = v as string) },
        {
          default: () => [
            h(SelectTrigger, null, () => h(SelectValue, { placeholder: 'Pick one' })),
            h(SelectContent, { position: 'popper' }, () => [
              h(SelectItem, { value: 'a' }, () => 'Alpha'),
              h(SelectItem, { value: 'b' }, () => 'Beta'),
            ]),
          ],
        },
      )
  },
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  model.value = undefined
  document.body.innerHTML = ''
})

describe('Select', () => {
  it('trigger is h-11 by default', () => {
    wrapper = mount(Harness, { attachTo: document.body })
    const trigger = wrapper.get('[data-slot="select-trigger"]')
    expect(trigger.attributes('data-slot')).toBe('select-trigger')
    expect(trigger.attributes('data-size')).toBe('default')
    expect(trigger.classes()).toContain('data-[size=default]:h-11')
    expect(trigger.classes()).toContain('rounded-xl')
  })

  it('selecting an item updates the model', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    const trigger = wrapper.get('[data-slot="select-trigger"]')
    await trigger.trigger('pointerdown', { button: 0, ctrlKey: false, pointerType: 'mouse' })
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))
    const items = document.body.querySelectorAll<HTMLElement>('[data-slot="select-item"]')
    expect(items.length).toBe(2)
    const beta = items[1]!
    beta.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }))
    beta.click()
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))
    expect(model.value).toBe('b')
  })
})
