// @vitest-environment happy-dom
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '@/config/api'
import { useSession } from '@/stores/session'
import { useOrgMembership } from '@/composables/useOrgMembership'

const fetchMock = vi.fn()

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ada = {
  id: 'user-1',
  email: 'ada@apc.edu.ph',
  name: 'Ada',
  role: 'user' as const,
  avatarIcon: null,
  avatarColor: null,
}

function meBody(pendingInviteCount: number) {
  return { user: ada, pendingInviteCount }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function filesUnder(dir: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) found.push(...filesUnder(path))
    else found.push(path)
  }
  return found
}

beforeEach(() => {
  localStorage.clear()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useSession().reset()
})

describe('useSession', () => {
  it('deletes the tickets cache when /api/me says nobody is signed in', async () => {
    const del = vi.fn(async () => true)
    vi.stubGlobal('caches', { delete: del })
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'unauthorized' }))
    try {
      await useSession().load()
      expect(del).toHaveBeenCalledWith('eypi-tickets-v1')
    } finally {
      vi.stubGlobal('fetch', fetchMock)
      vi.unstubAllGlobals()
    }
  })

  it('deletes the service worker tickets cache when the session resets', () => {
    const del = vi.fn(async () => true)
    vi.stubGlobal('caches', { delete: del })
    try {
      useSession().reset()
      expect(del).toHaveBeenCalledWith('eypi-tickets-v1')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('dedupes concurrent load() calls', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    }))
    const session = useSession()

    const first = session.load()
    const second = session.load()

    expect(second).toBe(first)
    expect(session.status.value).toBe('loading')

    await first
    await second

    expect(session.status.value).toBe('ready')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('loads the signed-in user from GET /api/me', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      user: {
        id: 'user-1',
        email: 'ada@apc.edu.ph',
        name: 'Ada',
        role: 'admin',
      },
      pendingInviteCount: 0,
      needsConsent: [],
      orgs: [],
    }))

    const session = useSession()
    await session.load()

    expect(session.user.value).toEqual({
      id: 'user-1',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      role: 'admin',
      avatarIcon: null,
      avatarColor: null,
    })
    expect(session.pendingInviteCount.value).toBe(0)
    expect(session.needsConsent.value).toEqual([])
    expect(session.status.value).toBe('ready')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${API_BASE_URL}/api/me`)
    expect(init.method ?? 'GET').toBe('GET')
    expect(init.credentials).toBe('include')
    expect(new Headers(init.headers).get('Authorization')).toBeNull()
  })

  it('keeps a pending invite count from GET /api/me and clears it on logout', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      user: {
        id: 'user-1',
        email: 'ada@apc.edu.ph',
        name: 'Ada',
        role: 'user',
      },
      pendingInviteCount: 2,
      needsConsent: [],
      orgs: [],
    }))

    const session = useSession()
    await session.load()
    expect(session.pendingInviteCount.value).toBe(2)

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await session.logout()

    expect(session.user.value).toBeNull()
    expect(session.pendingInviteCount.value).toBe(0)
    expect(session.needsConsent.value).toEqual([])
  })

  it('keeps ticketUpdates from GET /api/me and clears it on logout', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ...meBody(0), ticketUpdates: 3 }))
    const session = useSession()
    await session.load()
    expect(session.ticketUpdates.value).toBe(3)

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    await session.logout()
    expect(session.ticketUpdates.value).toBe(0)
  })

  it('treats a 401 from /api/me as signed out', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, {
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    }))

    const session = useSession()
    await session.load()

    expect(session.user.value).toBeNull()
    expect(session.needsConsent.value).toEqual([])
    expect(session.status.value).toBe('ready')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/me')
  })

  it('keeps a loaded user when a later /api/me returns 500', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, meBody(2)))
    const session = useSession()
    await session.load()

    fetchMock.mockResolvedValueOnce(jsonResponse(500, {
      error: { code: 'server_error', message: 'Something went wrong.' },
    }))
    await session.reload()

    expect(session.user.value).toEqual(ada)
    expect(session.pendingInviteCount.value).toBe(2)
    expect(session.status.value).toBe('ready')
  })

  it('keeps a loaded user when a later /api/me drops the connection', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, meBody(2)))
    const session = useSession()
    await session.load()

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await session.reload()

    expect(session.user.value).toEqual(ada)
    expect(session.pendingInviteCount.value).toBe(2)
    expect(session.status.value).toBe('ready')
  })

  it('clears a loaded user when a later /api/me returns 401', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, meBody(2)))
    const session = useSession()
    await session.load()

    fetchMock.mockResolvedValueOnce(jsonResponse(401, {
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    }))
    await session.reload()

    expect(session.user.value).toBeNull()
    expect(session.pendingInviteCount.value).toBe(0)
    expect(session.needsConsent.value).toEqual([])
    expect(session.status.value).toBe('ready')
  })

  it('retries load() after a 500 when no user was loaded', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {
      error: { code: 'server_error', message: 'Something went wrong.' },
    }))
    const session = useSession()
    await session.load()

    expect(session.user.value).toBeNull()
    expect(session.status.value).toBe('idle')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockResolvedValueOnce(jsonResponse(200, meBody(1)))
    await session.load()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(session.user.value).toEqual(ada)
    expect(session.pendingInviteCount.value).toBe(1)
    expect(session.status.value).toBe('ready')
  })

  it('issues a new GET /api/me for each overlapping reload()', async () => {
    const session = useSession()
    session.user.value = ada
    session.pendingInviteCount.value = 2
    session.status.value = 'ready'

    const firstResponse = deferred<Response>()
    const secondResponse = deferred<Response>()
    fetchMock
      .mockImplementationOnce(() => firstResponse.promise)
      .mockImplementationOnce(() => secondResponse.promise)

    const firstReload = session.reload()
    const secondReload = session.reload()

    expect(secondReload).not.toBe(firstReload)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    firstResponse.resolve(jsonResponse(200, meBody(1)))
    await firstReload

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(session.pendingInviteCount.value).toBe(1)

    secondResponse.resolve(jsonResponse(200, meBody(0)))
    await secondReload

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(session.user.value).toEqual(ada)
    expect(session.pendingInviteCount.value).toBe(0)
    expect(session.status.value).toBe('ready')
  })

  it('logout posts to /api/auth/logout and clears the active org', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
    localStorage.setItem('active_org_id', 'org-1')
    const session = useSession()
    session.user.value = {
      id: 'user-1',
      email: 'ada@apc.edu.ph',
      name: 'Ada',
      role: 'user',
      avatarIcon: null,
      avatarColor: null,
    }
    session.status.value = 'ready'

    await session.logout()

    expect(session.user.value).toBeNull()
    expect(session.status.value).toBe('idle')
    expect(localStorage.getItem('active_org_id')).toBeNull()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${API_BASE_URL}/api/auth/logout`)
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
  })

  it('logout clears the org membership cache', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/forms')) return jsonResponse(200, { ok: true })
      return new Response(null, { status: 204 })
    })
    const membership = useOrgMembership()
    await expect(membership.checkOrgMembership()).resolves.toBe(true)

    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/api/forms')) {
        return jsonResponse(403, { error: { code: 'no_org', message: 'No org.' } })
      }
      return new Response(null, { status: 204 })
    })

    await useSession().logout()

    await expect(membership.checkOrgMembership()).resolves.toBe(false)
  })

  it('reset clears the signed-in user', () => {
    const session = useSession()
    session.user.value = {
      id: 'user-1',
      email: 'user@student.apc.edu.ph',
      name: 'User',
      role: 'user',
      avatarIcon: null,
      avatarColor: null,
    }
    session.status.value = 'ready'

    session.needsConsent.value = [{ document: 'privacy', version: '2026-11-01' }]

    session.reset()

    expect(session.user.value).toBeNull()
    expect(session.needsConsent.value).toEqual([])
    expect(session.status.value).toBe('idle')
  })

  it('stores needsConsent and drops malformed entries', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      user: ada,
      pendingInviteCount: 0,
      needsConsent: [
        { document: 'privacy', version: '2026-11-01' },
        { document: 'terms', version: '2026-11-01' },
        { document: '', version: '2026-11-01' },
        { version: '2026-11-01' },
        { document: 'privacy' },
        { document: 'terms', version: 1 },
        null,
        'privacy',
      ],
    }))

    const session = useSession()
    await session.load()

    expect(session.needsConsent.value).toEqual([
      { document: 'privacy', version: '2026-11-01' },
      { document: 'terms', version: '2026-11-01' },
    ])
  })

  it('replaces needsConsent from the latest successful /api/me', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      ...meBody(0),
      needsConsent: [{ document: 'privacy', version: '2026-11-01' }],
    }))
    const session = useSession()
    await session.load()
    expect(session.needsConsent.value).toEqual([
      { document: 'privacy', version: '2026-11-01' },
    ])

    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      ...meBody(0),
      needsConsent: [],
    }))
    await session.reload()

    expect(session.user.value).toEqual(ada)
    expect(session.needsConsent.value).toEqual([])
  })

  it('clears needsConsent when a later /api/me fails but keeps the user', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      ...meBody(2),
      needsConsent: [{ document: 'privacy', version: '2026-11-01' }],
    }))
    const session = useSession()
    await session.load()

    fetchMock.mockResolvedValueOnce(jsonResponse(500, {
      error: { code: 'server_error', message: 'Something went wrong.' },
    }))
    await session.reload()

    expect(session.user.value).toEqual(ada)
    expect(session.pendingInviteCount.value).toBe(2)
    expect(session.needsConsent.value).toEqual([])
    expect(session.status.value).toBe('ready')
  })

  it('clears needsConsent when a later /api/me drops the connection', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      ...meBody(1),
      needsConsent: [{ document: 'terms', version: '2026-11-01' }],
    }))
    const session = useSession()
    await session.load()

    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await session.reload()

    expect(session.user.value).toEqual(ada)
    expect(session.needsConsent.value).toEqual([])
    expect(session.status.value).toBe('ready')
  })

  it('clears needsConsent when a signed-in session becomes anonymous', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {
      ...meBody(1),
      needsConsent: [{ document: 'privacy', version: '2026-11-01' }],
    }))
    const session = useSession()
    await session.load()

    fetchMock.mockResolvedValueOnce(jsonResponse(401, {
      error: { code: 'unauthorized', message: 'Sign in to continue.' },
    }))
    await session.reload()

    expect(session.user.value).toBeNull()
    expect(session.needsConsent.value).toEqual([])
    expect(session.status.value).toBe('ready')
  })

  describe('settled', () => {
    it('is false before load() and true after a successful load', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, meBody(0)))
      const session = useSession()
      expect(session.settled.value).toBe(false)
      const task = session.load()
      expect(session.settled.value).toBe(false)
      await task
      expect(session.settled.value).toBe(true)
    })

    it('is true after a 401', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, {
        error: { code: 'unauthorized', message: 'Sign in to continue.' },
      }))
      const session = useSession()
      await session.load()
      expect(session.settled.value).toBe(true)
    })

    it('is true after a 500 with no user, even though status stays idle', async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, { error: { code: 'internal', message: 'Oops' } }))
      const session = useSession()
      await session.load()
      expect(session.status.value).toBe('idle')
      expect(session.user.value).toBeNull()
      expect(session.settled.value).toBe(true)
    })

    it('is true after a dropped connection with no user', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const session = useSession()
      await session.load()
      expect(session.settled.value).toBe(true)
    })

    it('is false again after reset()', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, meBody(0)))
      const session = useSession()
      await session.load()
      session.reset()
      expect(session.settled.value).toBe(false)
    })

    it('leaves state signed out when a load resolves after reset()', async () => {
      const pending = deferred<Response>()
      fetchMock.mockReturnValue(pending.promise)
      const session = useSession()
      const cb = vi.fn()
      const task = session.load()
      session.onReady(cb)
      session.reset()
      pending.resolve(jsonResponse(200, { ...meBody(3), needsConsent: [{ document: 'terms', version: '1' }] }))
      await task
      expect(session.user.value).toBeNull()
      expect(session.status.value).toBe('idle')
      expect(session.pendingInviteCount.value).toBe(0)
      expect(session.needsConsent.value).toEqual([])
      expect(cb).not.toHaveBeenCalled()
    })

    it('clears the tickets cache when a different person signs in on this browser', async () => {
      const del = vi.fn(async () => true)
      vi.stubGlobal('caches', { delete: del })
      try {
        localStorage.setItem('eypi_last_user', 'someone-else')
        fetchMock.mockResolvedValueOnce(jsonResponse(200, meBody(0)))
        await useSession().load()
        expect(del).toHaveBeenCalledWith('eypi-tickets-v1')
        expect(localStorage.getItem('eypi_last_user')).toBe(ada.id)
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('keeps the tickets cache when the same person returns', async () => {
      const del = vi.fn(async () => true)
      vi.stubGlobal('caches', { delete: del })
      try {
        localStorage.setItem('eypi_last_user', ada.id)
        fetchMock.mockResolvedValueOnce(jsonResponse(200, meBody(0)))
        await useSession().load()
        expect(del).not.toHaveBeenCalled()
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('ignores a load that finishes after reset()', async () => {
      const pending = deferred<Response>()
      fetchMock.mockReturnValue(pending.promise)
      const session = useSession()
      const task = session.load()
      session.reset()
      pending.resolve(jsonResponse(200, meBody(0)))
      await task
      expect(session.settled.value).toBe(false)
    })
  })

  it('never reads the legacy local token key', () => {
    const needle = ['eypi', 'token'].join('_')
    const root = join(process.cwd(), 'src')
    const hits = filesUnder(root).filter((file) => {
      if (!/\.(vue|ts|js|css|mjs)$/.test(file)) return false
      return readFileSync(file, 'utf8').includes(needle)
    })

    expect(hits).toEqual([])
  })

  describe('onReady', () => {
    it('runs once when the load resolves', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, meBody(0)))
      const session = useSession()
      const cb = vi.fn()

      session.onReady(cb)
      expect(cb).not.toHaveBeenCalled()
      await session.load()
      expect(cb).toHaveBeenCalledTimes(1)
      await session.reload()
      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('runs immediately when the session is already ready', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, meBody(0)))
      const session = useSession()
      await session.load()
      const cb = vi.fn()

      session.onReady(cb)
      expect(cb).toHaveBeenCalledTimes(1)
    })

    it('waits through a failed load until one succeeds', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { code: 'x', message: 'x' } }))
      fetchMock.mockResolvedValueOnce(jsonResponse(200, meBody(0)))
      const session = useSession()
      const cb = vi.fn()

      session.onReady(cb)
      await session.load()
      expect(cb).not.toHaveBeenCalled()
      await session.load()
      expect(cb).toHaveBeenCalledTimes(1)
    })
  })
})

