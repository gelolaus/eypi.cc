import { describe, expect, it } from 'vitest'
import { SAMPLE_TERM2, SAMPLE_TERM3 } from './fixtures'
import { entriesByDay, groupDays } from './layout'
import { parseRams } from './parseRams'

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
