// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CaptionEditor from './CaptionEditor.vue'

const editor = (modelValue: string, attrs: Record<string, unknown> = {}) =>
  mount(CaptionEditor, { props: { modelValue }, attrs })

describe('CaptionEditor', () => {
  it('wraps each valid placeholder in a mark including brackets', () => {
    const marks = editor('Hi {{Name}}').findAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]?.text()).toBe('{{Name}}')
  })

  it('does not mark invalid brackets', () => {
    expect(editor('{{}} {{open').find('mark').exists()).toBe(false)
  })

  it('emits update:modelValue when typing', async () => {
    const wrapper = editor('')
    await wrapper.get('textarea').setValue('Hello {{Name}}')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['Hello {{Name}}'])
  })

  it('forwards id, rows and maxlength to the textarea', () => {
    const textarea = editor('x', { id: 'cap', rows: '3', maxlength: '2000' }).get('textarea')
    expect(textarea.attributes()).toMatchObject({ id: 'cap', rows: '3', maxlength: '2000' })
  })

  it('shows the hint, and the limit message at 11 fields', () => {
    expect(editor('').text()).toContain('Up to 10 fields')
    const eleven = Array.from({ length: 11 }, (_, i) => `{{f${i + 1}}}`).join(' ')
    expect(editor(eleven).text()).toContain('A caption can have at most 10 fields.')
  })

  it('shows the hint as a tinted callout with the placeholder as a chip', () => {
    const hint = editor('').get('[data-caption-hint]')
    expect(hint.classes()).toContain('bg-primary/10')
    expect(hint.get('code').text()).toBe('{{Name}}')
    expect(hint.get('code').classes()).toContain('bg-primary/20')
  })

  it('turns the callout destructive when there are too many fields', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `{{f${i + 1}}}`).join(' ')
    const hint = editor(eleven).get('[data-caption-hint]')
    expect(hint.classes()).toContain('bg-destructive/10')
    expect(hint.text()).toContain('A caption can have at most 10 fields.')
  })

  it('links the hint to the textarea and announces it politely', () => {
    const wrapper = editor('')
    const hint = wrapper.get('[data-caption-hint]')
    expect(hint.attributes('id')).toBeTruthy()
    expect(wrapper.get('textarea').attributes('aria-describedby')).toBe(hint.attributes('id'))
    expect(hint.attributes('aria-live')).toBe('polite')
  })

  it('marks the textarea invalid only while there are too many fields', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `{{f${i + 1}}}`).join(' ')
    expect(editor('{{Name}}').get('textarea').attributes('aria-invalid')).toBeUndefined()
    expect(editor(eleven).get('textarea').attributes('aria-invalid')).toBe('true')
  })

  describe('Try it', () => {
    const tryIt = (wrapper: ReturnType<typeof editor>) => wrapper.findAll('button').find((b) => b.text() === 'Try it')
    const dialogInputs = () => [...document.body.querySelectorAll<HTMLInputElement>('[role="dialog"] input')]

    afterEach(() => {
      document.body.innerHTML = ''
    })

    it('is hidden when the caption has no fields and never submits a surrounding form', () => {
      expect(tryIt(editor('Hello #eypi'))).toBeUndefined()
      const button = tryIt(editor('Hi {{Name}}'))
      expect(button).toBeTruthy()
      expect(button!.attributes('type')).toBe('button')
    })

    it('opens the details dialog for the caption as typed, without saving', async () => {
      const wrapper = editor('Hi {{Name}} of {{Committee Name}}')
      await tryIt(wrapper)!.trigger('click')
      await flushPromises()
      expect(document.body.textContent).toContain('Add your details')
      expect(dialogInputs().map((i) => i.getAttribute('placeholder'))).toEqual(['Name', 'Committee Name'])
      wrapper.unmount()
    })

    it('shows the filled result as the owner types and closes with Done without copying', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
      const wrapper = editor('Hi {{Name}}')
      await tryIt(wrapper)!.trigger('click')
      await flushPromises()
      const [input] = dialogInputs()
      input!.value = 'Ana'
      input!.dispatchEvent(new Event('input', { bubbles: true }))
      await flushPromises()
      expect(document.body.querySelector('[data-caption-result]')?.textContent).toBe('Hi Ana')
      const done = [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Done')!
      done.click()
      await flushPromises()
      expect(writeText).not.toHaveBeenCalled()
      expect(document.body.textContent).not.toContain('Add your details')
      wrapper.unmount()
    })
  })

  it('escapes html in the mirror', () => {
    const wrapper = editor('<b>{{Name}}</b>')
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.text()).toContain('<b>')
  })

  it('keeps the mirror text identical to the caption so highlights line up', () => {
    const caption = 'Hi {{Name}}, I am {{Committee Name}}\n  see you'
    expect(editor(caption).get('[data-caption-mirror]').element.textContent).toBe(caption)
  })

  it('keeps the real text visible and only the highlight in the mirror, so drift stays cosmetic', () => {
    const wrapper = editor('Hi {{Name}}')
    expect(wrapper.get('textarea').classes()).not.toContain('text-transparent')
    expect(wrapper.get('[data-caption-mirror]').classes()).toContain('text-transparent')
  })

  it('hides the mirror from assistive tech', () => {
    expect(editor('x').get('[data-caption-mirror]').attributes('aria-hidden')).toBe('true')
  })
})
