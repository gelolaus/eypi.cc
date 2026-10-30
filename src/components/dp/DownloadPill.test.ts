// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DownloadPill from './DownloadPill.vue'

const text = (count: number) => mount(DownloadPill, { props: { count } }).text().replace(/\s+/g, ' ')

describe('DownloadPill', () => {
  it('shows 1 download', () => {
    expect(text(1)).toBe('1 download')
  })

  it('shows 91 downloads', () => {
    expect(text(91)).toBe('91 downloads')
  })

  it('formats 1,234 downloads', () => {
    expect(text(1234)).toBe('1,234 downloads')
  })

  it('hides the icon from assistive tech', () => {
    const svg = mount(DownloadPill, { props: { count: 3 } }).get('svg')
    expect(svg.attributes('aria-hidden')).toBe('true')
  })

  it('exposes data-download-count', () => {
    expect(mount(DownloadPill, { props: { count: 3 } }).attributes()).toHaveProperty('data-download-count')
  })
})
