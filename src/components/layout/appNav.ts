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

function toEntry(item: NavItem): AppNavEntry {
  return { to: item.to, label: item.label, icon: ICONS[item.icon] ?? LayoutDashboard, item }
}

const MENU_ICONS = new Set<NavIconName>(['account', 'admin'])

/** Signed-in module links for the rail and tabs. Account and Admin live in the account menu. */
export function appNav({ admin }: { admin: boolean }): AppNavEntry[] {
  return navItems({ authenticated: true, admin })
    .filter((item) => !MENU_ICONS.has(item.icon))
    .map(toEntry)
}

/** Admin (admins only), then Account: the entries at the top of the account menu. */
export function menuEntries({ admin }: { admin: boolean }): AppNavEntry[] {
  const items = navItems({ authenticated: true, admin }).filter((item) => MENU_ICONS.has(item.icon))
  return items.sort((a, b) => (a.icon === 'admin' ? -1 : 0) - (b.icon === 'admin' ? -1 : 0)).map(toEntry)
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
