// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import CaptionFormDialog from './CaptionFormDialog.vue'

const TEMPLATE = 'I am {{Name}} of {{Committee Name}}'
let wrapper: VueWrapper | undefined

async function open(answers: Record<string, string> = {}) {
  wrapper = mount(CaptionFormDialog, {
    attachTo: document.body,
    props: {
      open: true,
      template: TEMPLATE,
      answers,
      'onUpdate:answers': (next: Record<string, string>) => wrapper!.setProps({ answers: next }),
    },
  })
  await flushPromises()
  return wrapper
}

const inputs = () => [...document.body.querySelectorAll<HTMLInputElement>('input')]
const buttonNamed = (name: string) => [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('CaptionFormDialog', () => {
  it('lists one input per distinct field, labelled', async () => {
    await open()
    expect(inputs().map((i) => i.getAttribute('placeholder'))).toEqual(['Name', 'Committee Name'])
    expect(document.body.textContent).toContain('Add your details')
  })

  it('typing updates the answers', async () => {
    await open()
    const [name] = inputs()
    name!.value = 'Ana'
    name!.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(wrapper!.emitted('update:answers')?.[0]).toEqual([{ name: 'Ana' }])
  })

  it('shows no caption preview under the form', async () => {
    await open({ name: 'Ana' })
    expect(document.body.querySelector('[data-caption-preview]')).toBeNull()
    expect(document.body.textContent).not.toContain('I am Ana')
  })

  it('the x button closes and keeps answers', async () => {
    await open({ name: 'Ana' })
    buttonNamed('Close')!.click()
    await flushPromises()
    expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])
    expect(wrapper!.emitted('update:answers')).toBeUndefined()
  })

  it('Copy caption submits and closes', async () => {
    await open({ name: 'Ana' })
    buttonNamed('Copy caption')!.click()
    await flushPromises()
    expect(wrapper!.emitted('submit')).toHaveLength(1)
    expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])
  })

  it('pressing Enter in a field submits the form', async () => {
    await open({ name: 'Ana' })
    document.body.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await flushPromises()
    expect(wrapper!.emitted('submit')).toHaveLength(1)
  })

  it('the x button and Escape close without submitting', async () => {
    await open({ name: 'Ana' })
    buttonNamed('Close')!.click()
    await flushPromises()
    expect(wrapper!.emitted('submit')).toBeUndefined()
  })

  it('Escape closes', async () => {
    await open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])
  })

  it('shows an answer containing html as an input value, not markup', async () => {
    await open({ name: '<b>x</b>' })
    expect(document.body.querySelector('[role="dialog"] b')).toBeNull()
    expect(inputs()[0]!.value).toBe('<b>x</b>')
  })
})
