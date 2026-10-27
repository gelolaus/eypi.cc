import { formatManilaDateTime } from '@/lib/manilaTime'

/**
 * public/sw.js answers /api/tickets from its cache when the network fails and marks that response
 * with X-Eypi-Offline: 1. X-Eypi-Cached-At holds the time (ms since epoch) it was stored.
 */
export type OfflineInfo = { offline: boolean; cachedAt: number | null }

export function readOfflineInfo(res: Response): OfflineInfo {
  const offline = res.headers.get('x-eypi-offline') === '1'
  if (!offline) return { offline: false, cachedAt: null }
  const stamp = Number(res.headers.get('x-eypi-cached-at'))
  const fromDate = Date.parse(res.headers.get('date') ?? '')
  const cachedAt = Number.isFinite(stamp) && stamp > 0 ? stamp : Number.isFinite(fromDate) ? fromDate : null
  return { offline, cachedAt }
}

export function offlineBanner(info: OfflineInfo): string {
  if (!info.offline) return ''
  if (info.cachedAt == null) return 'Offline — showing your last saved tickets'
  return `Offline — last updated ${formatManilaDateTime(new Date(info.cachedAt).toISOString())}`
}
