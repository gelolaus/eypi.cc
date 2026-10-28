import { nextTick } from 'vue'
import { START_LOCATION, type Router } from 'vue-router'

type Transition = { skipTransition(): void; ready: Promise<unknown>; finished: Promise<unknown>; updateCallbackDone: Promise<unknown> }
type Doc = { startViewTransition?: (cb: () => Promise<void>) => Transition }

let running: Transition | undefined

// Runs a DOM update inside a view transition when the browser supports it and
// the user allows motion. Resolves when the update is done, never when the
// animation ends, and rejects with the update's own error.
export async function withViewTransition(update: () => Promise<void> | void): Promise<void> {
  const doc = document as Doc
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!doc.startViewTransition || reduce) return update()
  running?.skipTransition()
  await new Promise<void>((resolve, reject) => {
    const t = doc.startViewTransition!(async () => {
      try { await update(); resolve() } catch (e) { reject(e) }
    })
    running = t
    // A skipped or failed animation is not an error for the caller.
    for (const p of [t.ready, t.finished, t.updateCallbackDone]) p.catch(() => {})
  })
}

// Freezes the old page once guards and the lazy chunk are done, and thaws it
// after Vue renders the new route. Each navigation releases only its own hold;
// a failed, cancelled or superseded navigation, an error, or a callback the
// browser never runs can never leave the page frozen or block navigation.
export function routeTransitions(router: Router): void {
  const holds = new Map<object, () => void>()
  const release = (to?: object) => {
    const keys = to ? [to] : [...holds.keys()]
    for (const k of keys) {
      const done = holds.get(k)
      holds.delete(k)
      if (done) void nextTick(done)
    }
  }
  router.beforeResolve((to, from) => {
    if (from === START_LOCATION || to.path === from.path) return
    release()
    return new Promise<void>((resolve) => {
      let late = false
      const timer = setTimeout(() => { late = true; resolve() }, 1000)
      withViewTransition(() => {
        clearTimeout(timer)
        resolve()
        if (late) return
        return new Promise<void>((done) => { holds.set(to, done) })
      }).catch(() => { clearTimeout(timer); resolve() })
    })
  })
  router.afterEach((to) => release(to))
  router.onError(() => release())
}
