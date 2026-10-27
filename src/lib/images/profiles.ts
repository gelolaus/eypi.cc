/** Target widths (px) per upload kind. Lazy-only: never import into the entry bundle. */
export const IMAGE_PROFILES = {
  orgLogo: [96, 192, 384],
  banner: [640, 1280, 1920],
  frame: [256, 512, 1024],
  qrLogo: [512],
} as const

export type ImageProfile = keyof typeof IMAGE_PROFILES
