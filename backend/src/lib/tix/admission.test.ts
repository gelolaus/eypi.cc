import { describe, expect, it } from 'vitest'
import {
  canTransition,
  initialStatus,
  registrationOpen,
  type AdmissionMode,
  type AttendeeStatus,
} from './admission'

const STATUSES: AttendeeStatus[] = ['pending', 'entered', 'waitlisted', 'confirmed', 'declined', 'cancelled']
type Actor = 'attendee' | 'org' | 'system'
const ACTORS: Actor[] = ['attendee', 'org', 'system']

describe('initialStatus', () => {
  const cases: Array<[AdmissionMode, boolean, boolean, string]> = [
    ['fcfs', true, false, 'confirmed'],
    ['fcfs', true, true, 'confirmed'],
    ['fcfs', false, true, 'waitlisted'],
    ['fcfs', false, false, 'full'],
    ['lottery', true, false, 'entered'],
    ['lottery', false, false, 'entered'],
    ['lottery', false, true, 'entered'],
    ['approval', true, false, 'pending'],
    ['approval', false, false, 'pending'],
    ['import', true, false, 'confirmed'],
    ['import', false, false, 'confirmed'],
  ]
  it.each(cases)('%s seatFree=%s waitlist=%s -> %s', (mode, seat, wl, expected) => {
    expect(initialStatus(mode, seat, wl)).toBe(expected)
  })
})

describe('canTransition', () => {
  // Every arrow of spec 5.2, by actor.
  const allowed: Array<[AttendeeStatus, AttendeeStatus, Actor]> = [
    ['waitlisted', 'confirmed', 'system'],
    ['entered', 'confirmed', 'system'],
    ['entered', 'waitlisted', 'system'],
    ['entered', 'declined', 'system'],
    ['pending', 'confirmed', 'org'],
    ['pending', 'declined', 'org'],
    ['confirmed', 'cancelled', 'attendee'],
    ['waitlisted', 'cancelled', 'attendee'],
    ['pending', 'cancelled', 'attendee'],
    ['entered', 'cancelled', 'attendee'],
    ['confirmed', 'cancelled', 'org'],
    ['waitlisted', 'cancelled', 'org'],
    ['pending', 'cancelled', 'org'],
    ['entered', 'cancelled', 'org'],
  ]

  it.each(allowed)('allows %s -> %s by %s', (from, to, actor) => {
    expect(canTransition(from, to, actor)).toBe(true)
  })

  it('rejects every other combination', () => {
    const key = (f: string, t: string, a: string) => `${f}|${t}|${a}`
    const ok = new Set(allowed.map(([f, t, a]) => key(f, t, a)))
    for (const f of STATUSES) {
      for (const t of STATUSES) {
        for (const a of ACTORS) {
          if (!ok.has(key(f, t, a))) {
            expect(canTransition(f, t, a), key(f, t, a)).toBe(false)
          }
        }
      }
    }
  })

  it('never lets an attendee or anyone revive declined or cancelled', () => {
    expect(canTransition('declined', 'confirmed', 'attendee')).toBe(false)
    for (const a of ACTORS) {
      expect(canTransition('cancelled', 'confirmed', a)).toBe(false)
      expect(canTransition('declined', 'confirmed', a)).toBe(false)
    }
  })

  it('does not let an attendee approve themselves', () => {
    expect(canTransition('pending', 'confirmed', 'attendee')).toBe(false)
    expect(canTransition('waitlisted', 'confirmed', 'attendee')).toBe(false)
  })
})

describe('registrationOpen', () => {
  const base = {
    status: 'published',
    admission_mode: 'fcfs' as AdmissionMode,
    registration_opens_at: null as string | null,
    registration_closes_at: null as string | null,
    event_date: '2026-11-10',
    event_time: '18:00', // 10:00 UTC
  }
  const now = new Date('2026-11-01T00:00:00Z')

  it('is open for a published event with no window before the Manila start', () => {
    expect(registrationOpen(base, now)).toEqual({ ok: true })
    expect(registrationOpen(base, new Date('2026-11-10T09:59:59Z'))).toEqual({ ok: true })
  })

  it('closes at the Manila event start when closes is NULL', () => {
    expect(registrationOpen(base, new Date('2026-11-10T10:00:00Z'))).toEqual({
      ok: false,
      code: 'registration_closed',
    })
  })

  it('refuses drafts and unknown states with not_published', () => {
    expect(registrationOpen({ ...base, status: 'draft' }, now)).toEqual({ ok: false, code: 'not_published' })
  })

  it('refuses closed and cancelled events with registration_closed', () => {
    expect(registrationOpen({ ...base, status: 'closed' }, now)).toEqual({ ok: false, code: 'registration_closed' })
    expect(registrationOpen({ ...base, status: 'cancelled' }, now)).toEqual({
      ok: false,
      code: 'registration_closed',
    })
  })

  it('refuses before the opens time with not_open_yet', () => {
    const e = { ...base, registration_opens_at: '2026-11-02 00:00:00' }
    expect(registrationOpen(e, now)).toEqual({ ok: false, code: 'not_open_yet' })
    expect(registrationOpen(e, new Date('2026-11-02T00:00:00Z'))).toEqual({ ok: true })
  })

  it('refuses at or after an explicit closes time', () => {
    const e = { ...base, registration_closes_at: '2026-11-05 00:00:00' }
    expect(registrationOpen(e, new Date('2026-11-04T23:59:59Z'))).toEqual({ ok: true })
    expect(registrationOpen(e, new Date('2026-11-05T00:00:00Z'))).toEqual({
      ok: false,
      code: 'registration_closed',
    })
  })

  it('refuses import events with invite_only', () => {
    expect(registrationOpen({ ...base, admission_mode: 'import' }, now)).toEqual({
      ok: false,
      code: 'invite_only',
    })
  })

  it('reports not_published before invite_only for a draft import event', () => {
    expect(registrationOpen({ ...base, status: 'draft', admission_mode: 'import' }, now)).toEqual({
      ok: false,
      code: 'not_published',
    })
  })

  it('accepts HH:MM:SS times', () => {
    expect(registrationOpen({ ...base, event_time: '18:00:00' }, new Date('2026-11-10T09:59:00Z'))).toEqual({
      ok: true,
    })
  })

  it('treats an unparseable event start as closed rather than open', () => {
    expect(registrationOpen({ ...base, event_time: 'soon' }, now)).toEqual({
      ok: false,
      code: 'registration_closed',
    })
  })
})
