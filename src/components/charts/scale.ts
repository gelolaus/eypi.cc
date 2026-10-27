export function linearScale(domain: [number, number], range: [number, number]): (v: number) => number {
  const [d0, d1] = domain
  const [r0, r1] = range
  const span = d1 - d0
  if (span === 0) return () => (r0 + r1) / 2
  return (v) => r0 + ((v - d0) / span) * (r1 - r0)
}

/** Round tick values from 0 up to the first nice step at or above max. */
export function niceTicks(max: number, count = 5): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1]
  const rough = max / Math.max(1, count)
  const pow = 10 ** Math.floor(Math.log10(rough))
  const frac = rough / pow
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow
  const ticks: number[] = []
  for (let v = 0; v < max + step * 0.999; v += step) {
    ticks.push(Math.round(v / step) * step)
    if (v + step >= max && ticks[ticks.length - 1] >= max) break
  }
  return ticks
}
