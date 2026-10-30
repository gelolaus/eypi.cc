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

  it('typing updates the answers and the preview', async () => {
    await open()
    const [name] = inputs()
    name!.value = 'Ana'
    name!.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(wrapper!.emitted('update:answers')?.[0]).toEqual([{ name: 'Ana' }])
    expect(document.body.querySelector('[data-caption-preview]')?.textContent).toBe('I am Ana of [Committee Name]')
  })

  it('the x button closes and keeps answers', async () => {
    await open({ name: 'Ana' })
    buttonNamed('Close')!.click()
    await flushPromises()
    expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])
    expect(wrapper!.emitted('update:answers')).toBeUndefined()
  })

  it('Done closes', async () => {
    await open()
    buttonNamed('Done')!.click()
    await flushPromises()
    expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])
  })

  it('Escape closes', async () => {
    await open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])
  })

  it('shows an answer containing html as text', async () => {
    await open({ name: '<b>x</b>' })
    expect(document.body.querySelector('[data-caption-preview] b')).toBeNull()
    expect(document.body.querySelector('[data-caption-preview]')?.textContent).toContain('<b>x</b>')
  })
})
