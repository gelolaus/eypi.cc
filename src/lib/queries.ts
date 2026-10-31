import { api } from '@/lib/api'
import { prefetchQuery } from '@/lib/queryCache'
import type { TicketDto } from '@/lib/tix/tickets'
import type { PublicOrgCatalogItem } from '@/types/orgs'

/**
 * Keys and fetchers shared by the views and by route prefetching, so a prefetched
 * value lands under exactly the key the view reads.
 */

export type LinkSummary = { count: number; clicks: number; top: { slug: string; clicks: number } | null }
export type OrgSummary = { members: number; events: number; tickets: number; frames: number }

export type TrendRange = 7 | 30 | 90

export type TopItem = { value: string; clicks: number }

export type TrendsPeriod = {
  totals: { clicks: number; uniques: number; qr: number; activeLinks: number }
  timeline: { day: string; clicks: number; uniques: number }[]
}

export type UserTrends = TrendsPeriod & {
  totals: TrendsPeriod['totals'] & { links: number }
  top: {
    links: { slug: string; clicks: number }[]
    device: TopItem[]
    country: TopItem[]
    referrer: TopItem[]
    app: TopItem[]
  }
  heat: number[]
  previous?: TrendsPeriod
}

export type OrgInsights = {
  profileViews: { total: number; daily: { day: string; n: number }[] }
  frames: { campaigns: number; views: number; downloads: number }
  tix: { events: number; registrations: number; checkIns: number }
  members: { daily: { day: string; count: number }[] }
}

/** Same shape as MyTicketsView / GET /api/tickets. */
export type TicketSummary = TicketDto

export const LINKS_SUMMARY_KEY = 'links:summary'
export const fetchLinksSummary = () => api.get<LinkSummary>('/api/links/summary')

export const orgSummaryKey = (orgId: string) => `orgs:summary:${orgId}`
export const fetchOrgSummary = (orgId: string) => api.get<OrgSummary>(`/api/orgs/${orgId}/summary`)

export const trendsKey = (range: TrendRange) => `links:trends:${range}`
export const fetchTrends = (range: TrendRange) =>
  api.get<UserTrends>(`/api/links/summary/trends?range=${range}&compare=1`)

export const UPCOMING_TICKETS_KEY = 'tickets:upcoming'
export const fetchUpcomingTickets = () => api.get<{ tickets: TicketSummary[] }>('/api/tickets/upcoming')

export const orgInsightsKey = (orgId: string, days: TrendRange) => `orgs:insights:${orgId}:${days}`
export const fetchOrgInsights = (orgId: string, days: TrendRange) =>
  api.get<OrgInsights>(`/api/orgs/${orgId}/insights?days=${days}`)

export const ORGS_CATALOG_KEY = 'orgs:catalog'
export async function fetchOrgsCatalog(): Promise<PublicOrgCatalogItem[]> {
  const res = await api.raw(`/api/orgs/public`)
  const data = await res.json() as { error?: string; orgs?: PublicOrgCatalogItem[] }
  if (!res.ok) throw new Error(data.error || 'Failed to load organizations.')
  return data.orgs ?? []
}

export type LinksListParams = { q?: string; sort?: string; status?: string; cursor?: string | null }

/** API path for a links page. Defaults (sort new, status all) are omitted from the query string. */
export function linksListPath({ q = '', sort = 'new', status = 'all', cursor }: LinksListParams = {}): string {
  const params = new URLSearchParams()
  const term = q.trim()
  if (term) params.set('q', term)
  if (sort !== 'new') params.set('sort', sort)
  if (status !== 'all') params.set('status', status)
  if (cursor) params.set('cursor', cursor)
  const qs = params.toString()
  return qs ? `/api/links?${qs}` : '/api/links'
}

export const linksListKey = (path: string) => `links:list:${path}`

export function activeOrgId(): string {
  try {
    return localStorage.getItem('active_org_id') ?? ''
  } catch {
    return ''
  }
}

export async function prefetchDashboard(): Promise<void> {
  const orgId = activeOrgId()
  await Promise.all([
    prefetchQuery(LINKS_SUMMARY_KEY, fetchLinksSummary),
    prefetchQuery(trendsKey(30), () => fetchTrends(30)),
    prefetchQuery(UPCOMING_TICKETS_KEY, fetchUpcomingTickets),
    orgId ? prefetchQuery(orgSummaryKey(orgId), () => fetchOrgSummary(orgId)) : Promise.resolve(),
  ])
}

export async function prefetchLinks(): Promise<void> {
  const path = linksListPath()
  await prefetchQuery(linksListKey(path), () => api.get(path))
}

export async function prefetchOrgsCatalog(): Promise<void> {
  await prefetchQuery(ORGS_CATALOG_KEY, fetchOrgsCatalog)
}
