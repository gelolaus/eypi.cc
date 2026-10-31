export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export function formatDelta(
  current: number,
  previous: number,
): { text: string; direction: 'up' | 'down' | 'flat' | 'new' | 'none' } {
  if (previous === 0 && current === 0) return { direction: 'none', text: '' }
  if (previous === 0) return { direction: 'new', text: 'New' }
  const pct = deltaPercent(current, previous) ?? 0
  if (pct === 0) return { direction: 'flat', text: '0%' }
  if (pct > 0) return { direction: 'up', text: `+${pct}%` }
  return { direction: 'down', text: `${pct}%` }
}

const DAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'] as const

function hourLabel(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM'
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12} ${period}`
}

/** Peak cell in a 168-length Manila hour-of-week heat (Mon 00:00 = 0). */
export function peakHourLabel(heat: number[]): string | null {
  if (heat.length !== 168) return null
  let peak = 0
  let peakIndex = -1
  for (let i = 0; i < heat.length; i++) {
    if (heat[i] > peak) {
      peak = heat[i]
      peakIndex = i
    }
  }
  if (peak <= 0 || peakIndex < 0) return null
  const day = DAY_NAMES[Math.floor(peakIndex / 24)]
  const hour = peakIndex % 24
  return `${day} around ${hourLabel(hour)}`
}

export function checkInRate(checkIns: number, registrations: number): number | null {
  if (registrations === 0) return null
  return Math.min(100, Math.round((checkIns / registrations) * 100))
}

export function sumTimeline(
  timeline: { clicks: number; uniques: number }[],
): { clicks: number; uniques: number } {
  return timeline.reduce(
    (acc, day) => ({ clicks: acc.clicks + day.clicks, uniques: acc.uniques + day.uniques }),
    { clicks: 0, uniques: 0 },
  )
}