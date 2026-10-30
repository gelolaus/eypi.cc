import { describe, expect, it } from 'vitest'
import { normalizeText, parseMeetings, parseTerm, splitRows, toMinutes } from './parseRams'
import { SAMPLE_TERM1, SAMPLE_TERM2, SAMPLE_TERM3, wholePage } from './fixtures'

describe('normalizeText', () => {
  it('turns browser whitespace into plain lines', () => {
    expect(normalizeText('A\xa0B\r\n\tC  \r\n\r\nD')).toBe('A B\nC\nD')
  })
})

describe('parseTerm', () => {
  it('reads the term from the two-line RAMS label', () => {
    expect(parseTerm('Academic Year & Term: 2026\n -2027, Term 2')).toBe('2026-2027 · Term 2')
  })

  it('reads the term when the label is on one line with a stray space', () => {
    expect(parseTerm('Academic Year & Term: 2025 -2026, Term 3')).toBe('2025-2026 · Term 3')
  })

  it('returns null when there is no term line', () => {
    expect(parseTerm('hello')).toBeNull()
  })
})

describe('splitRows', () => {
  const codes = (text: string) => splitRows(normalizeText(text)).map((row) => row.code)

  it('finds one row per subject in the Term 2 sample', () => {
    const rows = splitRows(normalizeText(SAMPLE_TERM2))
    expect(rows.map((row) => row.code)).toEqual(['MIKE1', 'NOVEMBER1', 'OSCAR1', 'PAPA1', 'QUEBEC1'])
    expect(rows.map((row) => row.section)).toEqual(['AB101', 'AB101', 'AB101/AB102', 'XY01', 'AB101'])
  })

  it('reads a hyphenated section and the units', () => {
    const rows = splitRows(normalizeText(SAMPLE_TERM3))
    expect(rows[0]).toMatchObject({ code: 'ALPHA1', section: 'AB101', units: 2 })
    expect(rows[1]).toMatchObject({ code: 'BRAVO1', section: 'XYZ01-T', units: 3 })
  })

  it('keeps the lines after the units for the row', () => {
    const rows = splitRows(normalizeText(SAMPLE_TERM2))
    expect(rows[2].lines).toEqual(['Saturday', '7:30AM - 11:30AM', '502', 'Reed, Taylor Jay Moss'])
  })

  it('does not start a row at a section or room line', () => {
    expect(codes('AB101\nXY01\n1001\nASYNC\nAB101/AB102 3.0')).toEqual([])
  })

  it('ignores the sidebar, name and total line of a whole-page copy', () => {
    const page = wholePage(SAMPLE_TERM1, '2026 -2027, Term 1')
    expect(codes(page)).toEqual(codes(SAMPLE_TERM1))
    expect(codes(page)).toHaveLength(6)
    const last = splitRows(normalizeText(page)).at(-1)!
    expect(last.lines.join(' ')).not.toContain('Total Units')
  })
})

describe('toMinutes', () => {
  it('converts clock times to minutes since midnight', () => {
    expect(toMinutes(9, 30, 'AM')).toBe(570)
    expect(toMinutes(5, 30, 'PM')).toBe(1050)
  })

  it('treats 12 PM as noon and 12 AM as midnight', () => {
    expect(toMinutes(12, 50, 'PM')).toBe(770)
    expect(toMinutes(12, 0, 'AM')).toBe(0)
  })
})

describe('parseMeetings', () => {
  const meetingsOf = (sample: string, code: string) => {
    const row = splitRows(normalizeText(sample)).find((r) => r.code === code)!
    return parseMeetings(row)
  }

  it('pairs two days with their times and rooms', () => {
    const { meetings, instructor, warnings } = meetingsOf(SAMPLE_TERM2, 'QUEBEC1')
    expect(meetings).toEqual([
      { day: 'Tue', start: 810, end: 930, room: '203' },
      { day: 'Fri', start: 810, end: 930, room: '203' },
    ])
    expect(instructor).toBe('Ng, Ellis Zoe Ora')
    expect(warnings).toEqual([])
  })

  it('keeps a repeated day as two meetings and marks the async one', () => {
    const { meetings } = meetingsOf(SAMPLE_TERM3, 'ALPHA1')
    expect(meetings).toEqual([
      { day: 'Mon', start: 810, end: 930, room: '1001' },
      { day: 'Mon', start: 770, end: 810, room: '', async: true },
    ])
  })

  it('reads a Saturday-only subject and free-text rooms', () => {
    expect(meetingsOf(SAMPLE_TERM2, 'OSCAR1').meetings).toEqual([{ day: 'Sat', start: 450, end: 690, room: '502' }])
    expect(meetingsOf(SAMPLE_TERM1, 'HOTEL1').meetings.map((m) => m.room)).toEqual(['Library', 'Library'])
    expect(meetingsOf(SAMPLE_TERM3, 'BRAVO1').meetings[0].room).toBe('508-A')
  })

  it('returns the pairs it can and a warning when a time is missing', () => {
    const row = { code: 'BROKEN', section: 'AB101', units: 3, lines: ['Monday', 'Thursday', '9:30AM - 11:30AM', '502', '502', 'Last, First'] }
    const { meetings, warnings } = parseMeetings(row)
    expect(meetings).toHaveLength(1)
    expect(warnings.join(' ')).toContain('BROKEN')
  })
})
