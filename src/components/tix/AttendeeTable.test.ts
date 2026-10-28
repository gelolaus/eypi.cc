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

  it('scrolls the list inside an overflow-x-auto wrapper and has no tiny text controls', () => {
    const wrapper = mountTable()
    const html = wrapper.html()
    expect(wrapper.get('.overflow-x-auto').find('[data-attendee-list]').exists()).toBe(true)
    expect(html).not.toContain('text-[0.6rem]')
    expect(html).not.toContain('text-[0.65rem]')
  })

  it('attendee name is text-base', () => {
    const wrapper = mountTable()
    for (const row of wrapper.findAll('[data-attendee-row]')) {
      const name = row.get('p.font-bold')
      expect(name.classes()).toEqual(expect.arrayContaining(['font-mono', 'text-base', 'font-bold']))
    }
  })

  it('email on mobile card is text-sm', () => {
    const wrapper = mountTable()
    for (const row of wrapper.findAll('[data-attendee-row]')) {
      for (const text of row.findAll('p')) expect(text.classes(), text.text()).not.toContain('text-xs')
      const email = row.findAll('p').filter((p) => p.text().includes('@x.com'))
      expect(email.length).toBeGreaterThan(0)
      for (const p of email) expect(p.classes()).toContain('text-sm')
    }
  })

  it('gives every row action a 44px target', () => {
    const wrapper = mountTable()
    for (const row of wrapper.findAll('[data-attendee-row]')) {
      for (const button of row.findAll('button')) {
        const cls = button.classes().join(' ')
        expect(cls, button.text()).toMatch(/h-11|min-h-11/)
        expect(button.attributes('data-slot')).toBe('button')
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
