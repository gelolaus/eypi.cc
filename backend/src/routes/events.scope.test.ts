import { describe, expect, it, vi } from 'vitest'
import { sessionCookieName } from '../lib/auth/session'
import { createTestApp } from '../test/createTestApp'

describe('events session middleware scope', () => {
  it('does not touch the session store for public non-events routes', async () => {
    const { request, client, env } = await createTestApp()
    await client.execute('DROP TABLE sessions')
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cookie = `${sessionCookieName(env)}=any-session-token`

    try {
      const stats = await request('/api/stats', { headers: { Cookie: cookie } })
      expect(stats.status).toBe(200)

      const events = await request('/api/events', { headers: { Cookie: cookie } })
      expect(events.status).toBe(503)
    } finally {
      errorLog.mockRestore()
    }
  })
})
