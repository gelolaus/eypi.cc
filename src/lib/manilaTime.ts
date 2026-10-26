const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

/** Treat a stored timestamp as UTC unless it already carries a zone. */
function parseStoredUtc(value: string): Date {
  const trimmed = value.trim()
  const dateOnly = DATE_ONLY.exec(trimmed)
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  }
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  return new Date(HAS_ZONE.test(trimmed) ? normalized : `${normalized}Z`)
}

/** The app's date-only rule: `Jul 1, 2026`, pinned to Asia/Manila. */
export function formatManilaDate(value: string): string {
  if (!value) return ''
  const date = parseStoredUtc(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

/** The app's date-time rule: `2026-07-01 01:30`, pinned to Asia/Manila. */
export function formatManilaDateTime(value: string): string {
  if (!value) return ''
  const date = parseStoredUtc(value)
  if (Number.isNaN(date.getTime())) return value
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`
}
