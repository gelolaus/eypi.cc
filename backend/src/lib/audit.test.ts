import type { Client as WebClient } from '@libsql/client/web'
import { describe, expect, it } from 'vitest'
import { createTestApp } from '../test/createTestApp'
import { recordAudit } from './audit'

describe('recordAudit', () => {
  it('inserts one audit_events row and nothing else', async () => {
    const { client } = await createTestApp()

    await recordAudit(client as unknown as WebClient, {
      actorUserId: 'ada-id',
      action: 'org.transfer',
      targetType: 'organization',
      targetId: 'org-1',
      meta: { from: 'bea-id' },
    })

    const rows = await client.execute(
      'SELECT actor_user_id, action, target_type, target_id, meta FROM audit_events',
    )
    expect(rows.rows).toHaveLength(1)
    expect(String(rows.rows[0]?.actor_user_id)).toBe('ada-id')
    expect(String(rows.rows[0]?.action)).toBe('org.transfer')
    expect(String(rows.rows[0]?.target_type)).toBe('organization')
    expect(String(rows.rows[0]?.target_id)).toBe('org-1')
    expect(JSON.parse(String(rows.rows[0]?.meta))).toEqual({ from: 'bea-id' })

    const consents = await client.execute('SELECT COUNT(*) AS n FROM legal_consents')
    expect(Number(consents.rows[0]?.n)).toBe(0)
  })
})
