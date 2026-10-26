import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTestApp } from '../../test/createTestApp'
import { REQUIRED_ENV_KEYS } from '../env'

const owner = {
  id: 'user-1',
  email: 'ada@student.apc.edu.ph',
  name: 'Ada',
  role: 'user',
}

const ORIGIN = 'https://eypi.cc'
const API_KEY = 'test-safe-browsing-key'
const ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find'

function post(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'CF-Connecting-IP': '203.0.113.10',
    },
    body: JSON.stringify(body),
  }
}

function patch(body: unknown): RequestInit {
  return {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      'CF-Connecting-IP': '203.0.113.10',
    },
    body: JSON.stringify(body),
  }
}

async function withOwner(apiKey?: string) {
  return createTestApp({
    user: owner,
    env: apiKey === undefined ? {} : { SAFE_BROWSING_API_KEY: apiKey },
    seed: async (client) => {
      await client.execute({
        sql: 'INSERT INTO users (id, email, name, role) VALUES (?, ?, ?, ?)',
        args: [owner.id, owner.email, owner.name, owner.role],
      })
    },
  })
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type FetchCall = { url: string; method: string; body: string }

function threatUrl(body: string): string {
  const parsed = JSON.parse(body) as { threatInfo?: { threatEntries?: { url?: string }[] } }
  return parsed.threatInfo?.threatEntries?.[0]?.url ?? ''
}

const calls: FetchCall[] = []

function stubFetch(
  respond: (call: FetchCall, init: RequestInit | undefined) => Promise<Response> | Response,
) {
  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const call = {
      url: String(input),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : '',
    }
    calls.push(call)
    return respond(call, init)
  })
}

function loggedLines(): string[] {
  return vi.mocked(console.error).mock.calls.map((call) => String(call[0]))
}

