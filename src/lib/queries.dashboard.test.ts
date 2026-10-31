// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PLATFORM_STATS_KEY,
  UPCOMING_TICKETS_KEY,
  fetchOrgInsights,
  fetchPlatformStats,
  fetchTrends,
  fetchUpcomingTickets,
  orgInsightsKey,
  prefetchDashboard,
  trendsKey,
} from './queries'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubFetch() {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      calls.push(url)
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return calls
}

describe('dashboard query keys and fetchers', () => {
  it('builds distinct trends keys per range', () => {
    expect(trendsKey(7)).toBe('links:trends:7')
    expect(trendsKey(30)).toBe('links:trends:30')
    expect(trendsKey(7)).not.toBe(trendsKey(30))
    expect(orgInsightsKey('jpcs-apc', 30)).toBe('orgs:insights:jpcs-apc:30')
    expect(UPCOMING_TICKETS_KEY).toBe('tickets:upcoming')
    expect(PLATFORM_STATS_KEY).toBe('stats:platform')
  })

  it('calls the documented API paths from each fetcher', async () => {
    const calls = stubFetch()
    await fetchTrends(7)
    await fetchUpcomingTickets()
    await fetchOrgInsights('jpcs-apc', 30)
    await fetchPlatformStats()
    expect(calls.some((u) => u.includes('/api/links/summary/trends?range=7&compare=1'))).toBe(true)
    expect(calls.some((u) => u.includes('/api/tickets/upcoming'))).toBe(true)
    expect(calls.some((u) => u.includes('/api/orgs/jpcs-apc/insights?days=30'))).toBe(true)
    expect(calls.some((u) => u.includes('/api/stats'))).toBe(true)
  })

  it('prefetchDashboard warms trends range 30 and upcoming tickets', async () => {
    const calls = stubFetch()
    await prefetchDashboard()
    expect(calls.some((u) => u.includes('/api/links/summary/trends?range=30&compare=1'))).toBe(true)
    expect(calls.some((u) => u.includes('/api/tickets/upcoming'))).toBe(true)
  })
})
