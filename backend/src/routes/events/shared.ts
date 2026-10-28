import type { Client, InStatement, ResultSet } from '@libsql/client/web'

export const ALREADY_FINALIZED = {
  status: 'error' as const,
  message: 'Event is already finalized.',
  error: { code: 'already_finalized', message: 'Event is already finalized.' },
}

export function actionError(code: string, message: string) {
  return { status: 'error' as const, message, error: { code, message } }
}

/** CSV selection, finalize, raffle and manual guests only exist for CSV import events. */
export const NOT_IMPORT_EVENT = actionError('not_import_event', 'This is only available for CSV import events.')

export function attendeeLabel(first: unknown, last: unknown): string {
  return `${String(first ?? '')} ${String(last ?? '')}`.replace(/\s+/g, ' ').trim()
}

export type DoorAction = 'checked_in' | 'checked_out'
export type DoorFailure = 'already_checked_in' | 'not_checked_in' | 'not_confirmed' | 'cancelled' | 'unknown'
export type DoorOutcome = { ok: true } | { ok: false; code: DoorFailure }

export interface DoorActionInput {
  /** check_ins.id. Replaying the same id is an idempotent success. */
  id: string
  attendeeId: string
  eventId: string
  action: DoorAction
  /** Already normalised with doorTimestamp(). */
  at: string
}

const LATEST_FOR_ATTENDEE = `(SELECT action FROM check_ins WHERE attendee_id = ? ORDER BY actioned_at DESC, rowid DESC LIMIT 1)`

/**
 * Normalise a client timestamp to the stored `YYYY-MM-DD HH:MM:SS.fff` form.
 * Unparseable values, anything more than 5 minutes ahead of the server, and anything
 * older than 7 days fall back to the server clock: a wrong tablet clock must not
 * rewrite history or hide a row at the "latest" end of an attendee's timeline.
 */
export function doorTimestamp(at: unknown, now: number = Date.now()): string {
  let ms = typeof at === 'string' ? Date.parse(at) : Number.NaN
  if (!Number.isFinite(ms) || ms > now + 5 * 60_000 || ms < now - 7 * 86_400_000) ms = now
  return new Date(ms).toISOString().replace('T', ' ').replace('Z', '')
}

/**
 * Two statements that must run back-to-back in one transaction: a conditional
 * INSERT (the whole conflict check and the write are one statement, so concurrent
 * devices cannot both win) and a diagnostic read that explains a no-op.
 * actioned_at is raised to the attendee's newest row so a late-syncing offline
 * action still lands at the latest end of the timeline (ties go to the higher rowid).
 */
export function doorActionStatements(input: DoorActionInput): InStatement[] {
  const { id, attendeeId, eventId, action, at } = input
  const condition = action === 'checked_in'
    ? `COALESCE(${LATEST_FOR_ATTENDEE}, 'not_checked_in') != 'checked_in'`
    : `${LATEST_FOR_ATTENDEE} = 'checked_in'`
  return [
    {
      sql: `INSERT OR IGNORE INTO check_ins (id, attendee_id, event_id, action, actioned_at)
            SELECT ?, a.id, a.event_id, ?,
                   MAX(?, COALESCE((SELECT MAX(actioned_at) FROM check_ins WHERE attendee_id = a.id), ?))
            FROM attendees a
            WHERE a.id = ? AND a.event_id = ? AND a.status = 'confirmed' AND ${condition}`,
      args: [id, action, at, at, attendeeId, eventId, attendeeId],
    },
    {
      sql: `SELECT a.status AS status,
                   ${LATEST_FOR_ATTENDEE} AS latest,
                   EXISTS (SELECT 1 FROM check_ins WHERE id = ? AND attendee_id = a.id AND event_id = a.event_id AND action = ?) AS replay,
                   EXISTS (SELECT 1 FROM check_ins WHERE id = ?) AS id_taken
            FROM attendees a WHERE a.id = ? AND a.event_id = ?`,
      args: [attendeeId, id, action, id, attendeeId, eventId],
    },
  ]
}

