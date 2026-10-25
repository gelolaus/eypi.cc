/// <reference types="@cloudflare/workers-types" />
import { createClient } from '@libsql/client/web'
import { visitorHash } from '../backend/src/lib/ipHash'
import { isBot } from '../backend/src/lib/links/bots'
import { getOS, logLinkClick, sanitizeReferrer } from '../shared/linkAnalytics'
import { decodeLinkKv } from '../shared/linksKv'
import { isReservedSlug } from '../shared/reservedSlugs'

export interface Env {
  ASSETS: Fetcher
  LINKS_KV: KVNamespace
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

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return env.ASSETS.fetch(request)
    }

    const { pathname } = new URL(request.url)

    if (pathname.startsWith('/assets/') || /\.[a-z0-9]+$/i.test(pathname)) {
      return env.ASSETS.fetch(request)
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
