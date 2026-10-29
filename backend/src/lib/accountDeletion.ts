import { LibsqlBatchError, type Client } from '@libsql/client/web'
import type { Bindings } from './db'
import { manilaDay } from './manilaTime'
import { promoteWaitlistStatement } from './tix/registration'

export const OWNS_ORG_MESSAGE = 'Transfer ownership before deleting your account.'

export class LastAdminDeletionError extends Error {
  constructor() {
    super('Keep at least one active admin.')
    this.name = 'LastAdminDeletionError'
  }
}

// Selects the target's own row back into `users` only when it is the last active admin.
// That duplicates the primary key, so the statement fails and rolls its batch back; for
// anyone else it selects no rows and does nothing. An INSERT trigger on `users` would
// fire for the last admin, so keep such triggers abort-only.
const LAST_ADMIN_GUARD_SQL =`INSERT INTO users (id, email, name, role)
  SELECT target.id, target.email, target.name, target.role
  FROM users AS target
  WHERE target.id = ?
    AND target.role = 'admin'
    AND COALESCE(target.disabled_at, '') = ''
    AND NOT EXISTS (
      SELECT 1 FROM users AS other
      WHERE other.role = 'admin'
        AND COALESCE(other.disabled_at, '') = ''
        AND other.id != target.id
    )`

function lastAdminGuard(userId: string): Statement {
  return { sql: LAST_ADMIN_GUARD_SQL, args: [userId] }
}

/** Aborts when `userId` is the last active admin. A no-op for everyone else. */
export async function assertRemainingAdmin(client: Client, userId: string): Promise<void> {
  try {
    await client.batch([lastAdminGuard(userId)], 'write')
  } catch (err) {
    if (isLastAdminGuardFailure(err)) throw new LastAdminDeletionError()
    throw err
  }
}

type Statement = { sql: string; args: (string | null)[] }

export type OwnedOrg = { id: string; name: string }

function text(value: unknown): string {
  return value == null ? '' : String(value)
}

export function qrLogoKey(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const parsed = JSON.parse(raw) as { logo?: unknown }
    const logo = parsed.logo
    const key = typeof logo === 'string'
      ? logo
      : logo && typeof logo === 'object' && 'key' in logo
        ? (logo as { key?: unknown }).key
        : null
    if (typeof key !== 'string') return null
    if (!key.startsWith('qr-logos/') || key.includes('..') || key.includes('\\')) return null
    return key
  } catch {
    return null
  }
}

function replaceAccountEmail(meta: string, email: string): string {
  if (!email) return meta
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Match whole addresses only: `ana.santos@…` must never rewrite
  // `joana.santos@…` in a third party's audit row. A trailing dot is allowed
  // when it ends a sentence, but not when it continues a domain.
  const pattern = new RegExp(
    `(^|[^A-Za-z0-9._%+-])${escaped}(?![A-Za-z0-9_%+-])(?!\\.[A-Za-z0-9])`,
    'gi',
  )
  return meta.replace(pattern, (_match: string, prefix: string) => `${prefix}deleted-user`)
}

/** Organizations this user still owns. Deletion is refused while any remain. */
export async function organizationsOwnedBy(
  client: Client,
  userId: string,
): Promise<OwnedOrg[]> {
  const owned = await client.execute({
    sql: 'SELECT id, name FROM organizations WHERE owner_id = ? ORDER BY name, id',
    args: [userId],
  })
  return owned.rows.map((row) => ({ id: text(row.id), name: text(row.name) }))
}

/**
 * Removes everything that belongs to the user, reassigning rows that still
 * belong to another org first. Returns QR logo object keys to delete from R2.
 */
