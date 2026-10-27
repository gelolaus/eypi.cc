import type { Client } from '@libsql/client/web'

export const ALREADY_FINALIZED = {
  status: 'error' as const,
  message: 'Event is already finalized.',
  error: { code: 'already_finalized', message: 'Event is already finalized.' },
}

export async function latestCheckInAction(client: Client, attendeeId: string): Promise<string | null> {
  const res = await client.execute({
    sql: `SELECT action FROM check_ins
          WHERE attendee_id = ?
          ORDER BY actioned_at DESC, rowid DESC
          LIMIT 1`,
    args: [attendeeId],
  })
  const action = res.rows[0]?.action
  return typeof action === 'string' ? action : null
}

export const LATEST_ACTION_IS = `(
            SELECT action FROM check_ins
            WHERE attendee_id = ?
            ORDER BY actioned_at DESC, rowid DESC
            LIMIT 1
          )`

export function actionError(code: string, message: string) {
  return { status: 'error' as const, message, error: { code, message } }
}

export function attendeeHasFirstName(attendee: { firstName?: unknown }): boolean {
  return typeof attendee?.firstName === 'string' && attendee.firstName.trim().length > 0
}

export function attendeeLabel(first: unknown, last: unknown): string {
  return `${String(first ?? '')} ${String(last ?? '')}`.replace(/\s+/g, ' ').trim()
}

export async function writeCheckInAction(
  client: Client,
  attendeeId: string,
  eventId: string,
  action: 'checked_in' | 'checked_out' | 'removed' | 'not_checked_in',
  whenSql: string,
  whenArgs: string[] = [],
): Promise<boolean> {
  const result = await client.execute({
    sql: `INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at)
          SELECT ?, ?, ?, ?, strftime('%Y-%m-%d %H:%M:%f', 'now')
          WHERE ${whenSql}`,
    args: [crypto.randomUUID(), attendeeId, eventId, action, ...whenArgs],
  })
  return Number(result.rowsAffected) === 1
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
  const latest = await latestCheckInAction(client, attendeeId)
  if (latest === 'checked_in') {
    return { ok: false, status: 409, body: actionError('already_checked_in', `${name} is already checked in.`) }
  }
  if (latest === 'removed') {
    return { ok: false, status: 403, body: actionError('removed', `${name} has been removed from this event.`) }
  }
  const wrote = await writeCheckInAction(
    client,
    attendeeId,
    eventId,
    'checked_in',
    `COALESCE(${LATEST_ACTION_IS}, 'not_checked_in') NOT IN ('checked_in', 'removed')`,
    [attendeeId],
  )
  if (!wrote) {
    const again = await latestCheckInAction(client, attendeeId)
    if (again === 'removed') {
      return { ok: false, status: 403, body: actionError('removed', `${name} has been removed from this event.`) }
    }
    return { ok: false, status: 409, body: actionError('already_checked_in', `${name} is already checked in.`) }
  }
  return {
    ok: true,
    message: `${name} checked in.`,
    attendee: { id: attendeeId, firstName: String(attendee.first_name ?? ''), lastName: String(attendee.last_name ?? '') },
  }
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
