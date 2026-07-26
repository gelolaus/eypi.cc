export const QR_LOGO_DATA_URL_MAX = 2_800_000
/** Allow larger files for in-session preview/export; Save strips logos over QR_LOGO_DATA_URL_MAX. */
export const QR_LOGO_PREVIEW_MAX_BYTES = 10 * 1024 * 1024

const DOT_TYPES = ['square', 'dots', 'rounded', 'classy', 'classy-rounded', 'extra-rounded'] as const
const EYE_FRAME_TYPES = ['square', 'dot', 'extra-rounded'] as const
const EYE_BALL_TYPES = ['square', 'dot'] as const

export type LinkQrDotType = (typeof DOT_TYPES)[number]
export type LinkQrEyeFrameType = (typeof EYE_FRAME_TYPES)[number]
export type LinkQrEyeBallType = (typeof EYE_BALL_TYPES)[number]

export interface LinkQrConfig {
  dotType: LinkQrDotType
  eyeFrameType: LinkQrEyeFrameType
  eyeBallType: LinkQrEyeBallType
  color: string
  logoDataUrl: string | null
}

export const DEFAULT_LINK_QR_CONFIG: LinkQrConfig = {
  dotType: 'square',
  eyeFrameType: 'square',
  eyeBallType: 'square',
  color: '#DEAC4B',
  logoDataUrl: null,
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

function hasAllowedLogoPrefix(value: string): boolean {
  const prefix = value.slice(0, 40).toLowerCase()
  return (
    prefix.startsWith('data:image/jpeg;base64,')
    || prefix.startsWith('data:image/png;base64,')
    || prefix.startsWith('data:image/webp;base64,')
    || prefix.startsWith('data:image/gif;base64,')
  )
}

function isPersistableLogoDataUrl(value: string): boolean {
  return hasAllowedLogoPrefix(value) && value.length <= QR_LOGO_DATA_URL_MAX
}

function asDotType(value: unknown): LinkQrDotType | null {
  return typeof value === 'string' && (DOT_TYPES as readonly string[]).includes(value)
    ? (value as LinkQrDotType)
    : null
}

function asEyeFrameType(value: unknown): LinkQrEyeFrameType | null {
  return typeof value === 'string' && (EYE_FRAME_TYPES as readonly string[]).includes(value)
    ? (value as LinkQrEyeFrameType)
    : null
}

function asEyeBallType(value: unknown): LinkQrEyeBallType | null {
  return typeof value === 'string' && (EYE_BALL_TYPES as readonly string[]).includes(value)
    ? (value as LinkQrEyeBallType)
    : null
}

function normalizeObject(obj: Record<string, unknown>): LinkQrConfig | null {
  const dotType = asDotType(obj.dotType)
  const eyeFrameType = asEyeFrameType(obj.eyeFrameType)
  const eyeBallType = asEyeBallType(obj.eyeBallType)
  const color = typeof obj.color === 'string' ? obj.color : null
  if (!dotType || !eyeFrameType || !eyeBallType || !color || !HEX_COLOR.test(color)) {
    return null
  }

  let logoDataUrl: string | null = null
  const logo = obj.logoDataUrl
  if (typeof logo === 'string' && logo.length > 0 && hasAllowedLogoPrefix(logo)) {
    // May still exceed save size; prepareQrConfigForSave strips those.
    logoDataUrl = logo
  }

  return {
    dotType,
    eyeFrameType,
    eyeBallType,
    color: color.toUpperCase(),
    logoDataUrl,
  }
}

/** Parse DB JSON string or API object into a safe LinkQrConfig. */
export function parseLinkQrConfig(raw: unknown): LinkQrConfig {
  if (raw == null || raw === '') return { ...DEFAULT_LINK_QR_CONFIG }

  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return { ...DEFAULT_LINK_QR_CONFIG }
    }
  }
  if (!obj || typeof obj !== 'object') return { ...DEFAULT_LINK_QR_CONFIG }

  return normalizeObject(obj as Record<string, unknown>) ?? { ...DEFAULT_LINK_QR_CONFIG }
}

export function serializeLinkQrConfig(config: LinkQrConfig): string {
  return JSON.stringify({
    dotType: config.dotType,
    eyeFrameType: config.eyeFrameType,
    eyeBallType: config.eyeBallType,
    color: config.color,
    logoDataUrl: config.logoDataUrl,
  })
}

/**
 * Prepare config for persistence. Oversized logos are dropped so styles still save.
 */
export function prepareQrConfigForSave(config: LinkQrConfig): {
  config: LinkQrConfig
  logoOmitted: boolean
} {
  const logo = config.logoDataUrl?.trim() || null
  if (!logo) {
    return {
      config: { ...config, logoDataUrl: null },
      logoOmitted: false,
    }
  }
  if (!isPersistableLogoDataUrl(logo)) {
    return {
      config: { ...config, logoDataUrl: null },
      logoOmitted: true,
    }
  }
  return {
    config: { ...config, logoDataUrl: logo },
    logoOmitted: false,
  }
}

export function logoExceedsSaveLimit(logoDataUrl: string | null | undefined): boolean {
  const logo = logoDataUrl?.trim() || ''
  if (!logo) return false
  return !isPersistableLogoDataUrl(logo)
}
