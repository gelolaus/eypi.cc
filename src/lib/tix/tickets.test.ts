import { describe, expect, it } from 'vitest'
import { isPastEvent, type TicketDto } from './tickets'

const ticket = (eventDate: string): TicketDto => ({
  id: 't', status: 'confirmed', qrToken: 'q', waitlistPosition: null, answers: {},
  event: { slug: 's', name: 'N', eventDate, eventTime: '20:00', endTime: null, location: 'L', coverUrl: null, coverMeta: null },
})
const manila = (iso: string) => Date.parse(`${iso}+08:00`)

describe('isPastEvent', () => {
  it('is still upcoming on the event day and until 06:00 Manila the next day', () => {
    expect(isPastEvent(ticket('2026-11-01'), manila('2026-11-01T23:30:00'))).toBe(false)
    expect(isPastEvent(ticket('2026-11-01'), manila('2026-11-02T01:00:00'))).toBe(false)
    expect(isPastEvent(ticket('2026-11-01'), manila('2026-11-02T05:59:00'))).toBe(false)
  })
  it('is past from 06:00 Manila the next day', () => {
    expect(isPastEvent(ticket('2026-11-01'), manila('2026-11-02T06:00:00'))).toBe(true)
    expect(isPastEvent(ticket('2026-11-01'), manila('2026-11-05T12:00:00'))).toBe(true)
  })
})
