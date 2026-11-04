// Shared DP Blast types.
import type { ImageMeta } from '@/lib/images/variants'
import type { BoothWindow } from '@shared/boothWindows'

/** A campaign is a profile-picture frame set or a three-shot photo booth. Fixed at creation. */
export type DpKind = 'profile' | 'booth'

// A frame as handled by the uploader UI. `id` is present only for frames already
// persisted on the server (edit mode); `src` is a displayable image URL — a
// base64 data-URL for both freshly-read files and server-returned frames.
export interface DpUploaderFrame {
  id?: string
  src: string
  meta?: ImageMeta | null
  /** The picked file, kept only until its variants are uploaded after the first save. */
  file?: File
  /** Booth frames only: the three photo windows in frame pixels. */
  windows?: BoothWindow[]
}

// Campaign list item (no heavy image payloads).
export interface DpCampaignSummary {
  id: string
  title: string
  slug: string
  kind?: DpKind
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
  windows: BoothWindow[] | null
}

export const DP_MAX_FRAMES = 10
export const DP_FRAME_MAX_BYTES = 10 * 1024 * 1024
