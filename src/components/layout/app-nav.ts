export type AppNavItem = {
  id: string
  label: string
  href: string
  icon: 'home' | 'links' | 'orgs' | 'forms' | 'frames' | 'tix' | 'orgTools'
  mobileSlot: 'primary' | 'orgTools' | 'never'
}

const homeItem: AppNavItem = {
  id: 'home',
  label: 'Home',
  href: '/dashboard',
  icon: 'home',
  mobileSlot: 'primary',
}

const linksItem: AppNavItem = {
  id: 'links',
  label: 'Links',
  href: '/links',
  icon: 'links',
  mobileSlot: 'primary',
}

const orgToolsDestinations: AppNavItem[] = [
  {
    id: 'orgs',
    label: 'Orgs',
    href: '/orgs',
    icon: 'orgs',
    mobileSlot: 'never',
  },
  {
    id: 'forms',
    label: 'Forms',
    href: '/forms',
    icon: 'forms',
    mobileSlot: 'never',
  },
  {
    id: 'frames',
    label: 'Frames',
    href: '/manage/frames',
    icon: 'frames',
    mobileSlot: 'never',
  },
  {
    id: 'tix',
    label: 'Tix',
    href: '/manage/tix',
    icon: 'tix',
    mobileSlot: 'never',
  },
]

const orgToolsOverflow: AppNavItem = {
  id: 'org-tools',
  label: 'Org tools',
  href: '#org-tools',
  icon: 'orgTools',
  mobileSlot: 'orgTools',
}

export function resolveAppNav(opts: { hasOrgTools: boolean }): {
  desktop: AppNavItem[]
  mobilePrimary: AppNavItem[]
  orgTools: AppNavItem[]
} {
  const base = [homeItem, linksItem]

  if (!opts.hasOrgTools) {
    return {
      desktop: base,
      mobilePrimary: base,
      orgTools: [],
    }
  }

  return {
    desktop: [...base, ...orgToolsDestinations],
    mobilePrimary: [...base, orgToolsOverflow],
    orgTools: orgToolsDestinations,
  }
}

export function isAppNavActive(href: string, path: string): boolean {
  if (path === href) return true
  return path.startsWith(`${href}/`)
}

/** Icon-only rail on Frames edit/new and Tix attendee selection. */
export function isDenseEditorPath(path: string): boolean {
  return (
    path === '/manage/frames/new' ||
    /^\/manage\/frames\/[^/]+\/edit$/.test(path) ||
    /^\/manage\/tix\/[^/]+\/select$/.test(path)
  )
}
