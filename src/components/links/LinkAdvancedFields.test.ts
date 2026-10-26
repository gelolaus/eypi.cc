// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LinkAdvancedFields from './LinkAdvancedFields.vue'

describe('LinkAdvancedFields UTM builder', () => {
  it('appends utm tags and replaces a utm_source that is already present', async () => {
    const wrapper = mount(LinkAdvancedFields, {
      props: {
        url: 'https://example.com/path?utm_source=old&ref=1',
        expiresAt: '',
        password: '',
      },
    })

    await wrapper.get('#utm-source').setValue('newsletter')
    await wrapper.get('#utm-medium').setValue('email')
    await wrapper.get('#utm-campaign').setValue('spring')
    await wrapper.get('#utm-term').setValue('apc')
    await wrapper.get('#utm-content').setValue('banner')

    const updates = wrapper.emitted('update:url')
    expect(updates?.length).toBeGreaterThan(0)
    const next = String(updates![updates!.length - 1]![0])
    const params = new URL(next).searchParams

    expect(params.getAll('utm_source')).toEqual(['newsletter'])
    expect(params.get('utm_medium')).toBe('email')
    expect(params.get('utm_campaign')).toBe('spring')
    expect(params.get('utm_term')).toBe('apc')
    expect(params.get('utm_content')).toBe('banner')
    expect(params.get('ref')).toBe('1')
  })

  it('keeps an existing utm_medium and ref when the user sets utm_source', async () => {
    const wrapper = mount(LinkAdvancedFields, {
      props: {
        url: 'https://example.com/path?utm_medium=email&ref=1',
        expiresAt: '',
        password: '',
      },
    })

    expect((wrapper.get('#utm-medium').element as HTMLInputElement).value).toBe('email')

    await wrapper.get('#utm-source').setValue('newsletter')

    const updates = wrapper.emitted('update:url')
    expect(updates?.length).toBeGreaterThan(0)
    const next = String(updates![updates!.length - 1]![0])
    const params = new URL(next).searchParams

    expect(params.getAll('utm_source')).toEqual(['newsletter'])
    expect(params.get('utm_medium')).toBe('email')
    expect(params.get('ref')).toBe('1')
  })
})