afterEach(() => {
  calls.length = 0
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Safe Browsing on link writes', () => {
  it('returns 422 unsafe_destination when create matches a threat', async () => {
    stubFetch(() => jsonResponse({
      matches: [{ threatType: 'SOCIAL_ENGINEERING', threat: { url: 'https://phish.example/login' } }],
    }))
    const { request, client } = await withOwner(API_KEY)

    const res = await request('/api/links', post({ url: 'https://phish.example/login', slug: 'phish' }))

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: {
        code: 'unsafe_destination',
        message: 'That destination is unsafe.',
        fields: { url: 'That destination is unsafe.' },
      },
    })
    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')
    expect(Number(rows.rows[0].n)).toBe(0)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.url).toBe(`${ENDPOINT}?key=${API_KEY}`)
    expect(threatUrl(calls[0]?.body ?? '')).toBe('https://phish.example/login')
  })

  it('creates the link when Safe Browsing reports no match', async () => {
    stubFetch(() => jsonResponse({}))
    const { request, client } = await withOwner(API_KEY)

    const res = await request('/api/links', post({ url: 'https://example.com/ok', slug: 'clean' }))

    expect(res.status).toBe(201)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe(`${ENDPOINT}?key=${API_KEY}`)
    expect(calls[0]?.method).toBe('POST')
    expect(threatUrl(calls[0]?.body ?? '')).toBe('https://example.com/ok')
    const body = JSON.parse(calls[0]?.body ?? '{}') as {
      threatInfo?: { threatTypes?: string[]; threatEntryTypes?: string[] }
    }
    expect(body.threatInfo?.threatTypes).toEqual(expect.arrayContaining([
      'MALWARE',
      'SOCIAL_ENGINEERING',
    ]))
    expect(body.threatInfo?.threatEntryTypes).toEqual(['URL'])
    const rows = await client.execute('SELECT original_url FROM links')
    expect(rows.rows[0]?.original_url).toBe('https://example.com/ok')
  })

  it('allows create when Safe Browsing exceeds 1500 ms and reports the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let abortDelay = -1
    stubFetch((_call, init) => new Promise((resolve, reject) => {
      const started = Date.now()
      const late = setTimeout(() => {
        resolve(jsonResponse({ matches: [{ threatType: 'MALWARE' }] }))
      }, 5000)
      init?.signal?.addEventListener('abort', () => {
        abortDelay = Date.now() - started
        clearTimeout(late)
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      }, { once: true })
    }))
    const { request, client } = await withOwner(API_KEY)

    const res = await request('/api/links', post({ url: 'https://example.com/slow', slug: 'slow' }))

    expect(res.status).toBe(201)
    expect(abortDelay).toBeGreaterThanOrEqual(1500)
    expect(abortDelay).toBeLessThan(3500)
    const lines = loggedLines()
    expect(lines.some((line) => line.includes('safe_browsing_unavailable'))).toBe(true)
    expect(lines.join('\n')).not.toContain(API_KEY)
    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')
    expect(Number(rows.rows[0].n)).toBe(1)
  }, 8000)

  it('allows create when Safe Browsing returns an API error and reports it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(() => new Response('unavailable', { status: 503 }))
    const { request, client } = await withOwner(API_KEY)

    const res = await request('/api/links', post({ url: 'https://example.com/err', slug: 'err' }))

    expect(res.status).toBe(201)
    const lines = loggedLines()
    expect(lines.some((line) => line.includes('safe_browsing_unavailable'))).toBe(true)
    expect(lines.join('\n')).not.toContain(API_KEY)
    const rows = await client.execute('SELECT COUNT(*) AS n FROM links')
    expect(Number(rows.rows[0].n)).toBe(1)
  })

  it('skips the lookup when the key is unset or blank', async () => {
    stubFetch(() => jsonResponse({ matches: [{ threatType: 'MALWARE' }] }))
    const unset = await withOwner()
    const blank = await withOwner('   ')

    const unsetRes = await unset.request('/api/links', post({ url: 'https://example.com/unset', slug: 'unset' }))
    const blankRes = await blank.request('/api/links', post({ url: 'https://example.com/blank', slug: 'blank' }))

    expect(unsetRes.status).toBe(201)
    expect(blankRes.status).toBe(201)
    expect(calls).toHaveLength(0)
  })

  it('does not call Safe Browsing for a destination that already failed local checks', async () => {
    stubFetch(() => jsonResponse({}))
    const { request } = await withOwner(API_KEY)

    const res = await request('/api/links', post({ url: 'https://eypi.cc/x' }))

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: { code: 'self_link' } })
    expect(calls).toHaveLength(0)
  })

  it('returns 422 unsafe_destination when an edit matches a threat and keeps the old url', async () => {
    stubFetch((call) => {
      const url = threatUrl(call.body)
      if (url.includes('phish.example')) {
        return jsonResponse({ matches: [{ threatType: 'MALWARE' }] })
      }
      return jsonResponse({})
    })
    const { request, client } = await withOwner(API_KEY)
    const created = await request('/api/links', post({ url: 'https://example.com/ok', slug: 'edit-me' }))
    expect(created.status).toBe(201)
    const { id } = await created.json() as { id: string }

    const res = await request(`/api/links/${id}`, patch({ url: 'https://phish.example/login' }))

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ error: { code: 'unsafe_destination' } })
    const rows = await client.execute({
      sql: 'SELECT original_url FROM links WHERE id = ?',
      args: [id],
    })
    expect(rows.rows[0]?.original_url).toBe('https://example.com/ok')
    expect(calls.map((call) => threatUrl(call.body))).toEqual([
      'https://example.com/ok',
      'https://phish.example/login',
    ])
  })

  it('saves an edited destination when Safe Browsing reports no match', async () => {
    stubFetch(() => jsonResponse({}))
    const { request, client } = await withOwner(API_KEY)
    const created = await request('/api/links', post({ url: 'https://example.com/ok', slug: 'edit-ok' }))
    const { id } = await created.json() as { id: string }

    const res = await request(`/api/links/${id}`, patch({ url: 'https://example.com/next' }))

    expect(res.status).toBe(200)
    const rows = await client.execute({
      sql: 'SELECT original_url FROM links WHERE id = ?',
      args: [id],
    })
    expect(rows.rows[0]?.original_url).toBe('https://example.com/next')
    expect(calls.map((call) => threatUrl(call.body))).toEqual([
      'https://example.com/ok',
      'https://example.com/next',
    ])
  })

  it('allows an edit when Safe Browsing times out and reports the error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let mode: 'clean' | 'timeout' = 'clean'
    let abortDelay = -1
    stubFetch((_call, init) => {
      if (mode === 'clean') return jsonResponse({})
      return new Promise((resolve, reject) => {
        const started = Date.now()
        const late = setTimeout(() => {
          resolve(jsonResponse({ matches: [{ threatType: 'MALWARE' }] }))
        }, 5000)
        init?.signal?.addEventListener('abort', () => {
          abortDelay = Date.now() - started
          clearTimeout(late)
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        }, { once: true })
      })
    })
    const { request, client } = await withOwner(API_KEY)
    const created = await request('/api/links', post({ url: 'https://example.com/ok', slug: 'edit-slow' }))
    const { id } = await created.json() as { id: string }
    mode = 'timeout'

    const res = await request(`/api/links/${id}`, patch({ url: 'https://example.com/later' }))

    expect(res.status).toBe(200)
    expect(abortDelay).toBeGreaterThanOrEqual(1500)
    expect(abortDelay).toBeLessThan(3500)
    expect(loggedLines().some((line) => line.includes('safe_browsing_unavailable'))).toBe(true)
    expect(loggedLines().join('\n')).not.toContain(API_KEY)
    const rows = await client.execute({
      sql: 'SELECT original_url FROM links WHERE id = ?',
      args: [id],
    })
    expect(rows.rows[0]?.original_url).toBe('https://example.com/later')
  }, 8000)

  it('does not call Safe Browsing when an edit leaves the destination unchanged', async () => {
    stubFetch(() => jsonResponse({}))
    const { request, env } = await withOwner(API_KEY)
    const created = await request('/api/links', post({ url: 'https://example.com/ok', slug: 'stay' }))
    const body = await created.json() as { id: string; slug: string }
    calls.length = 0

    const disabled = await request(`/api/links/${body.id}`, patch({ disabled: true }))

    expect(disabled.status).toBe(200)
    expect(calls).toHaveLength(0)
    expect(await env.LINKS_KV.get(body.slug)).toBeNull()
  })

  it('does not require SAFE_BROWSING_API_KEY for /api/health', async () => {
    expect(REQUIRED_ENV_KEYS).not.toContain('SAFE_BROWSING_API_KEY')
    const { request } = await createTestApp()

    const res = await request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, db: true })
  })
})
