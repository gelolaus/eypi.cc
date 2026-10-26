import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatManilaDate, formatManilaDateTime } from './manilaTime'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Manila time formatting', () => {
  it('renders a stored UTC timestamp in Asia/Manila, crossing midnight', () => {
    expect(formatManilaDate('2026-06-30 17:30:00')).toBe('Jul 1, 2026')
    expect(formatManilaDateTime('2026-06-30 17:30:00')).toBe('2026-07-01 01:30')
  })

  it('pins Asia/Manila instead of the machine timezone', () => {
    const Real = Intl.DateTimeFormat
    const zones: (string | undefined)[] = []
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (locales?: string | string[], options?: Intl.DateTimeFormatOptions) {
      zones.push(options?.timeZone)
      return new Real(locales, options)
    } as unknown as typeof Intl.DateTimeFormat)

    formatManilaDate('2026-06-30T17:30:00Z')
    formatManilaDateTime('2026-06-30T17:30:00Z')

    expect(zones).toEqual(['Asia/Manila', 'Asia/Manila'])
  })

  it('returns an empty string for empty input and the raw value for invalid input', () => {
    expect(formatManilaDate('')).toBe('')
    expect(formatManilaDateTime('')).toBe('')
    expect(formatManilaDate('not-a-date')).toBe('not-a-date')
    expect(formatManilaDateTime('not-a-date')).toBe('not-a-date')
  })
})
