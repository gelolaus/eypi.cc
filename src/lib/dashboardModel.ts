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