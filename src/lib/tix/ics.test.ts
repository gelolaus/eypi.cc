import { describe, expect, it } from 'vitest'
import { buildIcs, icsFilename } from './ics'
import type { TicketDto } from '@/lib/tix/tickets'

function ticket(event: Partial<TicketDto['event']> = {}): TicketDto {
  return {
    id: 'att-1',
    status: 'confirmed',
    qrToken: 'qr',
    waitlistPosition: null,
    answers: {},
    event: {
      slug: 'launch', name: 'Launch Night', eventDate: '2026-11-10', eventTime: '19:00', endTime: '21:30',
      location: 'APC Hall', coverUrl: null, coverMeta: null, ...event,
    },
  }
}

const lines = (ics: string) => ics.split('\r\n')

describe('buildIcs', () => {
  it('converts Manila time (UTC+8) to UTC', () => {
    const ics = buildIcs(ticket())
    expect(ics).toContain('DTSTART:20261110T110000Z')
    expect(ics).toContain('DTEND:20261110T133000Z')
  })

  it('crosses midnight in UTC when Manila is early morning', () => {
    expect(buildIcs(ticket({ eventTime: '06:00', endTime: '07:00' }))).toContain('DTSTART:20261109T220000Z')
  })

  it('ends two hours after the start when there is no end time', () => {
    expect(buildIcs(ticket({ endTime: null }))).toContain('DTEND:20261110T130000Z')
  })

  it('treats an end time that is not after the start as missing', () => {
    expect(buildIcs(ticket({ eventTime: '22:00', endTime: '01:00' }))).toContain('DTEND:20261110T160000Z')
    expect(buildIcs(ticket({ eventTime: '19:00', endTime: '19:00' }))).toContain('DTEND:20261110T130000Z')
  })

  it('returns null for an unreadable date or time', () => {
    expect(buildIcs(ticket({ eventDate: 'soon' }))).toBeNull()
    expect(buildIcs(ticket({ eventTime: 'TBA' }))).toBeNull()
  })

  it('links to the event page', () => {
    expect(buildIcs(ticket())).toContain('URL:https://eypi.cc/tix/launch')
  })

  it('uses the ticket id for the UID and CRLF line endings', () => {
    const ics = buildIcs(ticket())!
    expect(ics).toContain('UID:att-1@eypi.cc')
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('escapes commas, semicolons, backslashes and newlines', () => {
    const ics = buildIcs(ticket({ name: 'A, B; C\\D', location: 'Hall\nRoom 2' }))!
    expect(ics).toContain(String.raw`SUMMARY:A\, B\; C\\D`)
    expect(ics).toContain('LOCATION:Hall\\nRoom 2')
  })

  it('folds lines longer than 75 octets without splitting characters', () => {
    const ics = buildIcs(ticket({ name: 'é'.repeat(100) }))!
    for (const line of lines(ics)) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain(`SUMMARY:${'é'.repeat(100)}`)
  })
})

describe('icsFilename', () => {
  it('is the slug with an ics extension', () => {
    expect(icsFilename(ticket())).toBe('launch.ics')
  })
})