export function doorOutcome(inserted: ResultSet, diagnostic: ResultSet, action: DoorAction): DoorOutcome {
  if (Number(inserted.rowsAffected) === 1) return { ok: true }
  const row = diagnostic.rows[0]
  if (!row) return { ok: false, code: 'unknown' }
  if (Number(row.replay) === 1) return { ok: true }
  // The client id already belongs to a different attendee/action: not a replay, so don't mislabel it as a conflict.
  if (Number(row.id_taken) === 1) return { ok: false, code: 'unknown' }
  if (row.status === 'cancelled') return { ok: false, code: 'cancelled' }
  if (row.status !== 'confirmed') return { ok: false, code: 'not_confirmed' }
  if (action === 'checked_in') return { ok: false, code: 'already_checked_in' }
  return { ok: false, code: row.latest === 'checked_in' ? 'unknown' : 'not_checked_in' }
}

/** Single-action core shared by the scanner routes and the offline sync. */
export async function applyDoorAction(
  client: Client,
  eventId: string,
  attendeeId: string,
  action: DoorAction,
  opts: { id?: string; at?: unknown } = {},
): Promise<DoorOutcome> {
  const [inserted, diagnostic] = await client.batch(
    doorActionStatements({
      id: opts.id ?? crypto.randomUUID(),
      attendeeId,
      eventId,
      action,
      at: doorTimestamp(opts.at ?? new Date().toISOString()),
    }),
    'write',
  )
  return doorOutcome(inserted, diagnostic, action)
}

export type CheckInResult =
  | { ok: true; message: string; attendee: { id: string; firstName: string; lastName: string } }
  | { ok: false; status: 403 | 409; body: ReturnType<typeof actionError> }

export async function performCheckIn(
  client: Client,
  eventId: string,
  attendee: { id: unknown; first_name: unknown; last_name: unknown },
): Promise<CheckInResult> {
  const attendeeId = String(attendee.id)
  const name = attendeeLabel(attendee.first_name, attendee.last_name)
  const outcome = await applyDoorAction(client, eventId, attendeeId, 'checked_in')
  if (outcome.ok) {
    return {
      ok: true,
      message: `${name} checked in.`,
      attendee: { id: attendeeId, firstName: String(attendee.first_name ?? ''), lastName: String(attendee.last_name ?? '') },
    }
  }
  if (outcome.code === 'cancelled') {
    return { ok: false, status: 403, body: actionError('removed', `${name} has been removed from this event.`) }
  }
  if (outcome.code === 'not_confirmed') {
    return { ok: false, status: 409, body: actionError('not_confirmed', `${name} is not confirmed for this event.`) }
  }
  return { ok: false, status: 409, body: actionError('already_checked_in', `${name} is already checked in.`) }
}

export type EventLeadRow = {
  id: string
  org_id: string
  selection_locked: number | bigint | null
  max_attendees: number | bigint | null
  status: string
  admission_mode: string
  waitlist_enabled: number | bigint | null
  registration_opens_at: string | null
  registration_closes_at: string | null
  cover_key: string | null
  cover_meta: string | null
}

export async function requireEventLead(client: Client, slug: string, orgId: string | undefined): Promise<{ ok: true, event: EventLeadRow } | { ok: false, status: 403 | 404, message: string }> {
  const evRes = await client.execute({ sql: 'SELECT id, org_id, selection_locked, max_attendees, status, admission_mode, waitlist_enabled, registration_opens_at, registration_closes_at, cover_key, cover_meta FROM events WHERE slug = ?', args: [slug] })
  if (evRes.rows.length === 0) return { ok: false, status: 404, message: 'Event not found.' }
  const event = evRes.rows[0] as unknown as EventLeadRow

  if (!orgId || event.org_id !== orgId) {
    return { ok: false, status: 403, message: 'Forbidden.' }
  }
  return { ok: true, event }
}
