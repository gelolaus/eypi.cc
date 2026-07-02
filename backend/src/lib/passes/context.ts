import { verify } from 'hono/jwt'
import type { Client } from '@libsql/client/web'
import type { Bindings } from '../db'

export const PASS_TOKEN_TTL_SEC = 900

export type PassTokenPayload = {
  typ: 'pass'
  sub: string
  eventId: string
  slug: string
  exp: number
}

export type PassContext = {
  event: {
    id: string
    slug: string
    name: string
    eventDate: string
    eventTime: string
    location: string
  }
  attendee: {
    id: string
    firstName: string
    lastName: string
    email: string
    qrToken: string
    clusterValue: string | null
  }
  customFields: Record<string, string>
}

export type BackField = { label: string; value: string }

export function buildBackFields(customFields: Record<string, string>): BackField[] {
  return Object.entries(customFields)
    .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
    .map(([label, value]) => ({ label, value: value.trim() }))
}

export async function verifyPassToken(
  env: Bindings,
  token: string,
  slug: string,
): Promise<PassTokenPayload | null> {
  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256') as Partial<PassTokenPayload>
    if (payload.typ !== 'pass' || !payload.sub || !payload.eventId || !payload.slug) return null
    if (payload.slug !== slug) return null
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return payload as PassTokenPayload
  } catch {
    return null
  }
}

async function loadCustomFieldsByEmail(
  client: Client,
  eventId: string,
  attendeeEmail: string,
): Promise<Record<string, string>> {
  try {
    const mappingRes = await client.execute({
      sql: 'SELECT email_col FROM event_column_mappings WHERE event_id = ?',
      args: [eventId],
    })
    const emailCol = mappingRes.rows[0]?.email_col as string | undefined
    if (!emailCol) return {}

    const rowsRes = await client.execute({
      sql: `SELECT raw_data FROM event_csv_rows
            WHERE event_id = ?
            ORDER BY is_selected DESC, row_index ASC`,
      args: [eventId],
    })

    const normalizedEmail = attendeeEmail.trim().toLowerCase()
    for (const row of rowsRes.rows) {
      try {
        const raw = JSON.parse(row.raw_data as string) as Record<string, unknown>
        const rowEmail = String(raw[emailCol] ?? '').trim().toLowerCase()
        if (rowEmail !== normalizedEmail) continue

        const fields: Record<string, string> = {}
        for (const [key, value] of Object.entries(raw)) {
          if (typeof value === 'string' && value.trim() !== '') {
            fields[key] = value.trim()
          }
        }
        return fields
      } catch {
        continue
      }
    }
    return {}
  } catch {
    return {}
  }
}

export async function loadPassContext(
  client: Client,
  slug: string,
  attendeeId: string,
): Promise<PassContext | null> {
  const evRes = await client.execute({
    sql: 'SELECT id, name, event_date, event_time, location FROM events WHERE slug = ?',
    args: [slug],
  })
  if (evRes.rows.length === 0) return null
  const event = evRes.rows[0]

  const aRes = await client.execute({
    sql: `SELECT id, first_name, last_name, email, qr_token, cluster_value FROM attendees
          WHERE id = ? AND event_id = ?`,
    args: [attendeeId, event.id],
  })
  if (aRes.rows.length === 0) return null
  const a = aRes.rows[0]

  const customFields = await loadCustomFieldsByEmail(
    client,
    event.id as string,
    a.email as string,
  )

  return {
    event: {
      id: event.id as string,
      slug,
      name: event.name as string,
      eventDate: event.event_date as string,
      eventTime: event.event_time as string,
      location: event.location as string,
    },
    attendee: {
      id: a.id as string,
      firstName: a.first_name as string,
      lastName: a.last_name as string,
      email: a.email as string,
      qrToken: a.qr_token as string,
      clusterValue: (a.cluster_value as string | null) ?? null,
    },
    customFields,
  }
}
