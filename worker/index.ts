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

  const headers = new Headers({ 'Cache-Control': IMMUTABLE_MEDIA_CACHE })
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

  return new HTMLRewriter()
    .on('title', {
      element(element) {
        element.setInnerContent(preview.title)
      },
    })
    .on('head', {
      element(element) {
        element.append(meta, { html: true })
      },
    })
    .transform(response)
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

    const match = pathname.match(/^\/([^/]+)\/?$/)
    if (!match) return env.ASSETS.fetch(request)

    const slug = match[1].toLowerCase()
    if (isReservedSlug(slug)) return env.ASSETS.fetch(request)

    const entry = decodeLinkKv(await env.LINKS_KV.get(slug))
    if (!entry) return env.ASSETS.fetch(request)

    if (typeof entry.exp === 'number' && entry.exp * 1000 <= Date.now()) {
      return redirect('/expired')
    }

    if (entry.pw) return redirect(`/unlock/${slug}`)

    let destination: URL
    try {
      destination = new URL(entry.url)
      if (destination.protocol !== 'http:' && destination.protocol !== 'https:') {
        return env.ASSETS.fetch(request)
      }
    } catch {
      return env.ASSETS.fetch(request)
    }

    let source: 'qr' | 'direct' = 'direct'
    if (destination.searchParams.get('src') === 'qr') {
      source = 'qr'
      destination.searchParams.delete('src')
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
