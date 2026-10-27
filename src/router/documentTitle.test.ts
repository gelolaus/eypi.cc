// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import router from './index'
import { useSession } from '@/stores/session'

beforeEach(() => {
  useSession().reset()
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    error: { code: 'unauthorized', message: 'Sign in to continue.' },
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })))
})

const pages: Record<string, string> = {
  home: 'Home',
  login: 'Sign in',
  dashboard: 'Dashboard',
  invites: 'Invites',
  links: 'Links',
  forms: 'Forms',
  'forms-concessionaire': 'Concessionaire form',
  'forms-visitors-pass': 'Visitors pass',
  'forms-letter-of-intent': 'Letter of intent',
  'dp-campaigns': 'Frames',
  'dp-new': 'New frame',
  'dp-edit': 'Edit frame',
  'dp-public': 'Frame',
  events: 'Tix',
  'event-new': 'New event',
  'event-select': 'Attendee selection',
  'event-manage': 'Event',
  'ticket-lookup': 'Ticket lookup',
  'orgs-modify-index': 'Org settings',
  'orgs-modify': 'Org settings',
  'org-catalog': 'Orgs',
  'org-profile': 'Organization',
  account: 'Account',
  'admin-overview': 'Overview',
  'admin-users': 'Users',
  'admin-links': 'Links',
  'admin-reports': 'Reports',
  'admin-audit': 'Audit log',
  'admin-orgs': 'Org management',
  'admin-orgs-new': 'New organization',
  'admin-orgs-edit': 'Edit organization',
  privacy: 'Privacy',
  terms: 'Terms',
  'acceptable-use': 'Acceptable use',
  consent: 'Consent',
  contact: 'Contact',
  unlock: 'Unlock',
  expired: 'Expired',
  report: 'Report',
  redirect: 'Redirect',
  'not-found': 'Page not found',
}

function media(matches: boolean) {
  return {
    matches,
    media: '',
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false
    },
  }
}

describe('route titles', () => {
  it('sets document.title to Page · Eypi for each route and announces it', async () => {
    const named = router.getRoutes().filter((record) => typeof record.name === 'string')
    expect(named.map((record) => String(record.name)).sort()).toEqual(Object.keys(pages).sort())

    for (const record of named) {
      const name = String(record.name)
      expect(record.meta.title, name).toBe(pages[name])
    }

    await router.push('/privacy')
    expect(document.title).toBe('Privacy · Eypi')

    const region = document.getElementById('route-announcer')
    expect(region?.getAttribute('aria-live')).toBe('polite')
    expect(region?.textContent).toBe('Privacy · Eypi')

    await router.push('/contact')
    expect(document.title).toBe('Contact · Eypi')
    expect(document.getElementById('route-announcer')?.textContent).toBe('Contact · Eypi')
  })

  it('hides the route announcer visually', async () => {
    await router.push('/contact')
    expect(document.getElementById('route-announcer')?.classList.contains('sr-only')).toBe(true)
  })

  it('scrolls without smooth behavior when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', (query: string) => media(query.includes('prefers-reduced-motion')))
    const current = router.currentRoute.value
    const reduced = router.options.scrollBehavior?.(current, current, null)
    expect(reduced).toEqual({ top: 0, behavior: 'auto' })

    vi.stubGlobal('matchMedia', () => media(false))
    const smooth = router.options.scrollBehavior?.(
      current,
      current,
      null,
    ) as { top: number; behavior: ScrollBehavior }
    expect(smooth).toEqual({ top: 0, behavior: 'smooth' })
    vi.unstubAllGlobals()
  })

  it('returns savedPosition so the back button restores scroll', () => {
    const current = router.currentRoute.value
    const saved = { left: 12, top: 480 }
    expect(router.options.scrollBehavior?.(current, current, saved)).toEqual(saved)
  })
})
