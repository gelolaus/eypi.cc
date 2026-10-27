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
