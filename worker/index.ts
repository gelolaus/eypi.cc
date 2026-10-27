/// <reference types="@cloudflare/workers-types" />
import { createClient } from '@libsql/client/web'
import { visitorHash } from '../backend/src/lib/ipHash'
import { isBot } from '../backend/src/lib/links/bots'
import { getOS, logLinkClick, sanitizeReferrer } from '../shared/linkAnalytics'
import { decodeLinkKv } from '../shared/linksKv'
import { isReservedSlug } from '../shared/reservedSlugs'

const PUBLIC_MEDIA_PREFIXES = ['frames/', 'orgs/', 'qr-logos/']
const IMMUTABLE_MEDIA_CACHE = 'public, max-age=31536000, immutable'

export interface Env {
  ASSETS: Fetcher
  LINKS_KV: KVNamespace
  MEDIA: R2Bucket
  TURSO_DATABASE_URL: string
  TURSO_AUTH_TOKEN: string
  IP_HASH_SECRET?: string
}

function redirect(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      'Cache-Control': 'private, max-age=0',
    },
  })
}

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10).replace(/-/g, '')
}

function contentTypeForKey(key: string): string | null {
  const extension = key.slice(key.lastIndexOf('.') + 1).toLowerCase()
  if (extension === 'png') return 'image/png'
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg'
  if (extension === 'webp') return 'image/webp'
  return null
}

function publicMediaKey(pathname: string): string | null {
  const marker = '/media/'
  if (!pathname.startsWith(marker) || pathname.length === marker.length) return null
  const key = pathname.slice(marker.length)
  if (key.includes('\\') || key.includes('\0')) return null
  const segments = key.split('/')
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) return null
  if (!PUBLIC_MEDIA_PREFIXES.some((prefix) => key.startsWith(prefix))) return null
  return key
}

async function servePublicMedia(request: Request, env: Env, pathname: string): Promise<Response> {
  const key = publicMediaKey(pathname)
  if (!key) return new Response(null, { status: 404 })
  const object = await env.MEDIA.get(key)
  if (!object) return new Response(null, { status: 404 })

  const headers = new Headers({
    'Cache-Control': IMMUTABLE_MEDIA_CACHE,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  })
  const contentType = object.httpMetadata?.contentType || contentTypeForKey(key)
  if (contentType) headers.set('Content-Type', contentType)
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
  return new Response(object.body, { status: 200, headers })
}

type FrameSharePreview = {
  title: string
  description: string
  imageUrl: string
}

function frameCampaignSlug(pathname: string): string | null {
  const match = pathname.match(/^\/frames\/([^/]+)\/?$/)
  if (!match) return null
  const slug = match[1].toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null
  return slug
}

function textCell(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'bigint') return String(value)
  return ''
}

function frameMediaUrl(origin: string, stored: string): string | null {
  const key = publicMediaKey(`/media/${stored}`)
  if (!key?.startsWith('frames/')) return null
  return `${origin}/media/${key}`
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function loadFrameSharePreview(env: Env, slug: string, origin: string): Promise<FrameSharePreview | null> {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  })
  try {
    const result = await client.execute({
      sql: `SELECT c.title AS title, c.description AS description,
                   f.image_url AS image_url, f.position AS position, f.created_at AS created_at
            FROM dp_campaigns c
            INNER JOIN dp_frames f ON f.campaign_id = c.id
            WHERE c.slug = ?`,
      args: [slug],
    })
    const frames = result.rows.flatMap((row) => {
      const imageUrl = frameMediaUrl(origin, textCell(row.image_url))
      if (!imageUrl) return []
      const position = Number(row.position)
      return [{
        title: textCell(row.title).trim(),
        description: textCell(row.description).trim(),
        imageUrl,
        position: Number.isFinite(position) ? position : Number.MAX_SAFE_INTEGER,
        createdAt: textCell(row.created_at),
      }]
    })
    frames.sort((left, right) => {
      if (left.position !== right.position) return left.position - right.position
      if (left.createdAt < right.createdAt) return -1
      if (left.createdAt > right.createdAt) return 1
      return 0
    })
    const first = frames[0]
    if (!first || first.title.length === 0) return null
    return { title: first.title, description: first.description, imageUrl: first.imageUrl }
  } finally {
    try {
      client.close()
    } catch {
      // A failed close must not drop a preview that was already read.
    }
  }
}

function withFrameSharePreview(response: Response, preview: FrameSharePreview): Response {
  const title = escapeHtmlAttr(preview.title)
  const description = escapeHtmlAttr(preview.description)
  const image = escapeHtmlAttr(preview.imageUrl)
  const meta = [
    `<meta name="description" content="${description}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${image}">`,
  ].join('')

  return rewriteDocument(response, preview.title, meta)
}

