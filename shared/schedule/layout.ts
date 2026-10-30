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
