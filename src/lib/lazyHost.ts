import { defineAsyncComponent, type Component } from 'vue'

const CHUNK_ERROR_PARTS = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'error loading dynamically imported module',
]

/**
 * Retry once, then reload once on a stale chunk, so a lazy overlay never hangs unseen.
 * Kept self-contained and out of the entry graph: only the lazy AppShell imports it.
 */
export function lazyHost(load: () => Promise<Component>) {
  return defineAsyncComponent({
    loader: load,
    onError(err, retry, fail, attempts) {
      if (attempts <= 1) {
        retry()
        return
      }
      const message = err instanceof Error ? err.message : ''
      const path = window.location.pathname + window.location.search
      const key = `eypi_chunk_reload:${path}`
      if (!CHUNK_ERROR_PARTS.some((part) => message.includes(part)) || sessionStorage.getItem(key)) {
        fail()
        return
      }
      sessionStorage.setItem(key, '1')
      window.location.assign(path)
    },
  })
}
