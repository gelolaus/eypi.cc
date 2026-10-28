import type { TicketDto } from '@/lib/tix/tickets'

const MANILA_OFFSET_HOURS = 8
/** An event with no end time is assumed to last two hours. */
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000

function manilaToUtcMs(date: string, time: string): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(date)
  const t = /^(\d{1,2}):(\d{2})/.exec(time)
  if (!d || !t) return Number.NaN
  return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]) - MANILA_OFFSET_HOURS, Number(t[2]))
}

function stamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** RFC 5545 TEXT escaping: backslash first, then comma, semicolon and newlines. */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/[;,]/g, (c) => `\\${c}`).replace(/\r\n|\r|\n/g, '\\n')
}

/** Folds a content line at 75 octets (UTF-8), never inside a character; continuation lines start with a space. */
function fold(line: string): string {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  let limit = 75
  for (const ch of line) {
    const n = encoder.encode(ch).length
    if (size + n > limit) {
      parts.push(current)
      current = ''
      size = 0
      limit = 74 // the leading space counts toward the 75 octets
    }
    current += ch
    size += n
  }
  parts.push(current)
  return parts.join('\r\n ')
}

export function icsFilename(ticket: TicketDto): string {
  return `${ticket.event.slug.replace(/[^a-z0-9-]/gi, '') || 'event'}.ics`
}

/**
 * One VEVENT calendar file, or null when the stored date or time cannot be read.
 * Event times are Asia/Manila (UTC+8, no daylight saving) and written as UTC.
 * A missing, unreadable or not-after-the-start end time means start + 2 hours.
 */
export function buildIcs(ticket: TicketDto, now: Date = new Date()): string | null {
  const { event } = ticket
  const start = manilaToUtcMs(event.eventDate, event.eventTime)
  if (Number.isNaN(start)) return null
  let end = event.endTime ? manilaToUtcMs(event.eventDate, event.endTime) : Number.NaN
  if (Number.isNaN(end) || end <= start) end = start + DEFAULT_DURATION_MS
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Eypi//Tix//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ticket.id}@eypi.cc`,
    `DTSTAMP:${stamp(now.getTime())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(event.name)}`,
    `LOCATION:${escapeText(event.location)}`,
    `DESCRIPTION:${escapeText(`Event details: https://eypi.cc/tix/${event.slug}`)}`,
    `URL:https://eypi.cc/tix/${event.slug}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}
