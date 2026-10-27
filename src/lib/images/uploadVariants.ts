import { api } from '@/lib/api'
import type { ImageProfile } from './profiles'
import type { ImageMeta } from './variants'

/**
 * Best-effort: makes right-sized variants in the browser and stores them beside an
 * image that is already saved. Returns the stored meta, or null when there is
 * nothing to add (small image) or anything fails (no canvas, offline, rejected).
 * The original upload has already succeeded, so this never throws.
 * `./variants` is loaded lazily so it stays out of the entry bundle.
 */
export async function uploadVariants(
  file: Blob,
  profile: Exclude<ImageProfile, 'qrLogo'>,
  key: string,
): Promise<ImageMeta | null> {
  try {
    const { makeVariants } = await import('./variants')
    const { meta, variants } = await makeVariants(file, profile)
    if (variants.length === 0 || meta.widths.length === 0) return null
    const res = await api.raw('/api/media/variants', {
      method: 'PUT',
      body: JSON.stringify({
        key,
        placeholder: meta.ph,
        meta: { w: meta.w, h: meta.h, fmt: meta.fmt, widths: meta.widths },
        variants,
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { meta?: ImageMeta }
    return data.meta ?? meta
  } catch {
    return null
  }
}