const SITE_TITLE = 'Eypi · Links and org tools for APC'
const SITE_DESCRIPTION = 'Short links, official paperwork, event tickets, and org pages. One APC login, zero ads.'
const SITEMAP_HOUR = 'public, max-age=3600'
const SITEMAP_MISS = 'private, max-age=0'
const CAMPAIGN_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const SPA_EXACT_PATHS = new Set([
  '/',
  '/login',
  '/dashboard',
  '/invites',
  '/links',
  '/forms',
  '/orgs',
  '/settings',
  '/privacy',
  '/terms',
  '/contact',
  '/expired',
  '/report',
  '/manage/frames',
  '/manage/frames/new',
  '/manage/tix',
  '/manage/tix/new',
  '/orgs/modify',
  '/settings/security',
  '/settings/organizations',
  '/settings/orgs',
  '/settings/org-management',
  '/settings/org-management/new',
  '/admin',
  '/admin/users',
  '/admin/links',
  '/admin/reports',
  '/admin/audit',
  '/admin/orgs',
  '/admin/orgs/new',
])

type SqlClient = ReturnType<typeof createClient>

type PublicOrg = {
  id: string
  name: string
  tagline: string
  logoUrl: string | null
  sameAs: string[]
}

type SitemapCatalog = {
  orgs: string[]
  campaigns: string[]
}

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

function isSpaRoute(pathname: string): boolean {
  const path = normalizePath(pathname)
  if (SPA_EXACT_PATHS.has(path)) return true
  return /^\/frames\/[^/]+$/.test(path)
    || /^\/manage\/frames\/[^/]+\/edit$/.test(path)
    || /^\/manage\/tix\/[^/]+$/.test(path)
    || /^\/manage\/tix\/[^/]+\/select$/.test(path)
    || /^\/tix\/[^/]+$/.test(path)
    || /^\/orgs\/modify\/[^/]+$/.test(path)
    || /^\/orgs\/[^/]+$/.test(path)
    || /^\/settings\/orgs\/[^/]+$/.test(path)
    || /^\/settings\/org-management\/[^/]+$/.test(path)
    || /^\/admin\/orgs\/[^/]+$/.test(path)
    || /^\/forms\/(?:concessionaire|visitors-pass|letter-of-intent)$/.test(path)
    || /^\/unlock\/[^/]+$/.test(path)
}

function orgProfileSlug(pathname: string): string | null {
  const match = normalizePath(pathname).match(/^\/orgs\/([^/]+)$/)
  if (!match || match[1] === 'modify') return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function isHtmlDocument(response: Response): boolean {
  if (response.status !== 200) return false
  const contentType = response.headers.get('Content-Type') ?? ''
  return contentType.toLowerCase().includes('text/html')
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

function absolutePublicMedia(origin: string, stored: string | null): string | null {
  if (!stored) return null
  if (/^https?:\/\//i.test(stored)) return stored
  const path = stored.startsWith('/media/') ? stored : `/media/${stored.replace(/^\/+/, '')}`
  const key = publicMediaKey(path)
  if (!key) return null
  return `${origin}/media/${key}`
}

function sameAsLinks(raw: string): string[] {
  if (!raw.trim()) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return []
    const urls: string[] = []
    for (const value of Object.values(parsed as Record<string, unknown>)) {
      if (typeof value !== 'string') continue
      const trimmed = value.trim()
      try {
        const url = new URL(trimmed)
        if (url.protocol === 'http:' || url.protocol === 'https:') urls.push(trimmed)
      } catch {
        // A handle without a scheme is not an absolute sameAs URL.
      }
    }
    return urls
  } catch {
    return []
  }
}

async function withTurso<T>(env: Env, read: (client: SqlClient) => Promise<T>): Promise<T> {
  const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  })
  try {
    return await read(client)
  } finally {
    try {
      client.close()
    } catch {
      // A failed close must not drop a read that already finished.
    }
  }
}

