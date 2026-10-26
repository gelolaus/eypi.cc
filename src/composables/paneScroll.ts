import { nextTick } from 'vue'
import type { Router } from 'vue-router'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function findHashTarget(pane: HTMLElement, hash: string): HTMLElement | null {
  let id = hash.slice(1)
  try {
    id = decodeURIComponent(id)
  } catch {
    // malformed escape sequence: fall back to the raw fragment
  }
  if (!id) return null
  const el = document.getElementById(id)
  return el && pane.contains(el) ? el : null
}

/**
 * Mirrors the router's `scrollBehavior` for the app shell content pane, which scrolls
 * instead of the window: saves the pane position per history entry (keyed by fullPath),
 * restores it on back and forward, scrolls hash targets into view, and otherwise resets
 * to the top (smooth unless the user prefers reduced motion). Returns a disposer.
 */
export function installPaneScroll(router: Router, getPane: () => HTMLElement | null): () => void {
  const saved = new Map<string, number>()
  let popPending = false

  // History listeners fire only for back/forward (popstate), never for push or replace.
  const stopListening = router.options.history.listen(() => {
    popPending = true
  })

  const stopBefore = router.beforeEach((_to, from) => {
    const pane = getPane()
    if (pane) saved.set(from.fullPath, pane.scrollTop)
  })

  const stopAfter = router.afterEach(async (to, from, failure) => {
    const isPop = popPending
    popPending = false
    if (failure) return
    if (!isPop && to.path === from.path && to.hash === from.hash) return

    // Wait for the new page to render before measuring or scrolling.
    await nextTick()
    const pane = getPane()
    if (!pane) return
    const reduce = prefersReducedMotion()

    if (isPop && saved.has(to.fullPath)) {
      pane.scrollTo({ top: saved.get(to.fullPath) ?? 0, behavior: 'auto' })
      return
    }
    if (to.hash) {
      const target = findHashTarget(pane, to.hash)
      if (target) {
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
        return
      }
    }
    pane.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  })

  return () => {
    stopListening()
    stopBefore()
    stopAfter()
  }
}
