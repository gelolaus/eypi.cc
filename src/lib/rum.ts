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
export function startRum(router: Router, send: (url: string, body: string) => boolean = beacon): void {
  if (!import.meta.env.PROD) return

  const buffer = new Map<string, Sample>()
  const url = `${API_BASE_URL}/api/rum`

  const record = (metric: { name: string; value: number; rating: string; navigationType?: string }) => {
    const route = router.currentRoute.value.name
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
