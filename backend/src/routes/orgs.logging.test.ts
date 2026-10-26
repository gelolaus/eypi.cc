import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestApp } from '../test/createTestApp'

describe('orgs error logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('logs handler failures through the scrubbing reporter, not as raw errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client, request } = await createTestApp()
    await client.execute('PRAGMA foreign_keys = OFF')
    await client.execute('DROP TABLE organizations')

    const res = await request('/api/orgs/public')

    expect(res.status).toBe(500)
    expect(spy).toHaveBeenCalledTimes(1)
    const args = spy.mock.calls[0] ?? []
    expect(args).toHaveLength(1)
    expect(typeof args[0]).toBe('string')
    const line = JSON.parse(String(args[0])) as Record<string, unknown>
    expect(line).toMatchObject({ level: 'error', route: '/api/orgs/public' })
    expect(String(args[0])).not.toContain('no such table')
  })
})
