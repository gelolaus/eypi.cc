// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Separator } from './index'

describe('Separator', () => {
  it('is horizontal and decorative by default', () => {
    const w = mount(Separator)
    expect(w.attributes('data-slot')).toBe('separator')
    expect(w.attributes('data-orientation')).toBe('horizontal')
    expect(w.attributes('role')).toBe('none')
    expect(w.classes()).toContain('bg-border')
  })
  it('supports vertical', () => {
    expect(mount(Separator, { props: { orientation: 'vertical' } }).attributes('data-orientation')).toBe('vertical')
  })
})
