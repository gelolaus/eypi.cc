// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CaptionFields from './CaptionFields.vue'

const mountFields = (template: string, answers: Record<string, string> = {}) =>
  mount(CaptionFields, { props: { template, answers } })

describe('CaptionFields', () => {
  it('renders an input per distinct field with the label as placeholder', () => {
    const inputs = mountFields('I am {{Name}} of {{Committee Name}}').findAll('input')
    expect(inputs.map((i) => i.attributes('placeholder'))).toEqual(['Name', 'Committee Name'])
    expect(inputs.map((i) => i.attributes('aria-label'))).toEqual(['Name', 'Committee Name'])
  })

  it('shows plain text around the fields', () => {
    const wrapper = mountFields('Hi, I am {{Name}}!')
    expect(wrapper.text()).toContain('Hi, I am')
    expect(wrapper.text()).toContain('!')
    expect(wrapper.text()).not.toContain('{{')
  })

  it('shares one value between occurrences of a key', () => {
    const inputs = mountFields('{{Name}} and {{ name }}', { name: 'Ana' }).findAll('input')
    expect(inputs).toHaveLength(2)
    expect(inputs.map((i) => (i.element as HTMLInputElement).value)).toEqual(['Ana', 'Ana'])
  })

  it('emits update:answers keyed by field key', async () => {
    const wrapper = mountFields('I am {{Name}}', { other: 'x' })
    await wrapper.get('input').setValue('Ana')
    expect(wrapper.emitted('update:answers')?.[0]).toEqual([{ other: 'x', name: 'Ana' }])
  })

  it('renders html in text and answers as text', () => {
    const wrapper = mountFields('<b>hi</b> {{Name}}', { name: '<i>x</i>' })
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('i').exists()).toBe(false)
    expect(wrapper.text()).toContain('<b>hi</b>')
  })

  it('leaves a field named like an object property empty', () => {
    const input = mountFields('I am {{Constructor}}').get('input').element as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('uses a 16px base size on phones so iOS does not zoom on focus', () => {
    const classes = mountFields('I am {{Name}}').get('input').classes()
    expect(classes).toContain('text-base')
    expect(classes).toContain('md:text-sm')
  })

  it('renders a caption without fields as plain text with no inputs', () => {
    const wrapper = mountFields('Hello #eypi')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.text()).toBe('Hello #eypi')
  })
})
