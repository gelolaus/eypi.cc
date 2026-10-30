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
    await open({ name: 'Ana', 'committee name': 'APC' })
    buttonNamed('Copy caption')!.click()
    await flushPromises()
    expect(wrapper!.emitted('submit')).toHaveLength(1)
    expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])
  })

  it('pressing Enter in a field submits the form', async () => {
    await open({ name: 'Ana', 'committee name': 'APC' })
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

  describe('required and optional fields', () => {
    const TEMPLATE_MIXED = 'I am {{Name}} aka {{Nickname?}}'
    async function openMixed(answers: Record<string, string> = {}, extra: Record<string, unknown> = {}) {
      wrapper = mount(CaptionFormDialog, {
        attachTo: document.body,
        props: {
          open: true,
          template: TEMPLATE_MIXED,
          answers,
          'onUpdate:answers': (next: Record<string, string>) => wrapper!.setProps({ answers: next }),
          ...extra,
        },
      })
      await flushPromises()
    }
    const submit = async () => {
      document.body.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await flushPromises()
    }

    it('marks optional fields in their label and requires the others', async () => {
      await openMixed()
      const labels = [...document.body.querySelectorAll('label')].map((l) => l.textContent?.replace(/\s+/g, ' ').trim())
      expect(labels).toEqual(['Name', 'Nickname (optional)'])
      expect(inputs().map((i) => i.getAttribute('aria-required'))).toEqual(['true', null])
    })

    it('blocks copying while a required field is empty, flags it and focuses it', async () => {
      await openMixed({ nickname: 'A' })
      await submit()
      expect(wrapper!.emitted('submit')).toBeUndefined()
      expect(wrapper!.emitted('update:open')).toBeUndefined()
      const [name, nickname] = inputs()
      expect(name!.getAttribute('aria-invalid')).toBe('true')
      expect(nickname!.getAttribute('aria-invalid')).toBeNull()
      expect(document.body.querySelector('[role=alert]')?.textContent?.trim()).toBe('Name is required.')
      expect(name!.getAttribute('aria-describedby')).toBe(document.body.querySelector('[role=alert]')!.id)
      expect(document.activeElement).toBe(name)
    })

    it('submits with an optional field left empty', async () => {
      await openMixed({ name: 'Ana' })
      await submit()
      expect(wrapper!.emitted('submit')).toHaveLength(1)
      expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])
    })

    it('clears the flag once the field is filled', async () => {
      await openMixed()
      await submit()
      const [name] = inputs()
      name!.value = 'Ana'
      name!.dispatchEvent(new Event('input', { bubbles: true }))
      await flushPromises()
      expect(document.body.querySelector('[role=alert]')).toBeNull()
      expect(name!.getAttribute('aria-invalid')).toBeNull()
    })

    it('never blocks the owner preview', async () => {
      await openMixed({}, { preview: true })
      await submit()
      expect(document.body.querySelector('[role=alert]')).toBeNull()
      expect(wrapper!.emitted('update:open')?.[0]).toEqual([false])
    })
  })

  describe('preview mode', () => {
    async function openPreview(answers: Record<string, string> = {}) {
      wrapper = mount(CaptionFormDialog, {
        attachTo: document.body,
        props: {
          open: true,
          preview: true,
          template: TEMPLATE,
          answers,
          'onUpdate:answers': (next: Record<string, string>) => wrapper!.setProps({ answers: next }),
        },
      })
      await flushPromises()
    }
    const result = () => document.body.querySelector('[data-caption-result]')

    it('shows the filled caption under the fields, with [Label] for empty ones', async () => {
      await openPreview({ name: 'Ana' })
      expect(result()?.textContent).toBe('I am Ana of [Committee Name]')
    })

    it('says nothing is copied and offers Done instead of Copy caption', async () => {
      await openPreview()
      expect(document.body.textContent).toContain('This is what visitors see. Nothing is copied or saved.')
      expect(buttonNamed('Done')).toBeTruthy()
      expect(buttonNamed('Copy caption')).toBeUndefined()
    })

    it('shows an answer containing html as text', async () => {
      await openPreview({ name: '<b>x</b>' })
      expect(document.body.querySelector('[data-caption-result] b')).toBeNull()
      expect(result()?.textContent).toContain('<b>x</b>')
    })
  })

  it('shows an answer containing html as an input value, not markup', async () => {
    await open({ name: '<b>x</b>' })
    expect(document.body.querySelector('[role="dialog"] b')).toBeNull()
    expect(inputs()[0]!.value).toBe('<b>x</b>')
  })
})
