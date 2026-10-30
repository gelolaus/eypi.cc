import { describe, expect, it } from 'vitest'
import { SAMPLE_TERM2, SAMPLE_TERM3 } from './fixtures'
import { entriesByDay, groupDays, timelineRange } from './layout'
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
  it('rounds the earliest start and latest end out to whole hours', () => {
    expect(timelineRange(parseRams(SAMPLE_TERM2))).toEqual({ startHour: 7, endHour: 18 })
  })

  it('spans at least four hours', () => {
    expect(timelineRange(one('Mon', 540, 600))).toEqual({ startHour: 9, endHour: 13 })
  })

  it('falls back to 8 to 17 when no meeting has a fixed time', () => {
    expect(timelineRange(one('Mon', 540, 600, { async: true }))).toEqual({ startHour: 8, endHour: 17 })
    expect(timelineRange({ term: null, subjects: [], warnings: [] })).toEqual({ startHour: 8, endHour: 17 })
  })
})
