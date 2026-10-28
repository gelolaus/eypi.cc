import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import type { Router } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { RUM_ROUTES } from '@shared/rumRoutes'

type Device = 'mobile' | 'tablet' | 'desktop'
type Sample = {
  route: string
  metric: string
  value: number
  rating: string
  device: Device
  connection: string | null
  navType: string | null
}

const MAX_BATCH = 10
/** Share of page loads that report vitals. Decided once per load, before any listener registers. */
export const RUM_SAMPLE_RATE = 0.25

export function deviceClass(width: number, coarsePointer: boolean): Device {
  if (width < 768) return 'mobile'
  if (width < 1024 && coarsePointer) return 'tablet'
  return 'desktop'
}

function beacon(url: string, body: string): boolean {
  return typeof navigator.sendBeacon === 'function' && navigator.sendBeacon(url, body)
}

function connectionLabel(): string | null {
  const type = (navigator as { connection?: { effectiveType?: string } }).connection?.effectiveType
  return typeof type === 'string' && type.length <= 32 ? type : null
}

/**
 * Collects Core Web Vitals and sends them in one batch per page view.
 * Sends the route NAME only (never the path or query) and nothing that identifies the visitor.
 */
export function startRum(
  router: Router,
  send: (url: string, body: string) => boolean = beacon,
  random: () => number = Math.random,
): void {
  if (!import.meta.env.PROD) return
  if (random() >= RUM_SAMPLE_RATE) return

  const buffer = new Map<string, Sample>()
  const url = `${API_BASE_URL}/api/rum`

  type Metric = { name: string; value: number; rating: string; navigationType?: string }
  // Vitals can fire before the first navigation resolves; hold them until the route name is known.
  const waiting: Metric[] = []

  const record = (metric: Metric) => {
    const route = router.currentRoute.value.name
    if (route === undefined || route === null) {
      waiting.push(metric)
      return
    }
    if (typeof route !== 'string' || !RUM_ROUTES.has(route)) return
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    buffer.set(`${route}:${metric.name}`, {
      route,
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      device: deviceClass(window.innerWidth, coarse),
      connection: connectionLabel(),
      navType: metric.navigationType ?? null,
    })
  }

  const flush = () => {
    if (buffer.size === 0) return
    const samples = [...buffer.values()]
    buffer.clear()
    for (let i = 0; i < samples.length; i += MAX_BATCH) {
      send(url, JSON.stringify(samples.slice(i, i + MAX_BATCH)))
    }
  }

  void router.isReady().then(() => {
    for (const metric of waiting.splice(0)) record(metric)
  }, () => {
    waiting.length = 0
  })

  onLCP(record)
  onINP(record)
  onCLS(record)
  onFCP(record)
  onTTFB(record)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  router.afterEach(() => flush())
}
