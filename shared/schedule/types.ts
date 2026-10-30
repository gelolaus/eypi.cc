export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

/** `start` and `end` are minutes since midnight. An async meeting has no room. */
export type Meeting = { day: Day; start: number; end: number; room: string; async?: boolean }

export type Subject = {
  code: string
  section: string
  units: number
  instructor: string
  meetings: Meeting[]
}

export type ParsedSchedule = { term: string | null; subjects: Subject[]; warnings: string[] }
