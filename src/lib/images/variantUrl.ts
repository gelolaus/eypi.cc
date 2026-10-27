import type { ImageFormat } from './variants'

const EXTENSION: Record<ImageFormat, string> = { png: 'png', jpeg: 'jpg', webp: 'webp' }

/**
 * URL of a stored variant. Mirrors backend `variantKey` (backend/src/lib/media.ts):
 * `{originalKeyWithoutExt}-{width}.{webp|jpg|png}`. Keep the two in step; the
 * parity test pins them with shared fixtures.
 */
export function variantUrl(src: string, width: number, fmt: ImageFormat): string {
  const slash = src.lastIndexOf('/')
  const dot = src.lastIndexOf('.')
  const base = dot > slash ? src.slice(0, dot) : src
  return `${base}-${width}.${EXTENSION[fmt]}`
}
