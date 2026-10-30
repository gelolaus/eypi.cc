import type { ParsedSchedule } from '@shared/schedule/types'
import { renderAgenda } from './renderAgenda'
import { renderCards } from './renderCards'
import { renderGrid } from './renderGrid'
import { ensureFonts } from './text'
import type { LayoutId, RenderInput } from './types'

const RENDERERS: Record<LayoutId, (ctx: CanvasRenderingContext2D, input: RenderInput) => void> = {
  grid: renderGrid,
  agenda: renderAgenda,
  cards: renderCards,
}

/** Sizes the canvas and draws the chosen layout once the Eypi fonts are ready. */
export async function render(canvas: HTMLCanvasElement, input: RenderInput): Promise<void> {
  await ensureFonts()
  canvas.width = input.width
  canvas.height = input.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not render the image. Try again.')
  RENDERERS[input.layout](ctx, input)
}

/** Draws at full size on a new canvas and returns the PNG. */
export async function renderToBlob(input: RenderInput): Promise<Blob> {
  const canvas = document.createElement('canvas')
  await render(canvas, input)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not render the image. Try again.'))), 'image/png')
  })
}

/** `eypi-schedule-2026-2027-term-2.png`, or `eypi-schedule.png` when the term is unknown. */
export function wallpaperFilename(schedule: ParsedSchedule): string {
  const slug = (schedule.term ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug ? `eypi-schedule-${slug}.png` : 'eypi-schedule.png'
}
