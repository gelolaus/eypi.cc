// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AttendeeTable from './AttendeeTable.vue'

const attendee = (id: string, status: string | null) => ({
  id,
  first_name: 'Ana',
  last_name: id,
  email: `${id}@x.com`,
  status,
  actioned_at: null,
  cluster_value: null,
  qr_token: 'qr',
})

function mountTable(attendees = [attendee('one', null), attendee('two', 'checked_in'), attendee('three', 'removed')]) {
  return mount(AttendeeTable, {
    props: {
      attendees,
      loading: false,
      actionPending: '',
      exporting: false,
      downloadingZip: false,
      tabFilter: null,
      tabLabel: 'All',
      clusters: [],
    },
  })
}

describe('AttendeeTable mobile layout', () => {
  it('renders one DOM tree per attendee as a card below md and a row from md', () => {
    const wrapper = mountTable()
    const rows = wrapper.findAll('[data-attendee-row]')
    expect(rows).toHaveLength(3)
    expect(rows[0].classes()).toContain('rounded-2xl')
    expect(rows[0].classes()).toContain('md:grid')
  })

  it('has no horizontal-scroll wrapper and no tiny text controls', () => {
    const html = mountTable().html()
    expect(html).not.toMatch(/min-w-\[\d+px\]/)
    expect(html).not.toContain('overflow-x-auto')
    expect(html).not.toContain('text-[0.6rem]')
    expect(html).not.toContain('text-[0.65rem]')
  })

  it('gives every row action a 44px target', () => {
    const wrapper = mountTable()
    for (const row of wrapper.findAll('[data-attendee-row]')) {
      for (const button of row.findAll('button')) {
        const cls = button.classes().join(' ')
        expect(cls, button.text()).toMatch(/min-h-11|btn-(primary|secondary|danger)/)
      }
    }
  })

  it('still emits check-in and download-qr', async () => {
    const wrapper = mountTable([attendee('one', null)])
    await wrapper.find('button[title="Check in"]').trigger('click')
    expect(wrapper.emitted('checkIn')?.[0]).toEqual(['one'])
    const qr = wrapper.findAll('button').find((b) => b.text() === 'Download QR')
    await qr!.trigger('click')
    expect(wrapper.emitted('downloadQr')).toBeTruthy()
  })
})
