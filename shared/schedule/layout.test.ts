import { describe, expect, it } from 'vitest'
import { SAMPLE_TERM2, SAMPLE_TERM3 } from './fixtures'
import { entriesByDay, findConflicts, groupDays, timelineRange } from './layout'
import { parseRams } from './parseRams'
import type { Day, ParsedSchedule } from './types'

const one = (day: Day, start: number, end: number, extra: { async?: boolean; code?: string } = {}): ParsedSchedule => ({
  term: null,
  warnings: [],
  subjects: [{ code: extra.code ?? 'ONE', section: 'AB101', units: 3, instructor: '', meetings: [{ day, start, end, room: '1', ...(extra.async ? { async: true } : {}) }] }],
})

describe('entriesByDay', () => {
  it('lists only the days that have classes, each sorted by start time', () => {
    const byDay = entriesByDay(parseRams(SAMPLE_TERM2))
    expect(Object.keys(byDay)).toEqual(['Tue', 'Fri', 'Sat'])
    expect(byDay.Tue!.map((e) => e.code)).toEqual(['NOVEMBER1', 'MIKE1', 'QUEBEC1', 'PAPA1'])
  })

  it('keeps an async meeting as an entry marked async with no room', () => {
    const monday = entriesByDay(parseRams(SAMPLE_TERM3)).Mon!
    expect(monday.find((e) => e.async)).toMatchObject({ code: 'ALPHA1', start: 770, end: 810, room: '' })
  })
})

describe('groupDays', () => {
  it('merges days with identical classes under one label', () => {
    const groups = groupDays(parseRams(SAMPLE_TERM2))
    expect(groups.map((g) => g.label)).toEqual(['Tue · Fri', 'Sat'])
    expect(groups[0].days).toEqual(['Tue', 'Fri'])
    expect(groups[0].entries.map((e) => e.code)).toEqual(['NOVEMBER1', 'MIKE1', 'QUEBEC1', 'PAPA1'])
    expect(groups[1].entries.map((e) => e.code)).toEqual(['OSCAR1'])
  })

  it('keeps days apart when their classes differ', () => {
    expect(groupDays(parseRams(SAMPLE_TERM3)).map((g) => g.label)).toEqual(['Mon', 'Tue', 'Thu', 'Fri'])
  })
})

describe('timelineRange', () => {
  it('runs from an hour before the earliest :30 start to an hour after the latest :30 end', () => {
    // classes from 7:30 AM to 5:30 PM give 6:30 AM to 6:30 PM
    expect(timelineRange(parseRams(SAMPLE_TERM2))).toEqual({ startHour: 6.5, endHour: 18.5 })
  })

  it('keeps both ends on a :30 mark', () => {
    expect(timelineRange(one('Mon', 540, 600))).toEqual({ startHour: 7.5, endHour: 11.5 })
  })

  it('spans at least four hours', () => {
    const { startHour, endHour } = timelineRange(one('Mon', 540, 545))
    expect(endHour - startHour).toBeGreaterThanOrEqual(4)
    expect(startHour % 1).toBe(0.5)
    expect(endHour % 1).toBe(0.5)
  })

  it('falls back to 7:30 to 5:30 when no meeting has a fixed time', () => {
    expect(timelineRange(one('Mon', 540, 600, { async: true }))).toEqual({ startHour: 7.5, endHour: 17.5 })
    expect(timelineRange({ term: null, subjects: [], warnings: [] })).toEqual({ startHour: 7.5, endHour: 17.5 })
  })
})

describe('findConflicts', () => {
  const two = (a: [number, number], b: [number, number]): ParsedSchedule => ({
    term: null,
    warnings: [],
    subjects: [
      { code: 'AAA', section: 'S', units: 3, instructor: '', meetings: [{ day: 'Mon', start: a[0], end: a[1], room: '1' }] },
      { code: 'BBB', section: 'S', units: 3, instructor: '', meetings: [{ day: 'Mon', start: b[0], end: b[1], room: '2' }] },
    ],
  })

  it('flags two classes that overlap on the same day', () => {
    const conflicts = findConflicts(two([540, 660], [630, 720]))
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({ day: 'Mon' })
    expect([conflicts[0].a.code, conflicts[0].b.code]).toEqual(['AAA', 'BBB'])
  })

  it('does not flag classes that only touch', () => {
    expect(findConflicts(two([540, 600], [600, 660]))).toEqual([])
  })

  it('does not flag the sample schedules, including the async slot before 1:30 PM', () => {
    expect(findConflicts(parseRams(SAMPLE_TERM3))).toEqual([])
    expect(findConflicts(parseRams(SAMPLE_TERM2))).toEqual([])
  })
})
