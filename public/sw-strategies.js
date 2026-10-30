/*
 * Caching strategies for sw.js (loaded with importScripts, and imported by worker/sw.test.ts).
 * Plain classic script, no modules: it publishes one global, EypiSw.
 *
 * Safety rules that every strategy here follows:
 *  - Only plain GET requests are ever answered. Everything else bypasses the worker.
 *  - Authenticated API responses are never cached, with one explicit exception: the tickets cache
 *    (eypi-tickets-v1). The page deletes that cache on sign-out and session reset
 *    (src/lib/registerSw.ts clearTicketsCache), and the worker deletes a cached copy when the
 *    network answers 401 or 403, so one person's tickets are never shown to the next.
 *  - Opaque, error, partial (206) and Set-Cookie responses are never stored.
 *  - HTML is network first, so a stale worker can never pin old HTML. Only known SPA routes get the
 *    cached-shell fallback; short links (/slug, /unlock/..) go straight to the network, because the
 *    Worker answers them with redirects and the shell would be wrong.
 *
 * Hard-coded on purpose: API_ORIGIN below must match src/config/api.ts and the CSP connect-src in
 * public/_headers. SPA_SEGMENTS must match src/router/index.ts (tied by a test in worker/sw.test.ts).
 *
 * Kill switch churn: after public/sw.js is replaced by sw-kill.js, a browser that already unregistered
 * may register /sw.js again on its next visit (registerSw runs every load) and receive the kill worker
 * once more, which unregisters again. This settles once the normal sw.js is deployed again; keep the
 * kill switch deployed only while the problem is being fixed.
 */
