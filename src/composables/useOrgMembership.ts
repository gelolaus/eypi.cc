import { api } from '@/lib/api'
import { clearQueryCache } from '@/lib/queryCache'

const CACHE_TTL_MS = 60_000

let cachedResult: boolean | null = null
let cachedAt = 0

async function hasOrgViaOrgsList(): Promise<boolean> {
  const res = await api.raw('/api/orgs')
  if (!res.ok) return false
  const data = await res.json() as { orgs?: unknown[] }
  return (data.orgs?.length ?? 0) > 0
}

export function useOrgMembership() {
  async function checkOrgMembership(): Promise<boolean> {
    const now = Date.now()
    if (cachedResult !== null && now - cachedAt < CACHE_TTL_MS) {
      return cachedResult
    }

    try {
      const res = await api.raw('/api/forms')
      if (res.status === 403) {
        cachedResult = false
        cachedAt = now
        return false
      }
      if (res.ok) {
        cachedResult = true
        cachedAt = now
        return true
      }

      cachedResult = await hasOrgViaOrgsList()
      cachedAt = now
      return cachedResult
    } catch {
      try {
        cachedResult = await hasOrgViaOrgsList()
      } catch {
        cachedResult = false
      }
      cachedAt = now
      return cachedResult
    }
  }

  function clearOrgMembershipCache() {
    cachedResult = null
    cachedAt = 0
    clearQueryCache()
  }

  return { checkOrgMembership, clearOrgMembershipCache }
}
