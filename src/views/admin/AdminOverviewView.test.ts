// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AdminOverviewView from './AdminOverviewView.vue'

afterEach(() => vi.unstubAllGlobals())

describe('AdminOverviewView', () => {
  it('shows the platform totals under an accessible heading', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      users: 1200, orgs: 30, members: 900, links: 5000, clicks: 80000,
      events: 40, tickets: 700, checkIns: 600, frames: 12, frameDownloads: 300,
    }), { headers: { 'Content-Type': 'application/json' } })))
    const wrapper = mount(AdminOverviewView)
    await flushPromises()
    expect(wrapper.get('h2').text()).toBe('Platform totals')
    expect(wrapper.text()).toContain('80,000')
  })
})
