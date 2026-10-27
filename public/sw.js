/*
 * eypi.cc service worker. Hand-written on purpose (no Workbox). Logic lives in sw-strategies.js.
 *
 * Update policy: install calls skipWaiting() and activate calls clients.claim(), so a new worker
 * (including the kill switch) takes over every open tab right away instead of waiting for all tabs
 * to close. This is safe because HTML is network first and cache names are versioned: the only
 * thing an early takeover can break is a lazy chunk of the previous build, and src/lib/chunkReload.ts
 * already reloads the page when that happens.
 *
 * Caches: eypi-shell-<buildHash> (HTML shell + /assets/*, dropped on every new build),
 *         eypi-media-v1 (/media/*, 150 entries, least recently used evicted),
 *         eypi-tickets-v1 (GET /api/tickets only; the page deletes it on sign-out, see registerSw.ts).
 *
 * KILL SWITCH: if this file ever ships broken, replace public/sw.js with the contents of
 * public/sw-kill.js and deploy the frontend. scripts/sw-precache.mjs leaves a file without the
 * build marker below untouched. See docs/owner-guide-speed-tix-analytics.md, "Emergency".
 *
 * The next line is rewritten after `vite build` by scripts/sw-precache.mjs. Keep the markers.
 */
importScripts('/sw-strategies.js')

const BUILD = /*build*/ { hash: 'dev', precache: [] } /*end-build*/
const SHELL_CACHE = EypiSw.CACHE_NAMES.shellPrefix + BUILD.hash

function strategyDeps(event) {
  return { caches: caches, fetch: (request) => fetch(request), shellCache: SHELL_CACHE, waitUntil: (p) => event.waitUntil(p) }
}

async function precache() {
  const cache = await caches.open(SHELL_CACHE)
  // Fetched from "/" because "/index.html" redirects, and a redirected response cannot answer a navigation.
  const shell = await fetch('/', { cache: 'reload' })
  if (!EypiSw.cacheable(shell) || shell.redirected) throw new Error('shell unavailable')
  await cache.put(EypiSw.SHELL_KEY, shell)
  // Assets are an optimisation: one failure must not block the worker, the strategy caches it later.
  await Promise.allSettled(
    BUILD.precache.map(async (path) => {
      const res = await fetch(path)
      if (EypiSw.cacheable(res)) await cache.put(path, res)
    }),
  )
}

async function dropOldShells() {
  const names = await caches.keys()
  await Promise.all(
    names
      .filter((name) => name.indexOf(EypiSw.CACHE_NAMES.shellPrefix) === 0 && name !== SHELL_CACHE)
      .map((name) => caches.delete(name)),
  )
}

self.addEventListener('install', (event) => {
  // Best effort: a failed precache (offline install, flaky network) must not leave the worker
  // half-installed. Strategies fill the caches on use. skipWaiting always runs, per the policy above.
  event.waitUntil(precache().catch(() => undefined).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(dropOldShells().then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  switch (EypiSw.pickStrategy(new URL(request.url), request)) {
    case 'shell-network-first':
      return event.respondWith(EypiSw.shellNetworkFirst(request, strategyDeps(event)))
    case 'asset-cache-first':
      return event.respondWith(EypiSw.assetCacheFirst(request, strategyDeps(event)))
    case 'media-cache-first':
      return event.respondWith(EypiSw.mediaCacheFirst(request, strategyDeps(event)))
    case 'tickets-network-first':
      return event.respondWith(EypiSw.ticketsNetworkFirst(request, strategyDeps(event)))
    default:
      // bypass: the browser handles it as if no worker existed
  }
})
