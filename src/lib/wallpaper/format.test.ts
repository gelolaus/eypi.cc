import { describe, expect, it } from 'vitest'
import { formatClock, formatRange } from './format'

describe('formatClock', () => {
  it('writes 12-hour times', () => {
    expect(formatClock(770)).toBe('12:50 PM')
    expect(formatClock(450)).toBe('7:30 AM')
    expect(formatClock(0)).toBe('12:00 AM')
    expect(formatClock(720)).toBe('12:00 PM')
  })
})

describe('formatRange', () => {
  it('shares the AM or PM when both ends match', () => {
    expect(formatRange(450, 570)).toBe('7:30 to 9:30 AM')
  })

  it('writes both when the range crosses noon', () => {
    expect(formatRange(690, 810)).toBe('11:30 AM to 1:30 PM')
  })
})
