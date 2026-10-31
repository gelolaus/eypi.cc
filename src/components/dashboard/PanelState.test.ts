// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PanelState from './PanelState.vue'

const RouterLink = {
  props: ['to'],
  template: '<a :href="String(to)"><slot /></a>',
}

describe('PanelState', () => {
  it('shows a role=status skeleton when loading', () => {
    const wrapper = mount(PanelState, {
      props: { status: 'loading', title: 'Clicks' },
      slots: { default: '<p data-ready>ready</p>' },
    })
    const status = wrapper.get('[role="status"]')
    expect(status.attributes('aria-busy')).toBe('true')
    expect(status.text()).toMatch(/Loading/i)
    expect(wrapper.find('[data-ready]').exists()).toBe(false)
  })

  it('shows an error message with a Retry button that emits retry', async () => {
    const wrapper = mount(PanelState, {
      props: { status: 'error', title: 'Clicks' },
    })
    expect(wrapper.text()).toMatch(/couldn.t load|Couldn.t load|unavailable|try again/i)
    const retry = wrapper.get('button')
    expect(retry.text()).toBe('Retry')
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('shows the empty body and action link when empty', () => {
    const wrapper = mount(PanelState, {
      props: {
        status: 'empty',
        title: 'Top links',
        emptyBody: 'No links yet',
        action: { label: 'Create a link', to: '/links' },
      },
      global: { stubs: { RouterLink } },
    })
    expect(wrapper.text()).toContain('No links yet')
    const link = wrapper.get('a')
    expect(link.text()).toBe('Create a link')
    expect(link.attributes('href')).toBe('/links')
  })

  it('renders the slot when ready', () => {
    const wrapper = mount(PanelState, {
      props: { status: 'ready', title: 'Clicks' },
      slots: { default: '<p data-ready>chart</p>' },
    })
    expect(wrapper.get('[data-ready]').text()).toBe('chart')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    expect(wrapper.find('button').exists()).toBe(false)
  })
})