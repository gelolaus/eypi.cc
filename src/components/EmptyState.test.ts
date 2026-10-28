// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import EmptyState from './EmptyState.vue'

const RouterLink = {
  props: ['to'],
  template: '<a :href="String(to)"><slot /></a>',
}

const global = { stubs: { RouterLink } }

describe('EmptyState', () => {
  it('renders a title, one body line, and one internal action link', () => {
    const wrapper = mount(EmptyState, {
      props: {
        title: 'No links yet',
        body: 'Create a short link and share it anywhere.',
        action: { label: 'Create a link', to: '/links' },
      },
      global,
    })

    const root = wrapper.get('[data-empty-state]')
    expect(root.text()).toContain('No links yet')
    expect(root.text()).toContain('Create a short link and share it anywhere.')
    expect(root.find('h1').exists()).toBe(false)
    const actions = root.findAll('a, button')
    expect(actions).toHaveLength(1)
    expect(actions[0].text()).toBe('Create a link')
    expect(actions[0].attributes('href')).toBe('/links')
  })

  it('renders no action control when the action is null', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'No data yet', body: '', action: null },
      global,
    })

    expect(wrapper.findAll('a, button')).toHaveLength(0)
  })

  it('runs a click action', async () => {
    const onClick = vi.fn()
    const wrapper = mount(EmptyState, {
      props: { title: 'No links yet', body: '', action: { label: 'Create a link', onClick } },
      global,
    })

    const button = wrapper.get('button')
    expect(button.text()).toBe('Create a link')
    await button.trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders an external action as a plain link', () => {
    const wrapper = mount(EmptyState, {
      props: {
        title: 'No upcoming events',
        body: '',
        action: { label: 'Follow on Facebook', to: 'https://facebook.com/jpcs' },
      },
      global,
    })

    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe('https://facebook.com/jpcs')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
  })

  it('renders the icon slot inside the muted disc', () => {
    const wrapper = mount(EmptyState, {
      props: { title: 'No data yet', body: '', action: null },
      slots: { icon: '<svg data-testid="empty-icon" />' },
      global,
    })

    const disc = wrapper.get('div.flex.size-14')
    expect(disc.find('[data-testid="empty-icon"]').exists()).toBe(true)
  })
})