describe('useSession avatar', () => {
  it('fills the avatar from /api/me when both keys are valid', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: { ...ada, avatarIcon: 'cat', avatarColor: 'blue' } }))
    const session = useSession()
    await session.load()
    expect(session.user.value?.avatarIcon).toBe('cat')
    expect(session.user.value?.avatarColor).toBe('blue')
  })

  it('nulls both when the icon is unknown', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: { ...ada, avatarIcon: 'nope', avatarColor: 'blue' } }))
    const session = useSession()
    await session.load()
    expect(session.user.value?.avatarIcon).toBeNull()
    expect(session.user.value?.avatarColor).toBeNull()
  })

  it('nulls both when only one field is present', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { user: { ...ada, avatarIcon: 'cat' } }))
    const session = useSession()
    await session.load()
    expect(session.user.value?.avatarIcon).toBeNull()
    expect(session.user.value?.avatarColor).toBeNull()
  })

  it('setAvatar updates the user in place and null clears it', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, meBody(0)))
    const session = useSession()
    await session.load()
    session.setAvatar('cat', 'blue')
    expect(session.user.value).toMatchObject({ id: 'user-1', avatarIcon: 'cat', avatarColor: 'blue' })
    session.setAvatar(null, null)
    expect(session.user.value).toMatchObject({ id: 'user-1', avatarIcon: null, avatarColor: null })
  })

  it('setAvatar does nothing when nobody is signed in', () => {
    const session = useSession()
    session.setAvatar('cat', 'blue')
    expect(session.user.value).toBeNull()
  })
})
