import type { Day, ParsedSchedule } from './types'

export type Entry = { code: string; section: string; day: Day; start: number; end: number; room: string; async: boolean }

export const DAY_ORDER: Day[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Every meeting of the schedule, grouped by day (only days that have one) and sorted by start time. */
export function entriesByDay(schedule: ParsedSchedule): Partial<Record<Day, Entry[]>> {
  const byDay: Partial<Record<Day, Entry[]>> = {}
  for (const subject of schedule.subjects) {
    for (const meeting of subject.meetings) {
      const entry: Entry = {
        code: subject.code,
        section: subject.section,
        day: meeting.day,
        start: meeting.start,
        end: meeting.end,
        room: meeting.room,
        async: Boolean(meeting.async),
      }
      ;(byDay[meeting.day] ??= []).push(entry)
    }
  }
  const ordered: Partial<Record<Day, Entry[]>> = {}
  for (const day of DAY_ORDER) {
    const entries = byDay[day]
    if (entries) ordered[day] = entries.sort((a, b) => a.start - b.start || a.end - b.end)
  }
  return ordered
}

export type DayGroup = { days: Day[]; label: string; entries: Entry[] }

const signature = (entries: Entry[]) => entries.map((e) => [e.code, e.start, e.end, e.room, e.async].join('|')).join(';')

/** Days with the same classes at the same times and rooms share a group, labelled like `Tue · Fri`. */
export function groupDays(schedule: ParsedSchedule): DayGroup[] {
  const groups = new Map<string, DayGroup>()
  for (const [day, entries] of Object.entries(entriesByDay(schedule)) as [Day, Entry[]][]) {
    const key = signature(entries)
    const group = groups.get(key)
    if (group) group.days.push(day)
    else groups.set(key, { days: [day], label: '', entries })
  }
  return [...groups.values()]
    .map((group) => ({ ...group, label: group.days.join(' · ') }))
    .sort((a, b) => DAY_ORDER.indexOf(a.days[0]) - DAY_ORDER.indexOf(b.days[0]))
}

const MIN_SPAN_HOURS = 4

/**
 * The grid range, in hours, covering every fixed-time meeting (async ones are left out). Classes run on the :30, so both ends sit on a :30 mark,
 * an hour outside the first start and last end (7:30 AM to 5:30 PM gives 6.5 to 18.5). At least four hours; 7.5 to 17.5 when empty.
 */
export function timelineRange(schedule: ParsedSchedule): { startHour: number; endHour: number } {
  const timed = Object.values(entriesByDay(schedule)).flat().filter((entry) => !entry.async)
  if (timed.length === 0) return { startHour: 7.5, endHour: 17.5 }
  const mark = (minutes: number, round: (value: number) => number) => round((minutes - 30) / 60) * 60 + 30
  const startHour = (mark(Math.min(...timed.map((e) => e.start)), Math.floor) - 60) / 60
  const endHour = Math.max((mark(Math.max(...timed.map((e) => e.end)), Math.ceil) + 60) / 60, startHour + MIN_SPAN_HOURS)
  return { startHour, endHour }
}

export type Conflict = { day: Day; a: Entry; b: Entry }

/** Pairs of fixed-time classes that overlap on the same day. Classes that only touch (one ends as the next starts) do not. */
export function findConflicts(schedule: ParsedSchedule): Conflict[] {
  const conflicts: Conflict[] = []
  for (const [day, entries] of Object.entries(entriesByDay(schedule)) as [Day, Entry[]][]) {
    const timed = entries.filter((entry) => !entry.async)
    for (let i = 0; i < timed.length; i++) {
      for (let j = i + 1; j < timed.length; j++) {
        if (timed[i].start < timed[j].end && timed[j].start < timed[i].end) conflicts.push({ day, a: timed[i], b: timed[j] })
      }
    }
  }
  return conflicts
}
