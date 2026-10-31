// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UpcomingTickets from './UpcomingTickets.vue'
import type { TicketSummary } from '@/lib/queries'

const RouterLink = { props: ['to'], template: '<a :href="String(to)"><slot /></a>' }
const global = { stubs: { RouterLink } }

function ticket(name: string, date: string): TicketSummary {
  return {
    id: name,
    status: 'confirmed',
    qrToken: null,
    waitlistPosition: null,
    answers: {},
    event: {
      slug: name,
      name,
      eventDate: date,
      eventTime: '18:00',
      endTime: null,
      location: 'APC',
      coverUrl: null,
      coverMeta: null,
    },
  }
}

describe('UpcomingTickets', () => {
  it('lists up to three tickets with a View all link', () => {
    const tickets = [
      ticket('Alpha', '2026-11-01'),
      ticket('Beta', '2026-11-02'),
      ticket('Gamma', '2026-11-03'),
      ticket('Delta', '2026-11-04'),
    ]
    const wrapper = mount(UpcomingTickets, { props: { tickets, status: 'ready' }, global })
    expect(wrapper.text()).toContain('Alpha')
    expect(wrapper.text()).toContain('2026-11-01')
    expect(wrapper.text()).toContain('Gamma')
    expect(wrapper.text()).not.toContain('Delta')
    const link = wrapper.get('a[href="/tickets"]')
    expect(link.text()).toBe('View all')
  })

  it('shows No upcoming tickets with no action button when empty', () => {
    const wrapper = mount(UpcomingTickets, { props: { tickets: [], status: 'ready' }, global })
    expect(wrapper.text()).toContain('No upcoming tickets')
    expect(wrapper.find('a, button').exists()).toBe(false)
  })
})