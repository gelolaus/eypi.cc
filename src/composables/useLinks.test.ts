// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { linkBadges, useLinks } from './useLinks'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('@/router', () => ({
  default: {
    push,
    replace: vi.fn(),
    currentRoute: { value: { fullPath: '/links', name: 'links' } },
  },
}))

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

const baseLink = {
  expiresAt: null,
  disabledAt: null,
  disabledReason: null,
  protected: false,
}

describe('linkBadges', () => {
  const now = Date.parse('2026-10-26T00:00:00.000Z')

  it('labels expired, disabled, protected, and moderator-disabled links', () => {
    expect(linkBadges({
      ...baseLink,
      expiresAt: '2020-01-01T00:00:00.000Z',
    }, now)).toEqual(['Expired'])
    expect(linkBadges({
      ...baseLink,
      disabledAt: '2026-01-01T00:00:00.000Z',
      disabledReason: 'owner',
    }, now)).toEqual(['Disabled'])
    expect(linkBadges({
      ...baseLink,
      disabledAt: '2026-01-01T00:00:00.000Z',
      disabledReason: 'admin',
    }, now)).toEqual(['Disabled by moderator'])
    expect(linkBadges({
      ...baseLink,
      disabledAt: '2026-01-01T00:00:00.000Z',
      disabledReason: 'abuse',
    }, now)).toEqual(['Disabled by moderator'])
    expect(linkBadges({ ...baseLink, protected: true }, now)).toEqual(['Protected'])
    expect(linkBadges({
      ...baseLink,
      expiresAt: '2099-01-01T00:00:00.000Z',
    }, now)).toEqual([])
  })
})

describe('useLinks', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    localStorage.clear()
    push.mockReset()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('adds a created link from the returned id when the destination matches an existing link', async () => {
    const existing = {
      id: 'existing',
      slug: 'existing',
      url: 'https://example.com/same',
      clicks: 4,
      createdAt: '2026-10-01T00:00:00.000Z',
      expiresAt: null,
      disabledAt: null,
      disabledReason: null,
      protected: false,
      hasLogo: false,
    }
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(requestUrl(input))
      const method = init?.method ?? 'GET'
      if (method === 'GET' && url.pathname === '/api/links') {
        return json(200, { items: [existing], nextCursor: null })
      }
      if (method === 'POST' && url.pathname === '/api/links') {
        return json(201, {
          ...existing,
          id: 'created-id',
          slug: 'created',
          clicks: 0,
          qrConfig: null,
        })
      }
      throw new Error(`unexpected ${method} ${url}`)
    })

    const links = useLinks()
    await links.load()
    const created = await links.create({ url: 'https://example.com/same' })

    expect(created.id).toBe('created-id')
    expect(links.items.value.map((item) => item.id)).toEqual(['created-id', 'existing'])
  })

  it('shows the 500 link quota message when create is refused', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(requestUrl(input))
      const method = init?.method ?? 'GET'
      if (method === 'POST' && url.pathname === '/api/links') {
        return json(429, { error: { code: 'quota_exceeded', message: 'nope' } })
      }
      throw new Error(`unexpected ${method} ${url}`)
    })

    const links = useLinks()
    links.quotaMessage.value = ''
    await expect(links.create({ url: 'https://example.com/new' })).rejects.toMatchObject({
      code: 'quota_exceeded',
    })
    expect(links.quotaMessage.value).toBe("You've reached 500 links. Delete some to add more.")
  })
})
