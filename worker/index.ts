import { createClient } from '@libsql/client/web'
import { logLinkClick, sanitizeReferrer } from '../shared/linkAnalytics'
import { decodeLinkKvEntry } from '../shared/linksKv'
import { isReservedSlug } from '../shared/reservedSlugs'

export interface Env {
  ASSETS: Fetcher
  LINKS_KV: KVNamespace
  TURSO_DATABASE_URL: string
  TURSO_AUTH_TOKEN: string
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

    const entry = decodeLinkKvEntry(await env.LINKS_KV.get(slug))
    if (!entry) return env.ASSETS.fetch(request)

    try {
      const parsed = new URL(entry.url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return env.ASSETS.fetch(request)
      }
    } catch {
      return env.ASSETS.fetch(request)
    }

    const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf
    ctx.waitUntil(
      logLinkClick(
        createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN }),
        {
          linkId: entry.id,
          slug,
          userAgent: request.headers.get('User-Agent'),
          referrer: sanitizeReferrer(request.headers.get('Referer') ?? undefined),
          country: cf?.country ?? 'Unknown',
        },
      ).catch(() => {}),
    )

    return Response.redirect(entry.url, 301)
  },
}
