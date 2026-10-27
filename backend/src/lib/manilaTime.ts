const MANILA_OFFSET_HOURS = 8
const MANILA_OFFSET_MS = MANILA_OFFSET_HOURS * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export function asUtc(input: string | Date): Date {
  if (input instanceof Date) return new Date(input.getTime())
  const trimmed = input.trim()
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const withZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`
  return new Date(withZone)
}

function shifted(input: string | Date): Date {
  return new Date(asUtc(input).getTime() + MANILA_OFFSET_MS)
}

function sqlUtc(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

/** Calendar day in Manila (UTC+8) for a UTC instant. Naive strings are UTC. */
export function manilaDay(input: string | Date): string {
  return shifted(input).toISOString().slice(0, 10)
}

/** `YYYY-MM-DD HH:MM:SS` in Manila. */
export function manilaTimestamp(input: string | Date): string {
  return shifted(input).toISOString().slice(0, 19).replace('T', ' ')
}

/** Hour 0–23 in Manila. */
export function manilaHour(input: string | Date): number {
  return shifted(input).getUTCHours()
}

/** Inclusive Manila calendar days ending today, oldest first. */
export function manilaDaySpan(count: number, now: Date = new Date()): string[] {
  const today = manilaDay(now)
  const [year, month, day] = today.split('-').map(Number)
  const end = Date.UTC(year, month - 1, day)
  const days: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    days.push(new Date(end - i * DAY_MS).toISOString().slice(0, 10))
  }
  return days
}

/**
 * UTC instants for the Manila window, formatted for SQLite `datetime` comparison.
 * `start` is inclusive and `end` is exclusive.
 */
export function manilaWindow(days: number, now: Date = new Date()): { start: string; end: string } {
  const span = manilaDaySpan(days, now)
  const start = new Date(`${span[0]}T00:00:00+08:00`)
  const last = new Date(`${span[span.length - 1]}T00:00:00+08:00`)
  return {
    start: sqlUtc(start),
    end: sqlUtc(new Date(last.getTime() + DAY_MS)),
  }
}

/** SQLite expression that shifts a UTC datetime column to Manila. */
export function manilaSql(column: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(column)) {
    throw new Error('Invalid column')
  }
  return `datetime(${column}, '+${MANILA_OFFSET_HOURS} hours')`
}

/** UTC instant of an event start given Manila `YYYY-MM-DD` and `HH:MM` (or `HH:MM:SS`). Invalid input gives an invalid Date. */
export function manilaEventStart(date: string, time: string): Date {
  const hhmmss = /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time
  return new Date(`${date}T${hhmmss}+08:00`)
}
