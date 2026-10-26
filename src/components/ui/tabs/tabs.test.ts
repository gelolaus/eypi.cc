// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants } from './index'

let wrapper: VueWrapper | undefined
const triggers = () => wrapper!.findAll('[data-slot="tabs-trigger"]')
const model = ref('one')

const Harness = defineComponent({
  setup() {
    return () =>
      h(
        Tabs,
        { modelValue: model.value, 'onUpdate:modelValue': (v: string | number) => (model.value = String(v)) },
        {
          default: () => [
            h(TabsList, null, () => [
              h(TabsTrigger, { value: 'one' }, () => 'One'),
              h(TabsTrigger, { value: 'two' }, () => 'Two'),
            ]),
            h(TabsContent, { value: 'one' }, () => 'Panel one'),
            h(TabsContent, { value: 'two' }, () => 'Panel two'),
          ],
        },
      )
  },
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  model.value = 'one'
  document.body.innerHTML = ''
})

describe('Tabs', () => {
  it('uses wantap sizing: list is h-11 in horizontal tabs, trigger fills it', () => {
    wrapper = mount(Harness, { attachTo: document.body })
    const list = wrapper.get('[data-slot="tabs-list"]')
    expect(list.classes()).toContain('group-data-horizontal/tabs:h-11')
    expect(list.classes()).toContain('rounded-xl')
    const trigger = triggers()[0]!
    expect(trigger.attributes('data-slot')).toBe('tabs-trigger')
    expect(trigger.classes()).toContain('h-[calc(100%-1px)]')
    expect(trigger.attributes('data-state')).toBe('active')
    expect(tabsListVariants({ variant: 'line' })).toContain('bg-transparent')
  })

  it('arrow keys move the selection', async () => {
    wrapper = mount(Harness, { attachTo: document.body })
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    const t1 = triggers()[0]!
    ;(t1.element as HTMLElement).focus()
    await t1.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(model.value).toBe('two')
    expect(triggers()[1]!.attributes('data-state')).toBe('active')
    expect(wrapper.text()).toContain('Panel two')
    await triggers()[1]!.trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    await new Promise((r) => setTimeout(r, 10))
    expect(model.value).toBe('one')
  })
})
