import { createClient } from '@libsql/client'
import { describe, expect, it } from 'vitest'
import { applyMigrations, migrationsDir } from '../../test/createTestApp'
import { readdirSync } from 'node:fs'

const BEFORE = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql') && name < '0011')
  .sort()

describe('migration 0011_tix_registration', () => {
  async function migrated() {
    const client = createClient({ url: ':memory:' })
    await applyMigrations(client, BEFORE)
    await client.executeMultiple(`
      INSERT INTO users (id, email, name) VALUES ('u1', 'lead@student.apc.edu.ph', 'Lead');
      INSERT INTO users (id, email, name) VALUES ('u2', 'stud@student.apc.edu.ph', 'Stud');
      INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location)
        VALUES ('e1', 'ev-one', 'u1', 'One', '2026-11-01', '09:00', 'Hall');
      INSERT INTO attendees (id, event_id, first_name, email, qr_token)
        VALUES ('a1', 'e1', 'Kept', 'kept@x.test', 'qr-1');
      INSERT INTO attendees (id, event_id, first_name, email, qr_token)
        VALUES ('a2', 'e1', 'Gone', 'gone@x.test', 'qr-2');
      INSERT INTO attendees (id, event_id, first_name, email, qr_token)
        VALUES ('a3', 'e1', 'Back', 'back@x.test', 'qr-3');
      INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at)
        VALUES ('c1', 'a2', 'e1', 'checked_in', '2026-11-01 08:00:00');
      INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at)
        VALUES ('c2', 'a2', 'e1', 'removed', '2026-11-01 09:00:00');
      INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at)
        VALUES ('c3', 'a3', 'e1', 'removed', '2026-11-01 08:00:00');
      INSERT INTO check_ins (id, attendee_id, event_id, action, actioned_at)
        VALUES ('c4', 'a3', 'e1', 'checked_in', '2026-11-01 09:00:00');
    `)
    await applyMigrations(client, ['0011_tix_registration.sql'])
    return client
  }

  it('applies defaults to existing rows', async () => {
    const client = await migrated()
    const ev = (await client.execute(`SELECT * FROM events WHERE id = 'e1'`)).rows[0]
    expect(ev.status).toBe('published')
    expect(ev.admission_mode).toBe('import')
    expect(ev.visibility).toBe('public')
    expect(ev.questions).toBe('[]')
    expect(ev.waitlist_enabled).toBe(0)
    for (const col of ['description', 'cover_key', 'cover_meta', 'end_time', 'registration_opens_at', 'registration_closes_at', 'lottery_drawn_at']) {
      expect(ev[col]).toBeNull()
    }
    const at = (await client.execute(`SELECT * FROM attendees WHERE id = 'a1'`)).rows[0]
    expect(at.status).toBe('confirmed')
    expect(at.source).toBe('import')
    expect(at.answers).toBe('{}')
    expect(at.user_id).toBeNull()
    expect(at.decided_at).toBeNull()
    expect(at.decided_by).toBeNull()
    expect(at.guest_token_hash).toBeNull()
    expect(at.registered_at).not.toBeNull()
    const u = (await client.execute(`SELECT tickets_seen_at FROM users WHERE id = 'u1'`)).rows[0]
    expect(u.tickets_seen_at).toBeNull()
  })

  it('cancels only attendees whose latest check-in is removed', async () => {
    const client = await migrated()
    const rows = (await client.execute(`SELECT id, status FROM attendees ORDER BY id`)).rows
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      ['a1', 'confirmed'],
      ['a2', 'cancelled'],
      ['a3', 'confirmed'],
    ])
  })

  it('keeps published events listed and retires the legacy removed action', async () => {
    const client = await migrated()
    const ev = (await client.execute(`SELECT visibility FROM events WHERE id = 'e1'`)).rows[0]
    expect(ev.visibility).toBe('public')
    const removed = await client.execute(`SELECT COUNT(*) AS n FROM check_ins WHERE action = 'removed'`)
    expect(Number(removed.rows[0].n)).toBe(0)
    const latest = (aid: string) =>
      client.execute({ sql: `SELECT action FROM check_ins WHERE attendee_id = ? ORDER BY actioned_at DESC, rowid DESC LIMIT 1`, args: [aid] })
    expect((await latest('a2')).rows[0].action).toBe('checked_out')
    // restoring the cancelled attendee leaves a latest action that is not checked_in
    await client.execute(`UPDATE attendees SET status = 'confirmed' WHERE id = 'a2'`)
    expect((await latest('a2')).rows[0].action).not.toBe('checked_in')
    const st = (await client.execute(`SELECT status FROM attendees WHERE id = 'a2'`)).rows[0]
    expect(st.status).toBe('confirmed')
  })

  it('backfills registered_at for every existing attendee', async () => {
    const client = await migrated()
    const nulls = await client.execute(`SELECT COUNT(*) AS n FROM attendees WHERE registered_at IS NULL`)
    expect(Number(nulls.rows[0].n)).toBe(0)
  })

  it('enforces one registration per user and event but allows many NULL users', async () => {
    const client = await migrated()
    const insert = (id: string, userId: string | null) =>
      client.execute({
        sql: `INSERT INTO attendees (id, event_id, first_name, email, qr_token, user_id)
              VALUES (?, 'e1', 'X', ?, ?, ?)`,
        args: [id, `${id}@x.test`, `qr-${id}`, userId],
      })
    await insert('n1', null)
    await insert('n2', null)
    await insert('s1', 'u2')
    await expect(insert('s2', 'u2')).rejects.toThrow()
  })

  it('enforces unique guest_token_hash and sets user_id null when the user is deleted', async () => {
    const client = await migrated()
    await client.execute(`UPDATE attendees SET guest_token_hash = 'h' WHERE id = 'a1'`)
    await expect(client.execute(`UPDATE attendees SET guest_token_hash = 'h' WHERE id = 'a3'`)).rejects.toThrow()
    await client.execute(`PRAGMA foreign_keys = ON`)
    await client.execute(`UPDATE attendees SET user_id = 'u2' WHERE id = 'a3'`)
    await client.execute(`DELETE FROM users WHERE id = 'u2'`)
    const row = (await client.execute(`SELECT user_id FROM attendees WHERE id = 'a3'`)).rows[0]
    expect(row.user_id).toBeNull()
  })

  it('creates the listed indexes', async () => {
    const client = await migrated()
    const names = (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'index'`)).rows.map((r) => String(r.name))
    expect(names).toEqual(expect.arrayContaining([
      'idx_attendees_event_user',
      'idx_attendees_event_status_registered',
      'idx_check_ins_event_attendee_actioned',
      'idx_attendees_email_unlinked',
      'idx_attendees_user',
    ]))
  })
})
