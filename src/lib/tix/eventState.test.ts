import { describe, expect, it } from 'vitest'
import { primaryAction, registrationBlock, type AdmissionMode, type PublicEvent, type Ticket, type TicketStatus } from './eventState'

const NOW = new Date('2026-11-01T00:00:00Z')

function event(over: Partial<PublicEvent> = {}): PublicEvent {
  return {
    slug: 'launch', name: 'Launch', eventDate: '2026-11-10', eventTime: '09:00', endTime: null, location: 'Hall',
    descriptionHtml: '', coverUrl: null, coverMeta: null, admissionMode: 'fcfs', seatsLeft: 5, waitlistEnabled: false,
    registrationOpensAt: null, registrationClosesAt: null, status: 'published', questions: [],
    org: { slug: 'o', name: 'Org' },
    ...over,
  }
}

function ticket(status: TicketStatus): Ticket {
  return { id: 't', status, qrToken: null, waitlistPosition: null, answers: {}, event: { slug: 'launch', name: 'Launch', eventDate: '2026-11-10', eventTime: '09:00', endTime: null, location: 'Hall', coverUrl: null, coverMeta: null } }
}

describe('primaryAction without a ticket', () => {
  const open: [AdmissionMode, string, string][] = [
    ['fcfs', 'Register', 'register'],
    ['lottery', 'Enter lottery', 'register'],
    ['approval', 'Request a spot', 'register'],
    ['import', 'Registration closed', 'none'],
  ]
  it.each(open)('%s open -> %s', (mode, label, kind) => {
    expect(primaryAction(event({ admissionMode: mode }), null, NOW)).toEqual({ label, kind })
  })

  it('fcfs full with waitlist joins the waitlist', () => {
    expect(primaryAction(event({ seatsLeft: 0, waitlistEnabled: true }), null, NOW)).toEqual({ label: 'Join waitlist', kind: 'register' })
  })
  it('fcfs full without waitlist is closed', () => {
    expect(primaryAction(event({ seatsLeft: 0 }), null, NOW)).toEqual({ label: 'Registration closed', kind: 'none' })
  })
  it('fcfs without a cap (seatsLeft null) registers', () => {
    expect(primaryAction(event({ seatsLeft: null }), null, NOW).label).toBe('Register')
  })
  it.each(['closed', 'cancelled', 'draft'])('status %s is closed', (status) => {
    expect(primaryAction(event({ status }), null, NOW)).toEqual({ label: 'Registration closed', kind: 'none' })
  })
  it('before the window opens', () => {
    expect(primaryAction(event({ registrationOpensAt: '2026-11-02 00:00:00' }), null, NOW).kind).toBe('none')
    expect(registrationBlock(event({ registrationOpensAt: '2026-11-02 00:00:00' }), NOW)).toBe('not_open_yet')
  })
  it('after an explicit close time', () => {
    expect(registrationBlock(event({ registrationClosesAt: '2026-10-31 23:59:59' }), NOW)).toBe('closed')
  })
  it('defaults to closing at the Manila event start', () => {
    const e = event({ eventDate: '2026-11-01', eventTime: '09:00' })
    expect(registrationBlock(e, new Date('2026-11-01T00:59:00Z'))).toBeNull()
    expect(registrationBlock(e, new Date('2026-11-01T01:00:00Z'))).toBe('closed')
  })
  it('lottery and approval ignore seatsLeft', () => {
    expect(primaryAction(event({ admissionMode: 'lottery', seatsLeft: 0 }), null, NOW).label).toBe('Enter lottery')
  })
})

describe('primaryAction with a ticket', () => {
  const rows: [TicketStatus, string, string][] = [
    ['confirmed', "You're in", 'view-ticket'],
    ['waitlisted', 'On the waitlist', 'view-ticket'],
    ['entered', 'Entered', 'view-ticket'],
    ['pending', 'Pending approval', 'view-ticket'],
    ['declined', 'Registration closed', 'none'],
  ]
  it.each(rows)('%s -> %s', (status, label, kind) => {
    expect(primaryAction(event(), ticket(status), NOW)).toEqual({ label, kind })
  })
  it('a cancelled ticket can register again while registration is open', () => {
    expect(primaryAction(event(), ticket('cancelled'), NOW)).toEqual({ label: 'Register', kind: 'register' })
    expect(primaryAction(event({ status: 'closed' }), ticket('cancelled'), NOW)).toEqual({ label: 'Registration closed', kind: 'none' })
  })
  it('a ticket holder keeps their state after registration closes', () => {
    expect(primaryAction(event({ status: 'closed' }), ticket('confirmed'), NOW).label).toBe("You're in")
  })
})
