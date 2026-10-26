import type { Component } from 'vue'
import {
  Building2,
  FileText,
  Frame,
  LayoutDashboard,
  Link2,
  Mail,
  ShieldCheck,
  Ticket,
  User,
} from 'lucide-vue-next'
import { isNavActive, navItems, tabItems, type NavIconName, type NavItem } from '@/config/nav'

export type AppNavEntry = {
  to: string
  label: string
  icon: Component
  /** The shared nav config item, so active matching never drifts from `@/config/nav`. */
  item: NavItem
}

const ICONS: Partial<Record<NavIconName, Component>> = {
  home: LayoutDashboard,
  link: Link2,
  ticket: Ticket,
  frame: Frame,
  form: FileText,
  orgs: Building2,
  invites: Mail,
  account: User,
  admin: ShieldCheck,
}

/** Signed-in module links, built from `@/config/nav` (the single source of nav items). */
export function appNav({ admin }: { admin: boolean }): AppNavEntry[] {
  return navItems({ authenticated: true, admin }).map((item) => ({
    to: item.to,
    label: item.label,
    icon: ICONS[item.icon] ?? LayoutDashboard,
    item,
  }))
}

export const APP_NAV: AppNavEntry[] = appNav({ admin: false })

/** Exact match or a child path (`to` + `/`). */
export function isAppNavActive(to: string, path: string): boolean {
  const base = to.split('?')[0]
  return path === base || path.startsWith(`${base}/`)
}

/** Honours the config's `match` and `exact` rules (Admin matches all of /admin). */
export function isAppNavEntryActive(entry: AppNavEntry, path: string): boolean {
  return isNavActive(entry.item, path)
}

export function tabEntries(entries: AppNavEntry[]): AppNavEntry[] {
  const keep = new Set(tabItems(entries.map((entry) => entry.item)))
  return entries.filter((entry) => keep.has(entry.item))
}

export function overflowEntries(entries: AppNavEntry[]): AppNavEntry[] {
  const tabs = new Set(tabEntries(entries))
  return entries.filter((entry) => !tabs.has(entry))
}
