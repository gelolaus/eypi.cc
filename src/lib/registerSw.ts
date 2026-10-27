import { clearDoorData } from '@/lib/tix/doorCleanup'

const TICKETS_CACHE = 'eypi-tickets-v1'

/** Registers the service worker in production, after the page has loaded and the browser is idle. */
export function registerSw(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const start = () => {
    const run = () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run)
    else setTimeout(run, 2000)
  }
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

/** Removes cached tickets so the next person on this browser never sees them. Safe without a Cache API. */
export async function clearTicketsCache(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') await caches.delete(TICKETS_CACHE)
  } catch {
    // Nothing cached, or storage is blocked.
  }
}

const LAST_USER_KEY = 'eypi_last_user'

/** Remembers who is signed in; drops the cached tickets when a different person turns up on this browser. */
export function noteSignedInUser(id: string | null): void {
  try {
    const previous = localStorage.getItem(LAST_USER_KEY)
    if (id === null) return
    if (previous !== null && previous !== id) {
      void clearTicketsCache()
      void clearDoorData('account')
    }
    localStorage.setItem(LAST_USER_KEY, id)
  } catch {
    // Storage is blocked; the reset and 401 paths still clear the cache.
  }
}
