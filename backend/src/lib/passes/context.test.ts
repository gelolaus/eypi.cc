import { describe, it, expect } from 'vitest'
import type { Client } from '@libsql/client'
import type { Client as WebClient } from '@libsql/client/web'
import { sign } from 'hono/jwt'
import { createTestApp } from '../../test/createTestApp'
import { loadPassContext, signPassToken, verifyPassToken } from './context'
import type { Bindings } from '../db'

const JWT_SECRET = 'jwt-secret'
const PASS_TOKEN_SECRET = 'pass-secret'

function env(): Bindings {
  return { JWT_SECRET, PASS_TOKEN_SECRET } as unknown as Bindings
}

function passClaims(slug: string) {
  return {
    typ: 'pass' as const,
    sub: 'attendee-1',
    eventId: 'event-1',
    slug,
    exp: Math.floor(Date.now() / 1000) + 900,
  }
}

describe('verifyPassToken', () => {
  it('rejects a pass token signed with JWT_SECRET', async () => {
    const token = await sign(passClaims('launch'), JWT_SECRET)
    expect(await verifyPassToken(env(), token, 'launch')).toBeNull()
  })

  it('accepts a pass token signed with PASS_TOKEN_SECRET for the matching slug', async () => {
    const token = await signPassToken(env(), { attendeeId: 'attendee-1', eventId: 'event-1', slug: 'launch' })
    const payload = await verifyPassToken(env(), token, 'launch')
    expect(payload).toMatchObject({
      typ: 'pass',
      sub: 'attendee-1',
      eventId: 'event-1',
      slug: 'launch',
    })
  })

  it('rejects a pass token for another slug', async () => {
    const token = await signPassToken(env(), { attendeeId: 'attendee-1', eventId: 'event-1', slug: 'launch' })
    expect(await verifyPassToken(env(), token, 'launch')).not.toBeNull()
    expect(await verifyPassToken(env(), token, 'other')).toBeNull()
  })
})

describe('loadPassContext pass field allowlist', () => {
  it('omits csv columns that are not in pass_fields and reads the attendee csv row', async () => {
    const { client } = await createTestApp({
      seed: async (db) => {
        await seedPassFieldEvent(db)
      },
    })

    const ctx = await loadPassContext(client as unknown as WebClient, 'launch', 'att-ada')

    expect(ctx?.customFields).toEqual({ section: 'New' })
    expect(ctx?.customFields).not.toHaveProperty('phone')
    expect(ctx?.customFields).not.toHaveProperty('email')
  })
})

async function seedPassFieldEvent(client: Client) {
  await client.execute({
    sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
    args: ['user-1', 'lead@student.apc.edu.ph', 'Lead'],
  })
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, pass_fields)
          VALUES ('event-1', 'launch', 'user-1', 'Launch', '2026-11-01', '09:00', 'Hall', ?)`,
    args: ['["section"]'],
  })
  await client.batch([
    {
      sql: 'INSERT INTO event_csv_rows (id, event_id, row_index, raw_data, is_selected) VALUES (?, ?, ?, ?, 1)',
      args: ['row-old', 'event-1', 0, JSON.stringify({ email: 'ada@x.com', section: 'Old', phone: '09170000000' })],
    },
    {
      sql: 'INSERT INTO event_csv_rows (id, event_id, row_index, raw_data, is_selected) VALUES (?, ?, ?, ?, 0)',
      args: ['row-new', 'event-1', 1, JSON.stringify({ email: 'ada@x.com', section: 'New', phone: '09171111111' })],
    },
    {
      sql: `INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, csv_row_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: ['att-ada', 'event-1', 'Ada', 'Lovelace', 'ada@x.com', 'qr-ada', 'row-new'],
    },
  ])
}
