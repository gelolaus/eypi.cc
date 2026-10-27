import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'

/** Thrown to callers whose request was overtaken by clearQueryCache; not a user-facing failure. */
export class CacheClearedError extends Error {}

type Entry = { data: unknown; at: number }
type Sub = { key: () => string; refresh: () => Promise<void> }

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()
const subs = new Set<Sub>()
// Bumped by clearQueryCache so a response that lands after a logout or org switch is dropped.
let epoch = 0

/** Fetches once per key at a time and stores the result unless the cache was cleared meanwhile. */
function load<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const running = inflight.get(key)
  if (running) return running as Promise<T>
  const born = epoch
  const p: Promise<T> = fetcher().then((data) => {
    if (born !== epoch) throw new CacheClearedError('cache cleared')
    // invalidate() unlinks a request that began before it, so its older data is not stored.
    if (inflight.get(key) === p) cache.set(key, { data, at: Date.now() })
    return data
  }).finally(() => {
    if (inflight.get(key) === p) inflight.delete(key)
  })
  inflight.set(key, p)
  return p
}

export function useQuery<T>(
  key: string | (() => string),
  fetcher: () => Promise<T>,
  opts: { staleMs?: number } = {},
): { data: Ref<T | undefined>; error: Ref<unknown>; status: Ref<'idle' | 'loading' | 'ready' | 'error'>; refresh: () => Promise<void> } {
  const staleMs = opts.staleMs ?? 30_000
  const keyOf = typeof key === 'function' ? key : () => key
  const data = ref<T>() as Ref<T | undefined>
  const error = ref<unknown>(null)
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')

  let seq = 0
  async function refresh(): Promise<void> {
    const k = keyOf()
    if (!k) return
    const born = epoch
    const mine = ++seq
    if (data.value === undefined) status.value = 'loading'
    try {
      const result = await load(k, fetcher)
      if (k !== keyOf() || born !== epoch || mine !== seq) return
      data.value = result
      error.value = null
      status.value = 'ready'
    } catch (err) {
      if (k !== keyOf() || born !== epoch || mine !== seq) return
      error.value = err
      status.value = 'error'
    }
  }

  function start() {
    const k = keyOf()
    seq += 1
    data.value = undefined
    error.value = null
    status.value = 'idle'
    if (!k) return
    const hit = cache.get(k)
    if (hit) {
      data.value = hit.data as T
      status.value = 'ready'
      if (Date.now() - hit.at < staleMs) return
    } else {
      status.value = 'loading'
    }
    void refresh()
  }

  start()
  if (typeof key === 'function') watch(keyOf, start)
  const sub = { key: keyOf, refresh }
  subs.add(sub)
  if (getCurrentScope()) onScopeDispose(() => subs.delete(sub))
  return { data, error, status, refresh }
}

/** Drops every key that starts with prefix and refetches the ones on screen. */
export function invalidate(prefix: string): void {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k)
  for (const k of [...inflight.keys()]) if (k.startsWith(prefix)) inflight.delete(k)
  for (const s of subs) if (s.key().startsWith(prefix)) void s.refresh()
}

export function clearQueryCache(): void {
  epoch += 1
  cache.clear()
  inflight.clear()
}

export async function prefetchQuery(key: string, fetcher: () => Promise<unknown>): Promise<void> {
  try {
    await load(key, fetcher)
  } catch {
    // A failed prefetch just leaves the key empty.
  }
}

/** Last cached value for key, if any, for callers that manage their own state. */
export function peekQuery<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined
}

/** Always fetches (deduped) and stores the result; resolves with the data. */
export function fetchQuery<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  return load(key, fetcher)
}
