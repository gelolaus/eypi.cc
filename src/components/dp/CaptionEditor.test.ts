// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
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

  it('escapes html in the mirror', () => {
    const wrapper = editor('<b>{{Name}}</b>')
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.text()).toContain('<b>')
  })

  it('keeps the mirror text identical to the caption so highlights line up', () => {
    const caption = 'Hi {{Name}}, I am {{Committee Name}}\n  see you'
    expect(editor(caption).get('[data-caption-mirror]').element.textContent).toBe(caption)
  })

  it('hides the mirror from assistive tech', () => {
    expect(editor('x').get('[data-caption-mirror]').attributes('aria-hidden')).toBe('true')
  })
})
