// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkInRate, deltaPercent, formatDelta, sumTimeline } from './dashboardModel'

describe('deltaPercent', () => {
  it('computes signed percentage change', () => {
    expect(deltaPercent(110, 100)).toBe(10)
    expect(deltaPercent(50, 100)).toBe(-50)
  })
  it('returns null when previous is 0', () => {
    expect(deltaPercent(5, 0)).toBeNull()
    expect(deltaPercent(0, 0)).toBeNull()
  })
})

describe('formatDelta', () => {
  it('labels a first non-zero period as new', () => {
    expect(formatDelta(5, 0)).toEqual({ direction: 'new', text: 'New' })
  })
  it('returns none for zeros', () => {
    expect(formatDelta(0, 0)).toEqual({ direction: 'none', text: '' })
  })
  it('marks an unchanged total as flat', () => {
    expect(formatDelta(100, 100)).toEqual({ direction: 'flat', text: '0%' })
  })
  it('formats up and down with a sign', () => {
    expect(formatDelta(110, 100)).toEqual({ direction: 'up', text: '+10%' })
    expect(formatDelta(50, 100)).toEqual({ direction: 'down', text: '-50%' })
  })
})

describe('checkInRate', () => {
  it('returns a percentage capped at 100', () => {
    expect(checkInRate(30, 60)).toBe(50)
    expect(checkInRate(60, 60)).toBe(100)
    expect(checkInRate(90, 60)).toBe(100)
  })
  it('returns null when there are no registrations', () => {
    expect(checkInRate(1, 0)).toBeNull()
  })
})

describe('sumTimeline', () => {
  it('sums clicks and uniques', () => {
    expect(sumTimeline([
      { clicks: 1, uniques: 1 },
      { clicks: 4, uniques: 2 },
    ])).toEqual({ clicks: 5, uniques: 3 })
  })
})