import type { Day, Meeting, ParsedSchedule, Subject } from './types'
export const MAX_PASTE_LENGTH = 100_000

/** CRLF to LF, non-breaking spaces and tabs to spaces, each line trimmed, blank lines dropped. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\xa0\t]/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

const TERM_LINE = /Academic Year\s*&\s*Term:\s*(\d{4})\s*-\s*(\d{4})\s*,\s*Term\s*(\d)/i

/** The term from the "Academic Year & Term:" line, as `2026-2027 · Term 2`, or null when it is not there. */
export function parseTerm(text: string): string | null {
  const match = TERM_LINE.exec(text)
  return match ? `${match[1]}-${match[2]} · Term ${match[3]}` : null
}

export type RawRow = { code: string; section: string; units: number; lines: string[] }

/** A row starts where a subject code, a section and the units sit on one line, like `MIKE1 AB101 3.0`. */
const ROW_START = /^([A-Z][A-Z0-9]{2,9})\s+([A-Z0-9][A-Z0-9/-]*)\s+(\d+\.\d)\b/

/** Splits normalized text into subject rows. A row runs to the next row start or to the `Total Units` line. */
export function splitRows(normalized: string): RawRow[] {
  const rows: RawRow[] = []
  let current: RawRow | null = null
  for (const line of normalized.split('\n')) {
    const start = ROW_START.exec(line)
    if (start) {
      current = { code: start[1], section: start[2], units: Number(start[3]), lines: [] }
      rows.push(current)
    } else if (/^Total Units\b/i.test(line)) {
      current = null
    } else if (current) {
      current.lines.push(line)
    }
  }
  return rows
}

/** Minutes since midnight for a 12-hour clock time. 12 AM is 0 and 12 PM is 720. */
export function toMinutes(h: number, m: number, meridiem: 'AM' | 'PM'): number {
  return ((h % 12) + (meridiem === 'PM' ? 12 : 0)) * 60 + m
}

const DAYS: Record<string, Day> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}
/** An instructor line with no comma, like `TBA`. After the first room it is the instructor, not a room. */
const PLACEHOLDER_INSTRUCTOR = /^(TBA|TBD|STAFF)$/i
const TIME_RANGE = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i

function readTime(line: string): { start: number; end: number } | null {
  const m = TIME_RANGE.exec(line)
  if (!m) return null
  return {
    start: toMinutes(Number(m[1]), Number(m[2]), m[3].toUpperCase() as 'AM' | 'PM'),
    end: toMinutes(Number(m[4]), Number(m[5]), m[6].toUpperCase() as 'AM' | 'PM'),
  }
}

/**
 * Day lines, then time lines, then one room line per day, then the instructor. Days, times and rooms are
 * paired by position. A room of `ASYNC` becomes an async meeting with no room.
 */
export function parseMeetings(row: RawRow): { meetings: Meeting[]; instructor: string; warnings: string[] } {
  const days: Day[] = []
  const times: { start: number; end: number }[] = []
  const rooms: string[] = []
  const rest: string[] = []
  for (const line of row.lines) {
    const day = DAYS[line.toLowerCase()]
    const time = readTime(line)
    if (day && times.length === 0 && rooms.length === 0 && rest.length === 0) days.push(day)
    else if (time && rooms.length === 0 && rest.length === 0) times.push(time)
    else if (rooms.length < days.length && rest.length === 0 && !line.includes(',') && !(rooms.length > 0 && PLACEHOLDER_INSTRUCTOR.test(line))) rooms.push(line)
    else rest.push(line)
  }

  const warnings: string[] = []
  if (days.length !== times.length) {
    warnings.push(`${row.code}: found ${days.length} day(s) but ${times.length} time(s), so some meetings were skipped.`)
  }
  const meetings: Meeting[] = []
  for (let i = 0; i < Math.min(days.length, times.length); i++) {
    if (times[i].end <= times[i].start) {
      warnings.push(`${row.code}: a ${days[i]} time does not end after it starts, so it was skipped.`)
      continue
    }
    const room = rooms[i] ?? ''
    const meeting: Meeting = { day: days[i], ...times[i], room }
    if (/^async$/i.test(room)) {
      meeting.room = ''
      meeting.async = true
    }
    meetings.push(meeting)
  }
  return { meetings, instructor: rest.join(' '), warnings }
}

/** Reads a RAMS class schedule from pasted text: the table alone or the whole page. Never keeps the student's name or number. */
export function parseRams(raw: string): ParsedSchedule {
  const normalized = normalizeText(raw.slice(0, MAX_PASTE_LENGTH))
  const warnings: string[] = []
  const subjects: Subject[] = []
  for (const row of splitRows(normalized)) {
    const { meetings, instructor, warnings: rowWarnings } = parseMeetings(row)
    warnings.push(...rowWarnings)
    if (meetings.length === 0 && rowWarnings.length === 0) warnings.push(`${row.code}: no days or times found.`)
    subjects.push({ code: row.code, section: row.section, units: row.units, instructor, meetings })
  }
  return { term: parseTerm(normalized), subjects, warnings }
}
