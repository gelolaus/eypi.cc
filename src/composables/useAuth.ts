export interface AuthUser {
  sub: string
  email: string
  name?: string
  exp: number
}

export function useAuth() {
  function getToken(): string | null {
    return localStorage.getItem('eypi_token')
  }

  function getUser(): AuthUser | null {
    const token = getToken()
    if (!token) return null
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const payload: AuthUser = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload.exp && Date.now() / 1000 > payload.exp) return null
      return payload
    } catch {
      return null
    }
  }

  function authHeaders(): Record<string, string> {
    const token = getToken()
    const activeOrgId = localStorage.getItem('active_org_id')
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(activeOrgId ? { 'X-Active-Org-Id': activeOrgId } : {}),
    }
  }

  return { getToken, getUser, authHeaders }
}
