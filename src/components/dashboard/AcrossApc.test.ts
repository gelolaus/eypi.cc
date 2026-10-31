// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AcrossApc from './AcrossApc.vue'
import type { PlatformStats } from '@/lib/queries'

const stats: PlatformStats = {
  users: 1200,
  orgs: 40,
  members: 800,
  links: 5000,
  clicks: 90000,
  events: 70,
  tickets: 2000,
  checkIns: 1500,
  frames: 100,
  frameDownloads: 300,
}

describe('AcrossApc', () => {
  it('renders the muted platform strip', () => {
    const wrapper = mount(AcrossApc, { props: { stats, status: 'ready' } })
    const dl = wrapper.get('dl')
    expect(dl.classes().join(' ')).toMatch(/muted|text-muted/)
    expect(wrapper.text()).toContain('Students')
    expect(wrapper.text()).toContain('1,200')
    expect(wrapper.text()).toContain('Orgs')
    expect(wrapper.text()).toContain('Links')
    expect(wrapper.text()).toContain('Clicks')
    expect(wrapper.text()).toContain('Events')
  })

  it('hides silently on error with no retry', () => {
    const wrapper = mount(AcrossApc, { props: { stats: null, status: 'error' } })
    expect(wrapper.find('dl').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.text()).toBe('')
  })
})