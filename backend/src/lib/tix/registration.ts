import type { Client, InStatement, Row } from '@libsql/client/web'
import type { AttendeeStatus } from './admission'

/** SQLite expression for "now" with millisecond precision, so ordering and the My tickets badge are stable. */
export const NOW_SQL = "strftime('%Y-%m-%d %H:%M:%f', 'now')"

const NO_LIMIT = Number.MAX_SAFE_INTEGER

export function promoteWaitlistStatement(eventId: string, capacity: number | null): InStatement {
  const cap = capacity ?? NO_LIMIT
  return {
    sql: `UPDATE attendees SET status = 'confirmed', decided_at = ${NOW_SQL}
          WHERE id = (
            SELECT id FROM attendees
            WHERE event_id = ? AND status = 'waitlisted'
            ORDER BY COALESCE(decided_at, registered_at), rowid LIMIT 1
          )
          AND (SELECT COUNT(*) FROM attendees WHERE event_id = ? AND status = 'confirmed') < ?`,
    args: [eventId, eventId, cap],
  }
}

/**
 * Confirms the oldest waitlisted attendee when a seat is free. `preceding` statements (for example the cancel
 * that frees the seat) run in the same batch, so the seat and its promotion change together.
 */
export async function promoteWaitlist(
  client: Client,
  eventId: string,
  capacity: number | null,
  preceding: InStatement[] = [],
): Promise<void> {
  await client.batch([...preceding, promoteWaitlistStatement(eventId, capacity)], 'write')
}

export type EventQuestion = {
  id: string
  label: string
  type: 'text' | 'choice' | 'checkbox'
  options?: string[]
  required?: boolean
}

export type Answers = Record<string, string | string[]>

const MAX_TEXT = 1000
const MAX_CHECKBOX = 20

export function parseQuestions(raw: unknown): EventQuestion[] {
  try {
    const parsed: unknown = JSON.parse(typeof raw === 'string' ? raw : '[]')
    return Array.isArray(parsed) ? (parsed as EventQuestion[]) : []
  } catch {
    return []
  }
}

export type AnswerValidation =
  | { ok: true; answers: Answers }
  | { ok: false; fields: Record<string, string> }

/** Checks submitted answers against the event's questions. Unknown keys are dropped. */
export function validateAnswers(questions: EventQuestion[], input: unknown): AnswerValidation {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {}
  const fields: Record<string, string> = {}
  const answers: Answers = {}

  for (const q of questions) {
    const value = source[q.id]
    const options = Array.isArray(q.options) ? q.options : []
    if (q.type === 'checkbox') {
      const list = Array.isArray(value) ? value : value == null || value === '' ? [] : null
      if (list === null || list.some((v) => typeof v !== 'string')) {
        fields[q.id] = 'Pick from the listed options.'
      } else if (list.length > MAX_CHECKBOX || list.some((v) => !options.includes(v as string))) {
        fields[q.id] = 'Pick from the listed options.'
      } else if (list.length === 0) {
        if (q.required) fields[q.id] = 'Choose at least one option.'
      } else {
        answers[q.id] = [...new Set(list as string[])]
      }
      continue
    }
    if (value != null && typeof value !== 'string') {
      fields[q.id] = 'Enter a text answer.'
      continue
    }
    const text = (value ?? '').trim()
    if (!text) {
      if (q.required) fields[q.id] = 'This question is required.'
      continue
    }
    if (q.type === 'choice') {
      if (!options.includes(text)) fields[q.id] = 'Pick one of the listed options.'
      else answers[q.id] = text
      continue
    }
    if (text.length > MAX_TEXT) fields[q.id] = `Keep this under ${MAX_TEXT} characters.`
    else answers[q.id] = text
  }

  return Object.keys(fields).length > 0 ? { ok: false, fields } : { ok: true, answers }
}

export type TicketDto = {
  id: string
  status: AttendeeStatus
  qrToken: string | null
  waitlistPosition: number | null
  answers: Answers
  event: {
    slug: string
    name: string
    eventDate: string
    eventTime: string
    endTime: string | null
    location: string
    coverUrl: string | null
    coverMeta: unknown
  }
}

export const TICKET_SELECT = `
  SELECT a.id, a.status, a.qr_token, a.answers,
         CASE WHEN a.status = 'waitlisted' THEN (
           SELECT COUNT(*) FROM attendees w
           WHERE w.event_id = a.event_id AND w.status = 'waitlisted'
             AND (w.registered_at < a.registered_at
                  OR (w.registered_at = a.registered_at AND w.rowid <= a.rowid))
         ) END AS waitlist_position,
         e.slug, e.name AS event_name, e.event_date, e.event_time, e.end_time, e.location,
         e.cover_key, e.cover_meta
  FROM attendees a
  JOIN events e ON e.id = a.event_id`

function parseJson(raw: unknown, fallback: unknown): unknown {
  if (typeof raw !== 'string' || !raw) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function ticketFromRow(row: Row): TicketDto {
  const status = String(row.status) as AttendeeStatus
  return {
    id: String(row.id),
    status,
    qrToken: status === 'confirmed' ? String(row.qr_token) : null,
    waitlistPosition: row.waitlist_position == null ? null : Number(row.waitlist_position),
    answers: parseJson(row.answers, {}) as Answers,
    event: {
      slug: String(row.slug),
      name: String(row.event_name),
      eventDate: String(row.event_date),
      eventTime: String(row.event_time),
      endTime: row.end_time == null ? null : String(row.end_time),
      location: String(row.location),
      coverUrl: row.cover_key ? `/media/${String(row.cover_key)}` : null,
      coverMeta: parseJson(row.cover_meta, null),
    },
  }
}

export async function findTicket(client: Client, eventId: string, userId: string): Promise<TicketDto | null> {
  const res = await client.execute({
    sql: `${TICKET_SELECT} WHERE a.event_id = ? AND a.user_id = ?`,
    args: [eventId, userId],
  })
  return res.rows[0] ? ticketFromRow(res.rows[0]) : null
}
