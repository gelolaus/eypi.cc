/** The face every wallpaper renderer draws with, falling back to the system sans. */
export const FONT_FAMILY = '"Plus Jakarta Sans", system-ui, sans-serif'

type FontSpec = { size: number; min: number; weight: number; family: string }
type MeasureContext = { font: string; measureText: (text: string) => { width: number } }

export function fontString(weight: number, size: number, family: string): string {
  return `${weight} ${size}px ${family}`
}

/** Shrinks the font to `min`, then clips the text with an ellipsis so it fits `maxWidth`. */
export function fitText(ctx: MeasureContext, text: string, maxWidth: number, font: FontSpec): { text: string; size: number } {
  const widthAt = (value: string, size: number) => {
    ctx.font = fontString(font.weight, size, font.family)
    return ctx.measureText(value).width
  }
  for (let size = font.size; size >= font.min; size--) {
    if (widthAt(text, size) <= maxWidth) return { text, size }
  }
  let clipped = text
  while (clipped.length > 0 && widthAt(`${clipped}…`, font.min) > maxWidth) clipped = clipped.slice(0, -1)
  return { text: `${clipped}…`, size: font.min }
}

/** Waits for the Eypi font. Never rejects: the renderers fall back to a system sans. */
export async function ensureFonts(): Promise<void> {
  try {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts
    if (!fonts) return
    await fonts.load('600 16px "Plus Jakarta Sans"')
  } catch {
    // keep going with the fallback font
  }
}
