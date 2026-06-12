// Shared DP Blast types.

// A frame as handled by the uploader UI. `id` is present only for frames already
// persisted on the server (edit mode); `src` is a displayable image URL — a
// base64 data-URL for both freshly-read files and server-returned frames.
export interface DpUploaderFrame {
  id?: string
  src: string
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

// A frame in a public/editor payload.
export interface DpFrame {
  id: string
  imageUrl: string
  label: string | null
  position: number
}

export const DP_MAX_FRAMES = 10
export const DP_FRAME_MAX_BYTES = 2 * 1024 * 1024
