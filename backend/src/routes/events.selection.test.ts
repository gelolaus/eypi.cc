import { describe, expect, it } from 'vitest'
import type { Client } from '@libsql/client'
import { createTestApp, type TestUser } from '../test/createTestApp'

const lead: TestUser = {
  id: 'user-lead',
  email: 'lead@student.apc.edu.ph',
  name: 'Lead',
  role: 'user',
}

async function seedRaffleEvent(client: Client) {
  await client.execute({
    sql: 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)',
    args: [lead.id, lead.email, lead.name],
  })
  await client.execute({
    sql: 'INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)',
    args: ['org-1', 'Alpha', lead.id],
  })
  await client.execute({
    sql: 'INSERT INTO org_members (org_id, email, user_id, activated_at) VALUES (?, ?, ?, ?)',
    args: ['org-1', lead.email, lead.id, '2026-01-01T00:00:00Z'],
  })
  await client.execute({
    sql: `INSERT INTO events (id, slug, lead_user_id, name, event_date, event_time, location, org_id, selection_locked, max_attendees)
          VALUES (?, ?, ?, ?, '2026-11-01', '09:00', 'Hall', ?, 1, 2)`,
    args: ['event-1', 'raffle-night', lead.id, 'Raffle Night', 'org-1'],
  })
  await client.execute({
    sql: `INSERT INTO event_column_mappings (id, event_id, email_col, cluster_col, criteria_cols)
          VALUES (?, ?, 'email', 'cluster', '[]')`,
    args: ['map-1', 'event-1'],
  })
  await client.execute({
    sql: `INSERT INTO event_clusters (id, event_id, cluster_col, value, max_count, filters)
          VALUES (?, ?, 'cluster', 'A', 2, '{}')`,
    args: ['cluster-1', 'event-1'],
  })
  await client.batch([
    {
      sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, cluster_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['att-active', 'event-1', 'Active', 'One', 'active@x.com', 'qr-active', 'A'],
    },
    {
      sql: 'INSERT INTO attendees (id, event_id, first_name, last_name, email, qr_token, cluster_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: ['att-removed', 'event-1', 'Removed', 'Two', 'removed@x.com', 'qr-removed', 'A'],
    },
    {
      sql: `UPDATE attendees SET status = 'cancelled' WHERE id = ?`,
      args: ['att-removed'],
    },
    {
      sql: 'INSERT INTO event_csv_rows (id, event_id, row_index, raw_data, is_selected) VALUES (?, ?, ?, ?, 0)',
      args: ['row-new', 'event-1', 0, JSON.stringify({ email: 'new@x.com', cluster: 'A' })],
    },
  ])
}

describe('re-raffle count', () => {
  it('the server re-raffle count excludes removed attendees consistently with GET clusters', async () => {
    const { request } = await createTestApp({ user: lead, seed: seedRaffleEvent })
    const headers = { 'X-Active-Org-Id': 'org-1' }

    const before = await request('/api/events/raffle-night/clusters', { headers })
    expect(before.status).toBe(200)
    const beforeBody = await before.json() as {
      clusters: { value: string; currentCount: number; remainingSlots: number }[]
    }
    expect(beforeBody.clusters[0]).toMatchObject({ value: 'A', currentCount: 1, remainingSlots: 1 })

    const raffle = await request('/api/events/raffle-night/clusters/A/raffle', {
      method: 'POST',
      headers: { ...headers, Origin: 'https://eypi.cc' },
    })
    expect(raffle.status).toBe(200)
    const raffleBody = await raffle.json() as { attendees: { email: string }[] }
    expect(raffleBody.attendees.map((attendee) => attendee.email)).toEqual(['new@x.com'])

    const after = await request('/api/events/raffle-night/clusters', { headers })
    const afterBody = await after.json() as {
      clusters: { currentCount: number; remainingSlots: number }[]
    }
    expect(afterBody.clusters[0]).toMatchObject({ currentCount: 2, remainingSlots: 0 })
  })
})
