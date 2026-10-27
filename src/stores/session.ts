import { ref, type Ref } from 'vue'
import { ApiError, api } from '@/lib/api'
import { clearQueryCache } from '@/lib/queryCache'
import { clearTicketsCache } from '@/lib/registerSw'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
}

export type ConsentRequirement = {
  document: string
  version: string
}

type MeResponse = {
  user?: {
    id?: unknown
    email?: unknown
    name?: unknown
    role?: unknown
  }
  pendingInviteCount?: unknown
  needsConsent?: unknown
}

const user = ref<SessionUser | null>(null)
const status = ref<'idle' | 'loading' | 'ready'>('idle')
/** True once a load has finished, whether it worked or failed. Reset clears it. */
const settled = ref(false)
const pendingInviteCount = ref(0)
const needsConsent = ref<ConsentRequirement[]>([])
let inflight: Promise<void> | null = null
// Bumped by reset() so a load that began before it cannot mark the new session settled.
let generation = 0
let readyCallbacks = new Set<() => void>()

function asCount(value: unknown): number {
  const count = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(count) || count <= 0) return 0
  return Math.floor(count)
}

function asConsentList(value: unknown): ConsentRequirement[] {
  if (!Array.isArray(value)) return []
  const list: ConsentRequirement[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const document = (entry as { document?: unknown }).document
    const version = (entry as { version?: unknown }).version
    if (typeof document !== 'string' || document.length === 0) continue
    if (typeof version !== 'string' || version.length === 0) continue
    list.push({ document, version })
  }
  return list
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
  clearQueryCache()
  // The service worker keeps the last tickets for offline use. They belong to this session only.
  void clearTicketsCache()
  user.value = null
  pendingInviteCount.value = 0
  needsConsent.value = []
  status.value = 'idle'
  settled.value = false
  generation += 1
  inflight = null
  readyCallbacks = new Set()
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
    needsConsent.value = asConsentList(data.needsConsent)
    status.value = 'ready'
  } catch (error) {
    if (isUnauthorized(error)) {
      user.value = null
      pendingInviteCount.value = 0
      needsConsent.value = []
      status.value = 'ready'
      return
    }
    // A 500 or a dropped connection is not a sign-out. Leave the loaded
    // user in place. With no user yet, idle lets the next load() retry.
    // The consent list came from a response we no longer have, so clear it.
    needsConsent.value = []
    status.value = hadUser ? 'ready' : 'idle'
  }
}

function flushReady(): void {
  if (status.value !== 'ready') return
  const callbacks = readyCallbacks
  readyCallbacks = new Set()
  for (const cb of callbacks) cb()
}

/** Runs cb once, as soon as the session has resolved (now, if it already has). The same function registered twice runs once. */
function onReady(cb: () => void): void {
  if (status.value === 'ready') {
    cb()
    return
  }
  readyCallbacks.add(cb)
}

/** Cancels a callback queued with onReady. */
function offReady(cb: () => void): void {
  readyCallbacks.delete(cb)
}

function track(task: Promise<void>): Promise<void> {
  const startedIn = generation
  const tracked = task.finally(() => {
    if (inflight === tracked) inflight = null
    if (startedIn === generation) settled.value = true
    flushReady()
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
  settled: Ref<boolean>
  pendingInviteCount: Ref<number>
  needsConsent: Ref<ConsentRequirement[]>
  load: () => Promise<void>
  onReady: (cb: () => void) => void
  offReady: (cb: () => void) => void
  reload: () => Promise<void>
  reset: () => void
  logout: () => Promise<void>
} = { user, status, settled, pendingInviteCount, needsConsent, load, onReady, offReady, reload, reset, logout }

export function useSession() {
  return session
}
