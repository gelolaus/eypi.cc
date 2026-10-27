// Shared DP Blast types.
import type { ImageMeta } from '@/lib/images/variants'

// A frame as handled by the uploader UI. `id` is present only for frames already
// persisted on the server (edit mode); `src` is a displayable image URL — a
// base64 data-URL for both freshly-read files and server-returned frames.
export interface DpUploaderFrame {
  id?: string
  src: string
  meta?: ImageMeta | null
}

// Campaign list item (no heavy image payloads).
export interface DpCampaignSummary {
  id: string
  title: string
  slug: string
  description: string | null
  frameCount: number
  downloadCount: number
  createdAt: string
}

// A frame in a public/editor payload. `url` is a same-origin media path.
export interface DpFrame {
  id: string
  url: string
  imageMeta?: ImageMeta | null
  label: string | null
  width: number
  height: number
  position: number
}

export const DP_MAX_FRAMES = 10
export const DP_FRAME_MAX_BYTES = 10 * 1024 * 1024