// GET /api/dp lists only the caller's campaigns, so the sitemap reads the public rows the API serves.
async function loadSitemapCatalog(env: Env): Promise<SitemapCatalog | null> {
  try {
    return await withTurso(env, async (client) => {
      const orgs = await client.execute({
        sql: `SELECT id FROM organizations WHERE is_public_catalog = 1 ORDER BY name ASC`,
        args: [],
      })
      const campaigns = await client.execute({
        sql: `SELECT slug FROM dp_campaigns
              WHERE slug IS NOT NULL AND length(trim(slug)) > 0
              ORDER BY slug ASC`,
        args: [],
      })
      return {
        orgs: orgs.rows.map((row) => textCell(row.id)).filter((id) => id.length > 0),
        campaigns: campaigns.rows
          .map((row) => textCell(row.slug).trim().toLowerCase())
          .filter((slug) => CAMPAIGN_SLUG.test(slug)),
      }
    })
  } catch {
    return null
  }
}

async function loadPublicOrg(env: Env, slug: string): Promise<PublicOrg | null> {
  try {
    return await withTurso(env, async (client) => {
      const result = await client.execute({
        sql: `SELECT id, name, tagline, logo_url, social_links
              FROM organizations
              WHERE id = ? AND is_public_catalog = 1
              LIMIT 1`,
        args: [slug],
      })
      const row = result.rows[0]
      if (!row) return null
      const name = textCell(row.name).trim()
      if (!name) return null
      const logo = textCell(row.logo_url).trim()
      return {
        id: textCell(row.id) || slug,
        name,
        tagline: textCell(row.tagline).trim(),
        logoUrl: logo || null,
        sameAs: sameAsLinks(textCell(row.social_links)),
      }
    })
  } catch {
    return null
  }
}

function sitemapDocument(origin: string, catalog: SitemapCatalog | null): string {
  const orgs = catalog?.orgs ?? []
  const campaigns = catalog?.campaigns ?? []
  const locs = [
    `${origin}/`,
    `${origin}/privacy`,
    `${origin}/terms`,
    ...orgs.map((id) => `${origin}/orgs/${encodeURIComponent(id)}`),
    ...campaigns.map((slug) => `${origin}/frames/${encodeURIComponent(slug)}`),
  ]
  const body = locs.map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}

function edgeCache(): Cache | null {
  if (typeof caches === 'undefined') return null
  const storage = caches as { default?: Cache }
  return storage.default ?? null
}

async function serveSitemap(request: Request, env: Env): Promise<Response> {
  const origin = new URL(request.url).origin
  const cacheKey = new Request(new URL('/sitemap.xml', origin).toString(), { method: 'GET' })
  const cache = request.method === 'GET' ? edgeCache() : null
  if (cache) {
    try {
      const hit = await cache.match(cacheKey)
      if (hit) return hit
    } catch {
      // Build a fresh sitemap when the cache cannot be read.
    }
  }

  const catalog = await loadSitemapCatalog(env)
  const headers = new Headers({
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': catalog ? SITEMAP_HOUR : SITEMAP_MISS,
  })
  const response = new Response(request.method === 'HEAD' ? null : sitemapDocument(origin, catalog), {
    status: 200,
    headers,
  })
  if (cache && catalog) {
    try {
      await cache.put(cacheKey, response.clone())
    } catch {
      // A cache write must not drop the sitemap.
    }
  }
  return response
}

function rewriteDocument(response: Response, title: string, meta: string): Response {
  return new HTMLRewriter()
    .on('title', {
      element(element) {
        element.setInnerContent(title)
      },
    })
    .on('meta[name="description"]', {
      element(element) {
        element.remove()
      },
    })
    .on('head', {
      element(element) {
        element.append(meta, { html: true })
      },
    })
    .transform(response)
}

function homeMeta(origin: string): string {
  const title = escapeHtmlAttr(SITE_TITLE)
  const description = escapeHtmlAttr(SITE_DESCRIPTION)
  const url = escapeHtmlAttr(`${origin}/`)
  return [
    `<meta name="description" content="${description}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta name="twitter:card" content="summary">`,
  ].join('')
}

function orgMeta(org: PublicOrg, origin: string): string {
  const pageUrl = `${origin}/orgs/${encodeURIComponent(org.id)}`
  const logo = absolutePublicMedia(origin, org.logoUrl)
  const title = escapeHtmlAttr(org.name)
  const description = escapeHtmlAttr(org.tagline)
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: org.name,
    url: pageUrl,
  }
  if (org.tagline) data.description = org.tagline
  if (logo) data.logo = logo
  if (org.sameAs.length > 0) data.sameAs = org.sameAs
  return [
    description ? `<meta name="description" content="${description}">` : '',
    `<meta property="og:title" content="${title}">`,
    description ? `<meta property="og:description" content="${description}">` : '',
    `<meta property="og:url" content="${escapeHtmlAttr(pageUrl)}">`,
    `<meta property="og:type" content="website">`,
    logo ? `<meta property="og:image" content="${escapeHtmlAttr(logo)}">` : '',
    `<meta name="twitter:card" content="${logo ? 'summary_large_image' : 'summary'}">`,
    `<script type="application/ld+json">${jsonLd(data)}</script>`,
  ].join('')
}

