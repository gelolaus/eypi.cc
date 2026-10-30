function clock(minutes: number): { h: number; m: string; meridiem: 'AM' | 'PM' } {
  const hours = Math.floor(minutes / 60) % 24
  return { h: hours % 12 === 0 ? 12 : hours % 12, m: String(minutes % 60).padStart(2, '0'), meridiem: hours < 12 ? 'AM' : 'PM' }
}

/** `770` to `12:50 PM`. */
export function formatClock(minutes: number): string {
  const { h, m, meridiem } = clock(minutes)
  return `${h}:${m} ${meridiem}`
}

/** `810` to `1:30`: the 12-hour time without AM or PM, for grid labels. */
export function formatClockShort(minutes: number): string {
  const { h, m } = clock(minutes)
  return `${h}:${m}`
}

/** `7:30 to 9:30 AM`, or `11:30 AM to 1:30 PM` when the range crosses noon. */
export function formatRange(start: number, end: number): string {
  const from = clock(start)
  const to = clock(end)
  if (from.meridiem === to.meridiem) return `${from.h}:${from.m} to ${to.h}:${to.m} ${to.meridiem}`
  return `${formatClock(start)} to ${formatClock(end)}`
}
