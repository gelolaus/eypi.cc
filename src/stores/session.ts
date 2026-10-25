import { ref, type Ref } from 'vue'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
}

const user = ref<SessionUser | null>(null)
const status = ref<'idle' | 'loading' | 'ready'>('idle')
let inflight: Promise<void> | null = null

function reset(): void {
  user.value = null
  status.value = 'idle'
  inflight = null
  localStorage.removeItem('eypi_token')
}

function load(): Promise<void> {
  if (inflight) return inflight
  status.value = 'loading'
  inflight = Promise.resolve().then(() => {
    if (status.value === 'loading') status.value = 'ready'
  }).finally(() => {
    inflight = null
  })
  return inflight
}

async function logout(): Promise<void> {
  localStorage.removeItem('active_org_id')
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
