// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const { apiRaw } = vi.hoisted(() => ({ apiRaw: vi.fn() }))
const push = vi.fn()
const currentRoute = {
  value: {
    name: 'orgs-modify' as string | undefined,
    path: '/orgs/modify/jpcs',
    params: { slug: 'jpcs' as string },
  },
}

vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute,
    push,
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    raw: apiRaw,
  },
}))

import { clearOrgHint, useActiveOrg } from './useActiveOrg'
import { peekQuery, prefetchQuery } from '@/lib/queryCache'
import type { OrgListItem } from '@/types/orgs'

const jpcs: OrgListItem = {
  org_id: 'jpcs',
  org_name: 'JPCS',
  owner_id: 'user-1',
  is_owner: 1,
  logo_url: null,
  created_at: '2026-01-01',
}

const testOrg: OrgListItem = {
  org_id: 'test',
  org_name: 'Test Organization',
  owner_id: 'user-1',
  is_owner: 1,
  logo_url: null,
  created_at: '2026-01-01',
}

function stubLocalStorage() {
  const store: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
  })
  return store
}

describe('useActiveOrg', () => {
  let reloadSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    stubLocalStorage()
    apiRaw.mockReset()
    push.mockReset()
    currentRoute.value = {
      name: 'orgs-modify',
      path: '/orgs/modify/jpcs',
      params: { slug: 'jpcs' },
    }
    reloadSpy = vi.fn()
    vi.stubGlobal('location', { reload: reloadSpy, pathname: '/orgs/modify/jpcs' })

    // Reset shared module state between tests
    const { activeOrg, orgs, orgsLoaded } = useActiveOrg()
    orgs.value = []
    activeOrg.value = null
    orgsLoaded.value = false
    localStorage.removeItem('active_org_id')
    localStorage.removeItem('eypi.hasOrg')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shares activeOrg across separate useActiveOrg() callers', () => {
    const a = useActiveOrg()
    const b = useActiveOrg()

    a.setActiveOrg(testOrg)

    expect(b.activeOrg.value?.org_id).toBe('test')
    expect(localStorage.getItem('active_org_id')).toBe('test')
  })

  it('navigates /orgs/modify when switching org from the nav while on modify', () => {
    const { setActiveOrg, selectOrg } = useActiveOrg()
    setActiveOrg(jpcs)

    selectOrg(testOrg)

    expect(localStorage.getItem('active_org_id')).toBe('test')
    expect(push).toHaveBeenCalledWith({ name: 'orgs-modify', params: { slug: 'test' } })
    expect(reloadSpy).not.toHaveBeenCalled()
  })

  it('reloads on non-modify pages so org-scoped lists refetch', () => {
    currentRoute.value = {
      name: 'events',
      path: '/manage/tix',
      params: { slug: undefined as unknown as string },
    }
    const { setActiveOrg, selectOrg } = useActiveOrg()
    setActiveOrg(jpcs)

    selectOrg(testOrg)

    expect(localStorage.getItem('active_org_id')).toBe('test')
    expect(push).not.toHaveBeenCalled()
    expect(reloadSpy).toHaveBeenCalledOnce()
  })

  it('reports no membership before orgs load when the hint is absent', () => {
    const { hasOrg, orgsLoaded } = useActiveOrg()

    expect(orgsLoaded.value).toBe(false)
    expect(hasOrg.value).toBe(false)
  })

  it('reports membership before orgs load when the hint is 1', () => {
    localStorage.setItem('eypi.hasOrg', '1')

    const { hasOrg } = useActiveOrg()

    expect(hasOrg.value).toBe(true)
  })

  it('stores a membership hint after fetching orgs', async () => {
    apiRaw.mockResolvedValue({
      ok: true,
      json: async () => ({ orgs: [jpcs, testOrg] }),
    })
    const { fetchOrgs, hasOrg, orgsLoaded } = useActiveOrg()

    await fetchOrgs()

    expect(orgsLoaded.value).toBe(true)
    expect(hasOrg.value).toBe(true)
    expect(localStorage.getItem('eypi.hasOrg')).toBe('1')
  })

  it('stores a non-membership hint after fetching an empty org list', async () => {
    localStorage.setItem('eypi.hasOrg', '1')
    apiRaw.mockResolvedValue({
      ok: true,
      json: async () => ({ orgs: [] }),
    })
    const { fetchOrgs, hasOrg, orgsLoaded } = useActiveOrg()

    await fetchOrgs()

    expect(orgsLoaded.value).toBe(true)
    expect(hasOrg.value).toBe(false)
    expect(localStorage.getItem('eypi.hasOrg')).toBe('0')
  })

  it.each([
    ['a rejected request', () => apiRaw.mockRejectedValue(new Error('offline'))],
    ['a non-ok response', () => apiRaw.mockResolvedValue({ ok: false, json: async () => ({}) })],
  ])('leaves membership unloaded and the hint untouched after %s', async (_name, arrangeFailure) => {
    localStorage.setItem('eypi.hasOrg', '1')
    arrangeFailure()
    const { fetchOrgs, hasOrg, orgsLoaded } = useActiveOrg()

    await fetchOrgs()

    expect(orgsLoaded.value).toBe(false)
    expect(hasOrg.value).toBe(true)
    expect(localStorage.getItem('eypi.hasOrg')).toBe('1')
  })

  it('does not throw when localStorage access fails', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('storage unavailable') },
      setItem: () => { throw new Error('storage unavailable') },
      removeItem: () => { throw new Error('storage unavailable') },
    })
    apiRaw.mockResolvedValue({
      ok: true,
      json: async () => ({ orgs: [jpcs] }),
    })
    const { fetchOrgs, hasOrg } = useActiveOrg()

    expect(() => hasOrg.value).not.toThrow()
    await expect(fetchOrgs()).resolves.toBeUndefined()
    expect(() => clearOrgHint()).not.toThrow()
  })

  it('clears the stored membership hint', () => {
    localStorage.setItem('eypi.hasOrg', '1')

    clearOrgHint()

    expect(localStorage.getItem('eypi.hasOrg')).toBeNull()
  })
})

describe('query cache on org switch', () => {
  it('drops cached reads when the active org changes', async () => {
    const { setActiveOrg } = useActiveOrg()
    setActiveOrg(jpcs)
    await prefetchQuery('events:list:jpcs', async () => ({ events: [{ id: 'e1' }] }))
    expect(peekQuery('events:list:jpcs')).toBeDefined()
    setActiveOrg(testOrg)
    expect(peekQuery('events:list:jpcs')).toBeUndefined()
  })
})
