import { describe, expect, it } from 'vitest'
import { formatClock, formatClockShort, formatRange, instructorLabel } from './format'

describe('formatClock', () => {
  it('writes 12-hour times', () => {
    expect(formatClock(770)).toBe('12:50 PM')
    expect(formatClock(450)).toBe('7:30 AM')
    expect(formatClock(0)).toBe('12:00 AM')
    expect(formatClock(720)).toBe('12:00 PM')
  })
})

describe('formatClockShort', () => {
  it('writes the 12-hour time without AM or PM', () => {
    expect(formatClockShort(450)).toBe('7:30')
    expect(formatClockShort(810)).toBe('1:30')
    expect(formatClockShort(1050)).toBe('5:30')
    expect(formatClockShort(0)).toBe('12:00')
  })
})

describe('instructorLabel', () => {
  it('keeps the last name and the first given name', () => {
    expect(instructorLabel('Doe, Jordan Ray')).toBe('Doe, Jordan')
    expect(instructorLabel('Lopez, Casey-Lou Bay')).toBe('Lopez, Casey-Lou')
    expect(instructorLabel('Smith, Pat Jr. Lee')).toBe('Smith, Pat')
  })

  it('skips an abbreviated first token', () => {
    expect(instructorLabel('Reyes, Ma. Sam Lee')).toBe('Reyes, Sam')
  })

  it('passes a placeholder or an empty name through', () => {
    expect(instructorLabel('TBA')).toBe('TBA')
    expect(instructorLabel('')).toBe('')
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