async function rewrittenShell(
  request: Request,
  env: Env,
  rewrite: (asset: Response, origin: string) => Promise<Response> | Response,
): Promise<Response> {
  const asset = await env.ASSETS.fetch(request)
  if (request.method !== 'GET' || !isHtmlDocument(asset)) return asset
  return rewrite(asset, new URL(request.url).origin)
}

async function spaNotFound(request: Request, env: Env): Promise<Response> {
  const asset = await env.ASSETS.fetch(request)
  if (asset.status !== 200) return asset
  return new Response(asset.body, {
    status: 404,
    headers: new Headers(asset.headers),
  })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return env.ASSETS.fetch(request)
    }

    const { pathname } = new URL(request.url)
    const retired = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
    if (retired === '/verify' || retired === '/reset-password') {
      return new Response(null, {
        status: 301,
        headers: { Location: '/login' },
      })
    }

    if (pathname.startsWith('/media/') && pathname.length > '/media/'.length) {
      return servePublicMedia(request, env, pathname)
    }

    if (pathname === '/sitemap.xml') {
      return serveSitemap(request, env)
    }

    if (pathname.startsWith('/assets/') || /\.[a-z0-9]+$/i.test(pathname)) {
      return env.ASSETS.fetch(request)
    }

    const frameSlug = frameCampaignSlug(pathname)
    if (frameSlug) {
      const asset = await env.ASSETS.fetch(request)
      if (request.method !== 'GET') return asset
      const contentType = asset.headers.get('Content-Type') ?? ''
      if (asset.status !== 200 || !contentType.toLowerCase().includes('text/html')) return asset
      const origin = new URL(request.url).origin
      const preview = await loadFrameSharePreview(env, frameSlug, origin).catch(() => null)
      if (!preview) return asset
      return withFrameSharePreview(asset, preview)
    }

    const path = normalizePath(pathname)

    if (path === '/') {
      return rewrittenShell(request, env, (asset, origin) => rewriteDocument(asset, SITE_TITLE, homeMeta(origin)))
    }

    const orgSlug = orgProfileSlug(path)
    if (orgSlug) {
      return rewrittenShell(request, env, async (asset, origin) => {
        const org = await loadPublicOrg(env, orgSlug)
        if (!org) return asset
        return rewriteDocument(asset, org.name, orgMeta(org, origin))
      })
    }

    const match = path.match(/^\/([^/]+)$/)
    if (!match) {
      if (isSpaRoute(path)) return env.ASSETS.fetch(request)
      return spaNotFound(request, env)
    }

    const slug = match[1].toLowerCase()
    if (isReservedSlug(slug)) return env.ASSETS.fetch(request)

    const entry = decodeLinkKv(await env.LINKS_KV.get(slug))
    if (!entry) return spaNotFound(request, env)

    if (typeof entry.exp === 'number' && entry.exp * 1000 <= Date.now()) {
      return redirect('/expired')
    }

    const source: 'qr' | 'direct' = new URL(request.url).searchParams.get('src') === 'qr' ? 'qr' : 'direct'

    if (entry.pw) {
      return redirect(source === 'qr' ? `/unlock/${slug}?src=qr` : `/unlock/${slug}`)
    }

    let destination: URL
    try {
      destination = new URL(entry.url)
      if (destination.protocol !== 'http:' && destination.protocol !== 'https:') {
        return env.ASSETS.fetch(request)
      }
    } catch {
      return env.ASSETS.fetch(request)
    }

    if (request.method === 'GET') {
      const userAgent = request.headers.get('User-Agent')
      if (!isBot(userAgent)) {
        const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf
        const secret = env.IP_HASH_SECRET?.trim()
        const ip = request.headers.get('CF-Connecting-IP') ?? ''
        const day = utcDay(new Date())
        ctx.waitUntil(
          (async () => {
            const hashedVisitor = secret
              ? await visitorHash(secret, day, ip, userAgent ?? '')
              : null
            await logLinkClick(
              createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN }),
              {
                linkId: entry.id,
                os: getOS(userAgent),
                country: cf?.country ?? 'Unknown',
                referrer: sanitizeReferrer(request.headers.get('Referer') ?? undefined),
                source,
                visitorHash: hashedVisitor,
              },
            )
          })().catch(() => {}),
        )
      }
    }

    return redirect(destination.toString())
  },
}
