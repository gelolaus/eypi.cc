export type RecordedCall = { op: 'fillText' | 'fillRect' | 'roundRect' | 'drawImage'; x: number; y: number; text?: string }

export type RecordingContext = {
  canvas: { width: number; height: number }
  calls: RecordedCall[]
  font: string
  fillStyle: unknown
  strokeStyle: unknown
  textAlign: string
  textBaseline: string
  globalAlpha: number
  lineWidth: number
  measureText: (text: string) => { width: number }
  fillText: (text: string, x: number, y: number) => void
  fillRect: (x: number, y: number, w: number, h: number) => void
  roundRect: (x: number, y: number, w: number, h: number, r?: number) => void
  drawImage: (image: unknown, x: number, y: number, ...rest: number[]) => void
  save: () => void
  restore: () => void
  beginPath: () => void
  closePath: () => void
  fill: () => void
  stroke: () => void
  clip: () => void
  moveTo: () => void
  lineTo: () => void
  arc: () => void
  rect: () => void
}

/** A canvas stand-in for tests: measureText is 0.6 × font size per character, and drawing calls are recorded. */
export function createRecordingContext(width: number, height: number): RecordingContext {
  const calls: RecordedCall[] = []
  const noop = () => {}
  const ctx: RecordingContext = {
    canvas: { width, height },
    calls,
    font: '400 16px sans-serif',
    fillStyle: '#000000',
    strokeStyle: '#000000',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    lineWidth: 1,
    measureText: (text) => {
      const size = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 16)
      return { width: text.length * size * 0.6 }
    },
    fillText: (text, x, y) => void calls.push({ op: 'fillText', x, y, text }),
    fillRect: (x, y) => void calls.push({ op: 'fillRect', x, y }),
    roundRect: (x, y) => void calls.push({ op: 'roundRect', x, y }),
    drawImage: (_image, x, y) => void calls.push({ op: 'drawImage', x, y }),
    save: noop, restore: noop, beginPath: noop, closePath: noop, fill: noop, stroke: noop,
    clip: noop, moveTo: noop, lineTo: noop, arc: noop, rect: noop,
  }
  return ctx
}