;(function () {
  var API_ORIGIN = 'https://api.eypi.cc'
  var SITE_ORIGIN =
    typeof self !== 'undefined' && self.location && self.location.origin ? self.location.origin : 'https://eypi.cc'
  var CACHE_NAMES = { shellPrefix: 'eypi-shell-', media: 'eypi-media-v1', tickets: 'eypi-tickets-v1' }
  var MEDIA_LIMIT = 150
  var HTML_TIMEOUT_MS = 3000
  var SHELL_KEY = '/index.html'

  function isTicketsPath(pathname) {
    if (pathname === '/api/tickets') return true
    return /^\/api\/tickets\/guest\/[^/]+$/.test(pathname)
  }

  // First path segment of every SPA route in src/router/index.ts, except "unlock" (the Worker redirects
  // short links there, so it must hit the network). Anything else extensionless may be a short link.
  var SPA_SEGMENTS = [
    'login', 'dashboard', 'invites', 'links', 'forms', 'wallpaper', 'manage', 'frames', 'tix', 'tickets', 't', 'orgs', 'account',
    'settings', 'admin', 'privacy', 'terms', 'acceptable-use', 'consent', 'contact', 'expired', 'report',
  ]

  function looksLikeRoute(pathname) {
    if (pathname === '/') return true
    return SPA_SEGMENTS.indexOf(pathname.split('/')[1]) !== -1
  }

  function pickStrategy(url, request) {
    if (request.method !== 'GET') return 'bypass'
    if (request.headers && request.headers.get('range')) return 'bypass'
    if (url.origin === API_ORIGIN) return isTicketsPath(url.pathname) ? 'tickets-network-first' : 'bypass'
    if (url.origin !== SITE_ORIGIN) return 'bypass'
    if (request.mode === 'navigate' && looksLikeRoute(url.pathname)) return 'shell-network-first'
    if (url.pathname.indexOf('/assets/') === 0) return 'asset-cache-first'
    if (url.pathname.indexOf('/media/') === 0 && url.pathname.length > '/media/'.length) return 'media-cache-first'
    return 'bypass'
  }

  /** A response is storable only when it is a complete, successful, same-account-neutral answer. */
  function cacheable(response) {
    if (!response || !response.ok || response.status !== 200) return false
    if (response.type === 'opaque' || response.type === 'opaqueredirect' || response.type === 'error') return false
    if (response.headers.has('set-cookie')) return false
    return true
  }

  function isHtml(response) {
    var type = response.headers.get('content-type') || ''
    return type.toLowerCase().indexOf('text/html') !== -1
  }

  async function safePut(cache, key, response) {
    try {
      await cache.put(key, response)
    } catch {
      // Quota or "Vary: *" must never break the page; the response was already served.
    }
  }

  /** Runs a cache write after the response is returned, kept alive by waitUntil when the worker gave one. */
  function defer(deps, task) {
    var settled = task.catch(function () {})
    try {
      if (deps.waitUntil) deps.waitUntil(settled)
    } catch {
      // waitUntil throws once the event has finished; the write still runs, just unprotected.
    }
  }

  async function trimCache(cache, limit) {
    var keys = await cache.keys()
    var excess = keys.length - limit
    for (var i = 0; i < excess; i++) await cache.delete(keys[i])
  }

  async function shellNetworkFirst(request, deps) {
    var cache = await deps.caches.open(deps.shellCache)
    var network = deps.fetch(request).then(function (res) {
      if (cacheable(res) && !res.redirected && isHtml(res)) defer(deps, safePut(cache, SHELL_KEY, res.clone()))
      return res
    })
    network.catch(function () {})
    var timer
    var timeout = new Promise(function (resolve) {
      timer = setTimeout(function () {
        resolve(null)
      }, HTML_TIMEOUT_MS)
    })
    try {
      var first = await Promise.race([network, timeout])
      if (first) return first
      var cachedAfterTimeout = await cache.match(SHELL_KEY)
      return cachedAfterTimeout || network
    } catch (err) {
      var cached = await cache.match(SHELL_KEY)
      if (cached) return cached
      throw err
    } finally {
      clearTimeout(timer)
    }
  }

  async function assetCacheFirst(request, deps) {
    var cache = await deps.caches.open(deps.shellCache)
    var hit = await cache.match(request)
    if (hit) return hit
    var res = await deps.fetch(request)
    // A missing chunk comes back as the SPA shell with status 200. Never pin that to a script URL.
    if (cacheable(res) && !isHtml(res)) defer(deps, safePut(cache, request, res.clone()))
    return res
  }

  async function mediaCacheFirst(request, deps) {
    var cache = await deps.caches.open(CACHE_NAMES.media)
    var hit = await cache.match(request)
    if (hit) {
      // Re-insert so the entry counts as recently used (cache.keys() is in insertion order).
      var copy = hit.clone()
      defer(deps, cache.delete(request).then(function () { return safePut(cache, request, copy) }))
      return hit
    }
    var res = await deps.fetch(request)
    if (cacheable(res) && !isHtml(res)) {
      defer(deps, safePut(cache, request, res.clone()).then(function () { return trimCache(cache, MEDIA_LIMIT) }))
    }
    return res
  }

  function stamped(response) {
    var headers = new Headers(response.headers)
    headers.set('X-Eypi-Cached-At', String(Date.now()))
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: headers })
  }

  function offlineCopy(response) {
    var headers = new Headers(response.headers)
    headers.set('X-Eypi-Offline', '1')
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: headers })
  }

  async function ticketsNetworkFirst(request, deps) {
    var cache = await deps.caches.open(CACHE_NAMES.tickets)
    var res
    try {
      res = await deps.fetch(request)
    } catch (err) {
      var offline = await cache.match(request, { ignoreVary: true })
      if (offline) return offlineCopy(offline)
      throw err
    }
    if (res.status === 401 || res.status === 403) {
      await cache.delete(request, { ignoreVary: true })
      return res
    }
    // A rotated or cancelled guest link answers 404; the cached copy must not keep rendering offline.
    if (res.status === 404 && /^\/api\/tickets\/guest\//.test(new URL(request.url).pathname)) {
      await cache.delete(request, { ignoreVary: true })
      return res
    }
    if (cacheable(res)) {
      defer(deps, safePut(cache, request, stamped(res.clone())))
      return res
    }
    if (res.status >= 500) {
      var fallback = await cache.match(request, { ignoreVary: true })
      if (fallback) return offlineCopy(fallback)
    }
    return res
  }

  globalThis.EypiSw = {
    API_ORIGIN: API_ORIGIN,
    CACHE_NAMES: CACHE_NAMES,
    MEDIA_LIMIT: MEDIA_LIMIT,
    HTML_TIMEOUT_MS: HTML_TIMEOUT_MS,
    SHELL_KEY: SHELL_KEY,
    SPA_SEGMENTS: SPA_SEGMENTS,
    pickStrategy: pickStrategy,
    cacheable: cacheable,
    trimCache: trimCache,
    shellNetworkFirst: shellNetworkFirst,
    assetCacheFirst: assetCacheFirst,
    mediaCacheFirst: mediaCacheFirst,
    ticketsNetworkFirst: ticketsNetworkFirst,
  }
})()
