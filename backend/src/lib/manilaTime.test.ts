import { describe, expect, it } from 'vitest'
import { manilaDay, manilaDayRange, manilaDaySpan, manilaEventStart, manilaHour, manilaHourOfWeek, manilaTimestamp, manilaWindow } from './manilaTime'

describe('manilaTime', () => {
  it('maps 2026-10-25T17:00:00Z onto Manila day 2026-10-26', () => {
    expect(manilaDay('2026-10-25T17:00:00Z')).toBe('2026-10-26')
    expect(manilaDay('2026-10-25 17:00:00')).toBe('2026-10-26')
    expect(manilaTimestamp('2026-10-25T17:00:00Z')).toBe('2026-10-26 01:00:00')
    expect(manilaHour('2026-10-25T17:00:00Z')).toBe(1)
  })

  it('keeps a click before 16:00 UTC on the same Manila day', () => {
    expect(manilaDay('2026-10-25T15:59:59Z')).toBe('2026-10-25')
    expect(manilaDay('2026-10-25T16:00:00Z')).toBe('2026-10-26')
  })

  it('lists the Manila days in a 7-day window ending 2026-10-26', () => {
    expect(manilaDaySpan(7, new Date('2026-10-26T02:00:00Z'))).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ])
  })

  it('starts a 7-day window at Manila midnight on 2026-10-20', () => {
    expect(manilaWindow(7, new Date('2026-10-26T02:00:00Z'))).toEqual({
      start: '2026-10-19 16:00:00',
      end: '2026-10-26 16:00:00',
    })
  })

  it('turns a Manila event date and time into the UTC instant', () => {
    expect(manilaEventStart('2026-11-02', '09:30').toISOString()).toBe('2026-11-02T01:30:00.000Z')
    expect(manilaEventStart('2026-11-02', '00:15:00').toISOString()).toBe('2026-11-01T16:15:00.000Z')
  })
})

describe('manilaHourOfWeek and manilaDayRange', () => {
  it('counts hours from Monday 00:00 Manila and wraps Sunday 23:00 to 167', () => {
    // 2026-10-26 is a Monday. Sunday 16:30Z is Monday 00:30 Manila.
    expect(manilaHourOfWeek(new Date('2026-10-25T16:30:00Z'))).toBe(0)
    expect(manilaHourOfWeek(new Date('2026-10-26T16:30:00Z'))).toBe(24)
    expect(manilaHourOfWeek(new Date('2026-10-25T15:30:00Z'))).toBe(167)
  })

  it('returns the UTC range of a Manila day', () => {
    expect(manilaDayRange('2026-10-26')).toEqual(['2026-10-25 16:00:00', '2026-10-26 16:00:00'])
  })
})
