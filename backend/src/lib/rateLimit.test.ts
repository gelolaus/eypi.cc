import { describe, expect, it } from 'vitest'
import { checkRateLimit } from './rateLimit'

function memoryKv() {
  const store = new Map<string, string>()
  const kv = {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
    delete: async (key: string) => {
      store.delete(key)
    },
  }
  return { kv: kv as unknown as KVNamespace, store }
}

describe('checkRateLimit', () => {
  it('keys the counter by bucket and subject and blocks at the limit', async () => {
    const { kv, store } = memoryKv()
    const opts = { bucket: 'create', subject: 'user-1', limit: 2, windowSec: 3600 }

    const first = await checkRateLimit(kv, opts)
    const second = await checkRateLimit(kv, opts)
    const beforeBlock = store.get('rl:create:user-1')
    const third = await checkRateLimit(kv, opts)

    expect(first).toEqual({ ok: true, retryAfter: 0 })
    expect(second.ok).toBe(true)
    expect(third.ok).toBe(false)
    if (!third.ok) {
      expect(third.retryAfter).toBeGreaterThan(0)
      expect(third.retryAfter).toBeLessThanOrEqual(3600)
    }
    expect(store.get('rl:create:user-1')).toBe(beforeBlock)
    expect([...store.keys()]).toEqual(['rl:create:user-1'])
  })

  it('keeps a different subject on its own counter', async () => {
    const { kv } = memoryKv()
    const limit = { limit: 1, windowSec: 60 }
    await checkRateLimit(kv, { bucket: 'create', subject: 'user-1', ...limit })
    const other = await checkRateLimit(kv, { bucket: 'create', subject: 'user-2', ...limit })
    expect(other.ok).toBe(true)
  })

  it('starts a new window when the stored expiry is in the past', async () => {
    const { kv } = memoryKv()
    const now = Math.floor(Date.now() / 1000)
    await kv.put('rl:create:user-1', `9:${now - 5}`)

    const result = await checkRateLimit(kv, {
      bucket: 'create',
      subject: 'user-1',
      limit: 2,
      windowSec: 60,
    })

    expect(result.ok).toBe(true)
    const stored = await kv.get('rl:create:user-1')
    expect(stored?.startsWith('1:')).toBe(true)
  })
})
