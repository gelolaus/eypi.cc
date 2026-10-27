import type { Directive } from 'vue'
import type { RouteLocationRaw, Router } from 'vue-router'
import { useSession } from '@/stores/session'

/** Re-run a route's data prefetch at most this often; the query cache dedupes only in-flight requests. */
const DATA_TTL_MS = 30_000
/** A link must stay on screen this long before it is warmed on idle. */
const VISIBLE_MS = 1_000

const warmedLoaders = new WeakSet<object>()
const dataRuns = new WeakMap<object, number>()

type State = {
  to: RouteLocationRaw
  router: Router | undefined
  timer: ReturnType<typeof setTimeout> | undefined
  observer: IntersectionObserver | undefined
  off: () => void
}
const states = new WeakMap<HTMLElement, State>()

function saveData(): boolean {
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
}

/** A route record component is a lazy loader when it is a bare function, not a component. */
function isLazyLoader(c: unknown): c is () => Promise<unknown> {
  return typeof c === 'function' && !('displayName' in c) && !('props' in c) && !('__vccOpts' in c)
}

/** Loads the target route's lazy components and its optional data loader. Never throws. */
export async function warmRoute(router: Router, to: RouteLocationRaw): Promise<void> {
  if (saveData()) return
  let route
  try {
    route = router.resolve(to)
  } catch {
    return
  }
  // Protected routes are never warmed for a signed-out visitor: no chunk, no data.
  if (route.meta.requiresAuth && useSession().user.value === null) return

  for (const record of route.matched) {
    for (const component of Object.values(record.components ?? {})) {
      if (!isLazyLoader(component) || warmedLoaders.has(component)) continue
      warmedLoaders.add(component)
      void component().catch(() => warmedLoaders.delete(component))
    }
  }

  const data = route.meta.prefetch
  if (data) {
    const last = dataRuns.get(data)
    if (last !== undefined && Date.now() - last < DATA_TTL_MS) return
    dataRuns.set(data, Date.now())
    await data().catch(() => {})
  }
}

function whenIdle(fn: () => void): void {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn)
  else setTimeout(fn, 1)
}

function setup(el: HTMLElement, state: State) {
  const run = () => {
    if (state.router) void warmRoute(state.router, state.to)
  }
  el.addEventListener('pointerenter', run)
  el.addEventListener('focus', run)
  if (typeof IntersectionObserver === 'function') {
    state.observer = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting)
      clearTimeout(state.timer)
      state.timer = undefined
      if (visible) state.timer = setTimeout(() => whenIdle(run), VISIBLE_MS)
    })
    state.observer.observe(el)
  }
  state.off = () => {
    el.removeEventListener('pointerenter', run)
    el.removeEventListener('focus', run)
    clearTimeout(state.timer)
    state.observer?.disconnect()
  }
}

/** `v-prefetch="routeLocation"`: warms the route's chunks and data before the click. */
export const vPrefetch: Directive<HTMLElement, RouteLocationRaw> = {
  mounted(el, binding) {
    const state: State = {
      to: binding.value,
      router: binding.instance?.$router,
      timer: undefined,
      observer: undefined,
      off: () => {},
    }
    states.set(el, state)
    setup(el, state)
  },
  updated(el, binding) {
    const state = states.get(el)
    if (state) state.to = binding.value
  },
  unmounted(el) {
    states.get(el)?.off()
    states.delete(el)
  },
}
