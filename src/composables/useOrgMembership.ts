import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'

const CACHE_TTL_MS = 60_000

let cachedResult: boolean | null = null
let cachedAt = 0

async function hasOrgViaOrgsList(authHeaders: () => Record<string, string>): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/api/orgs`, { headers: authHeaders() })
  if (!res.ok) return false
  const data = await res.json() as { orgs?: unknown[] }
  return (data.orgs?.length ?? 0) > 0
}

export function useOrgMembership() {
  const { authHeaders } = useAuth()

  async function checkOrgMembership(): Promise<boolean> {
    const now = Date.now()
    if (cachedResult !== null && now - cachedAt < CACHE_TTL_MS) {
      return cachedResult
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/forms`, { headers: authHeaders() })
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

      // /api/forms missing (404) or other error — fall back to org list endpoint
      cachedResult = await hasOrgViaOrgsList(authHeaders)
      cachedAt = now
      return cachedResult
    } catch {
      try {
        cachedResult = await hasOrgViaOrgsList(authHeaders)
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
  }

  return { checkOrgMembership, clearOrgMembershipCache }
}
