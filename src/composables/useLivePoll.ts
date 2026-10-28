import { getCurrentScope, onScopeDispose, ref, type Ref } from 'vue'
import { api } from '@/lib/api'

const MAX_BACKOFF_STEPS = 3

/**
 * Polls a small JSON endpoint while the tab is visible, sending If-None-Match so an
 * unchanged answer is a 304. Keeps its last data when offline or failing. Stops with the
 * owning scope (component unmount). Uses `api.raw`, so it bypasses the query cache.
 */
export function useLivePoll<T>(url: string, intervalMs = 5000): { data: Ref<T | null>; lastUpdated: Ref<Date | null> } {
  const data = ref<T | null>(null) as Ref<T | null>
  const lastUpdated = ref<Date | null>(null)
  let etag = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  let inflight = false
  let stopped = false
  let failures = 0

  function schedule() {
    clearTimeout(timer)
    if (stopped || document.hidden) return
    timer = setTimeout(tick, intervalMs * 2 ** Math.min(failures, MAX_BACKOFF_STEPS))
  }

  async function tick() {
    if (stopped || inflight || document.hidden) return
    clearTimeout(timer)
    inflight = true
    try {
      const res = await api.raw(url, etag ? { headers: { 'If-None-Match': etag } } : {})
      if (stopped) return
      if (res.status === 304) {
        failures = 0
      } else if (res.ok) {
        data.value = await res.json() as T
        etag = res.headers.get('ETag') ?? ''
        failures = 0
      } else {
        failures += 1
      }
      if (res.ok || res.status === 304) lastUpdated.value = new Date()
    } catch {
      failures += 1
    } finally {
      inflight = false
      schedule()
    }
  }

  function onVisibility() {
    if (document.hidden) clearTimeout(timer)
    else void tick()
  }

  document.addEventListener('visibilitychange', onVisibility)
  void tick()
  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    })
  }
  return { data, lastUpdated }
}
