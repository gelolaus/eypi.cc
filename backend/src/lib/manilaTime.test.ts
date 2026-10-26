import { describe, expect, it } from 'vitest'
import { manilaDay, manilaDaySpan, manilaHour, manilaTimestamp, manilaWindow } from './manilaTime'

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
})
