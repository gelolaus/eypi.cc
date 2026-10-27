import { RUM_ROUTES } from '../../../shared/rumRoutes'

export { RUM_ROUTES }

export const RUM_METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const
export type RumMetric = (typeof RUM_METRICS)[number]

const RATINGS = ['good', 'needs-improvement', 'poor'] as const
const DEVICES = ['mobile', 'tablet', 'desktop'] as const

export const RUM_MAX_BATCH = 10

export type RumSample = {
  route: string
  metric: RumMetric
  value: number
  rating: (typeof RATINGS)[number]
  device: (typeof DEVICES)[number]
  connection: string | null
  navType: string | null
}

function optionalLabel(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || value.length > 32) return undefined
  return value
}

function parseSample(raw: unknown): RumSample | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.route !== 'string' || !RUM_ROUTES.has(r.route)) return null
  if (!RUM_METRICS.includes(r.metric as RumMetric)) return null
  const metric = r.metric as RumMetric
  if (typeof r.value !== 'number' || !Number.isFinite(r.value) || r.value < 0) return null
  if (r.value > (metric === 'CLS' ? 10 : 120000)) return null
  if (!RATINGS.includes(r.rating as (typeof RATINGS)[number])) return null
  if (!DEVICES.includes(r.device as (typeof DEVICES)[number])) return null
  const connection = optionalLabel(r.connection)
  const navType = optionalLabel(r.navType)
  if (connection === undefined || navType === undefined) return null
  return {
    route: r.route,
    metric,
    value: r.value,
    rating: r.rating as RumSample['rating'],
    device: r.device as RumSample['device'],
    connection,
    navType,
  }
}

/** Returns the validated samples, or null when any part of the batch is bad. */
export function parseRumBatch(body: unknown): RumSample[] | null {
  if (!Array.isArray(body) || body.length === 0 || body.length > RUM_MAX_BATCH) return null
  const out: RumSample[] = []
  for (const item of body) {
    const sample = parseSample(item)
    if (!sample) return null
    out.push(sample)
  }
  return out
}
