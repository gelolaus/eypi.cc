import { ref, type Ref } from 'vue'
import { api } from '@/lib/api'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
}

type MeResponse = {
  user?: {
    id?: unknown
    email?: unknown
    name?: unknown
    role?: unknown
  }
}

const user = ref<SessionUser | null>(null)
const status = ref<'idle' | 'loading' | 'ready'>('idle')
let inflight: Promise<void> | null = null

function asUser(raw: MeResponse['user']): SessionUser | null {
  if (!raw || typeof raw.id !== 'string' || typeof raw.email !== 'string') return null
  return {
    id: raw.id,
    email: raw.email,
    name: typeof raw.name === 'string' ? raw.name : '',
    role: raw.role === 'admin' ? 'admin' : 'user',
  }
}

function reset(): void {
  user.value = null
  status.value = 'idle'
  inflight = null
}

async function pull(): Promise<void> {
  try {
    const data = await api.get<MeResponse>('/api/me')
    user.value = asUser(data.user)
  } catch {
    user.value = null
  } finally {
    status.value = 'ready'
  }
}

function load(): Promise<void> {
  if (status.value === 'ready') return Promise.resolve()
  if (inflight) return inflight
  status.value = 'loading'
  inflight = pull().finally(() => {
    inflight = null
  })
  return inflight
}

async function logout(): Promise<void> {
  try {
    await api.raw('/api/auth/logout', { method: 'POST' })
  } catch {
    // The cookie may already be gone. The SPA session still ends.
  }
  localStorage.removeItem('active_org_id')
  const { useOrgMembership } = await import('@/composables/useOrgMembership')
  useOrgMembership().clearOrgMembershipCache()
  reset()
}

const session: {
  user: Ref<SessionUser | null>
  status: Ref<'idle' | 'loading' | 'ready'>
  load: () => Promise<void>
  reset: () => void
  logout: () => Promise<void>
} = { user, status, load, reset, logout }

export function useSession() {
  return session
}