export async function deleteAccount(
  client: Client,
  env: Pick<Bindings, 'LINKS_KV'>,
  userId: string,
  email: string,
  options?: { guardLastAdmin?: boolean },
): Promise<string[]> {
  const today = manilaDay(new Date())
  const [logos, audits, freedSeats] = await Promise.all([
    client.execute({
      sql: 'SELECT slug, qr_config FROM links WHERE user_id = ?',
      args: [userId],
    }),
    client.execute({
      sql: `SELECT id, meta FROM audit_events
            WHERE meta IS NOT NULL AND instr(lower(meta), ?) > 0`,
      args: [email],
    }),
    // Events where a confirmed future self-registration without check-ins is about to be deleted. Events the
    // user leads are deleted below, so they need no promotion.
    client.execute({
      sql: `SELECT DISTINCT e.id, e.max_attendees
            FROM attendees a
            JOIN events e ON e.id = a.event_id
            WHERE a.user_id = ? AND a.source = 'self' AND a.status = 'confirmed'
              AND e.event_date >= ? AND e.lead_user_id != ?
              AND NOT EXISTS (SELECT 1 FROM check_ins c WHERE c.attendee_id = a.id)`,
      args: [userId, today, userId],
    }),
  ])
  const logoKeys = [...new Set(logos.rows.map((row) => qrLogoKey(row.qr_config)).filter((key): key is string => key != null))]

  const slugs = [...new Set(logos.rows.map((row) => text(row.slug)).filter((slug) => slug.length > 0))]

  const ledByUser ='lead_user_id = ?'
  const eventIds = `SELECT id FROM events WHERE ${ledByUser}`
  const createdByUser = 'creator_id = ?'
  const campaignIds = `SELECT id FROM dp_campaigns WHERE ${createdByUser}`
  const statements: Statement[] = [
    {
      sql: `UPDATE events
            SET lead_user_id = (SELECT o.owner_id FROM organizations o WHERE o.id = events.org_id)
            WHERE lead_user_id = ?
              AND EXISTS (
                SELECT 1 FROM organizations o
                WHERE o.id = events.org_id AND o.owner_id != ?
              )`,
      args: [userId, userId],
    },
    {
      sql: `UPDATE dp_campaigns
            SET creator_id = (SELECT o.owner_id FROM organizations o WHERE o.id = dp_campaigns.org_id)
            WHERE creator_id = ?
              AND EXISTS (
                SELECT 1 FROM organizations o
                WHERE o.id = dp_campaigns.org_id AND o.owner_id != ?
              )`,
      args: [userId, userId],
    },
    {
      sql: `DELETE FROM check_ins
            WHERE event_id IN (${eventIds})
               OR attendee_id IN (SELECT id FROM attendees WHERE event_id IN (${eventIds}))`,
      args: [userId, userId],
    },
    { sql: `DELETE FROM attendees WHERE event_id IN (${eventIds})`, args: [userId] },
    { sql: `DELETE FROM event_clusters WHERE event_id IN (${eventIds})`, args: [userId] },
    { sql: `DELETE FROM event_column_mappings WHERE event_id IN (${eventIds})`, args: [userId] },
    { sql: `DELETE FROM event_csv_rows WHERE event_id IN (${eventIds})`, args: [userId] },
    { sql: `DELETE FROM events WHERE ${ledByUser}`, args: [userId] },
    {
      sql: `DELETE FROM attendees
            WHERE user_id = ? AND source = 'self'
              AND event_id IN (SELECT id FROM events WHERE event_date >= ?)
              AND NOT EXISTS (SELECT 1 FROM check_ins c WHERE c.attendee_id = attendees.id)`,
      args: [userId, today],
    },
    ...freedSeats.rows.map((row) => promoteWaitlistStatement(
      text(row.id),
      row.max_attendees == null ? null : Number(row.max_attendees),
    ) as Statement),
    // Past or checked-in registrations stay as the org's attendance record, unlinked from the account and
    // stripped of personal details. The email is unique per event, so each row gets its own placeholder.
    {
      sql: `UPDATE attendees
            SET user_id = NULL,
                first_name = 'Deleted user',
                last_name = NULL,
                email = 'deleted-' || id || '@deleted.invalid',
                answers = '{}',
                guest_token_hash = NULL
            WHERE user_id = ?`,
      args: [userId],
    },
    { sql: `DELETE FROM dp_frames WHERE campaign_id IN (${campaignIds})`, args: [userId] },
    { sql: `DELETE FROM dp_slug_history WHERE campaign_id IN (${campaignIds})`, args: [userId] },
    { sql: `DELETE FROM dp_campaigns WHERE ${createdByUser}`, args: [userId] },
    { sql: 'DELETE FROM org_members WHERE user_id = ? OR lower(email) = ?', args: [userId, email] },
    { sql: 'DELETE FROM links WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM sessions WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM user_identities WHERE user_id = ?', args: [userId] },
    { sql: 'DELETE FROM legal_consents WHERE user_id = ?', args: [userId] },
  ]

  for (const row of audits.rows) {
    const meta = text(row.meta)
    const next = replaceAccountEmail(meta, email)
    if (next !== meta) statements.push({ sql: 'UPDATE audit_events SET meta = ? WHERE id = ?', args: [next, text(row.id)] })
  }
  statements.push({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] })
  if (options?.guardLastAdmin) statements.unshift(lastAdminGuard(userId))
  try {
    await client.batch(statements, 'write')
  } catch (err) {
    if (options?.guardLastAdmin && isLastAdminGuardFailure(err)) throw new LastAdminDeletionError()
    throw err
  }
  await deleteEdgeKeys(env.LINKS_KV, slugs)
  return logoKeys
}

function isLastAdminGuardFailure(err: unknown): boolean {
  if (!(err instanceof LibsqlBatchError) || err.statementIndex !== 0) return false
  return err.code.includes('CONSTRAINT') || err.message.includes('UNIQUE')
}

/** Best-effort: a KV failure is logged without identifiers and never aborts deletion. */
async function deleteEdgeKeys(kv: KVNamespace, slugs: string[]): Promise<void> {
  for (const slug of slugs) {
    try {
      await kv.delete(slug)
    } catch {
      console.error(JSON.stringify({
        level: 'error',
        route: 'account-deletion',
        code: 'edge_delete_failed',
        message: 'Could not remove an edge key for a deleted account.',
      }))
    }
  }
}
