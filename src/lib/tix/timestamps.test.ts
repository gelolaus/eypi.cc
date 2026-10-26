import { describe, expect, it } from 'vitest'
import { formatCalendarDate, parseStoredUtc } from './timestamps'

describe('stored UTC timestamps', () => {
  it('does not shift a stored UTC calendar date by a day', () => {
    const parsed = parseStoredUtc('2026-10-31 20:00:00')
    const manilaDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(parsed)
    expect(manilaDay).toBe('2026-11-01')

    const calendar = formatCalendarDate('2026-11-01')
    expect(calendar).toContain('2026')
    expect(calendar).not.toMatch(/Oct/)
  })
})
