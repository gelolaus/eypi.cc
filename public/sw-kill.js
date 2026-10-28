/*
 * KILL SWITCH. To use it, copy this file over public/sw.js and deploy the frontend:
 *   cp public/sw-kill.js public/sw.js
 * Every browser that checks for a new worker (on its next page load, and at least daily) installs
 * this one, which deletes every eypi-* cache, unregisters the service worker and reloads open tabs
 * so they come back without any worker. It never answers fetches, so it cannot serve anything stale.
 * scripts/sw-precache.mjs skips it because it has no build marker.
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name.indexOf('eypi-') === 0).map((name) => caches.delete(name)))
      await self.registration.unregister()
      const windows = await self.clients.matchAll({ type: 'window' })
      await Promise.all(windows.map((client) => client.navigate(client.url).catch(() => undefined)))
    })(),
  )
})
