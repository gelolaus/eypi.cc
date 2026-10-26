const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i

export function parseStoredUtc(value: string): Date {
  const trimmed = value.trim()
  const dateOnly = DATE_ONLY.exec(trimmed)
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
  }
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  return new Date(HAS_ZONE.test(trimmed) ? normalized : `${normalized}Z`)
}

export function formatCalendarDate(value: string): string {
  if (!value) return ''
  const [year, month, day] = value.split(/[T ]/)[0].split('-').map(Number)
  if (!year || !month || !day) return ''
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-PH', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatStoredDateTime(value: string): string {
  if (!value) return ''
  const date = parseStoredUtc(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatEventTime(value: string): string {
  if (!value) return ''
  const [hour, minute] = value.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}
