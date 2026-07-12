import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => ({
    authHeaders: () => ({ 'Content-Type': 'application/json' }),
  }),
}))

import { useActiveOrg } from './useActiveOrg'
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
    push.mockReset()
    currentRoute.value = {
      name: 'orgs-modify',
      path: '/orgs/modify/jpcs',
      params: { slug: 'jpcs' },
    }
    reloadSpy = vi.fn()
    vi.stubGlobal('location', { reload: reloadSpy, pathname: '/orgs/modify/jpcs' })

    // Reset shared module state between tests
    const { activeOrg, orgs } = useActiveOrg()
    orgs.value = []
    activeOrg.value = null
    localStorage.removeItem('active_org_id')
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
})
