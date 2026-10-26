import { ref, type Ref } from 'vue'
import { ApiError, api } from '@/lib/api'

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
  pendingInviteCount?: unknown
}

const user = ref<SessionUser | null>(null)
const status = ref<'idle' | 'loading' | 'ready'>('idle')
const pendingInviteCount = ref(0)
let inflight: Promise<void> | null = null

function asCount(value: unknown): number {
  const count = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(count) || count <= 0) return 0
  return Math.floor(count)
}

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
  pendingInviteCount.value = 0
  status.value = 'idle'
  inflight = null
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}

async function pull(): Promise<void> {
  const hadUser = user.value !== null
  try {
    const data = await api.get<MeResponse>('/api/me')
    user.value = asUser(data.user)
    pendingInviteCount.value = asCount(data.pendingInviteCount)
    status.value = 'ready'
  } catch (error) {
    if (isUnauthorized(error)) {
      user.value = null
      pendingInviteCount.value = 0
      status.value = 'ready'
      return
    }
    // A 500 or a dropped connection is not a sign-out. Leave the loaded
    // user in place. With no user yet, idle lets the next load() retry.
    status.value = hadUser ? 'ready' : 'idle'
  }
}

function track(task: Promise<void>): Promise<void> {
  const tracked = task.finally(() => {
    if (inflight === tracked) inflight = null
  })
  inflight = tracked
  return tracked
}

function load(): Promise<void> {
  if (status.value === 'ready') return Promise.resolve()
  if (inflight) return inflight
  status.value = 'loading'
  return track(pull())
}

function reload(): Promise<void> {
  const previous = inflight
  // Do not reuse a probe that started before this refresh.
  return track((async () => {
    if (previous) await previous
    await pull()
  })())
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
  pendingInviteCount: Ref<number>
  load: () => Promise<void>
  reload: () => Promise<void>
  reset: () => void
  logout: () => Promise<void>
} = { user, status, pendingInviteCount, load, reload, reset, logout }

export function useSession() {
  return session
}
