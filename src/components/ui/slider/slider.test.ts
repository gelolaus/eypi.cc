// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { Slider } from './index'

describe('Slider', () => {
  it('renders track, range and one thumb per value', () => {
    const w = mount(Slider, { props: { modelValue: [30] }, attachTo: document.body })
    expect(w.attributes('data-slot')).toBe('slider')
    expect(w.find('[data-slot="slider-track"]').exists()).toBe(true)
    expect(w.find('[data-slot="slider-range"]').exists()).toBe(true)
    expect(w.findAll('[data-slot="slider-thumb"]').length).toBe(1)
    expect(w.get('[data-slot="slider-thumb"]').attributes('role')).toBe('slider')
    expect(w.get('[data-slot="slider-thumb"]').classes()).toContain('rounded-full')
    w.unmount()
  })

  it('renders two thumbs for a range model', () => {
    const w = mount(Slider, { props: { modelValue: [10, 90] }, attachTo: document.body })
    expect(w.findAll('[data-slot="slider-thumb"]').length).toBe(2)
    w.unmount()
  })

  it('emits on arrow keys', async () => {
    const w = mount(Slider, { props: { modelValue: [50], min: 0, max: 100, step: 1 }, attachTo: document.body })
    const thumb = w.get('[data-slot="slider-thumb"]')
    await thumb.trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')?.[0]).toEqual([[51]])
    w.unmount()
  })

  it('emits the previous step on ArrowLeft', async () => {
    const w = mount(Slider, { props: { modelValue: [50] }, attachTo: document.body })
    await w.get('[data-slot="slider-thumb"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('update:modelValue')?.[0]).toEqual([[49]])
    w.unmount()
  })
})
