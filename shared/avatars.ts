/** Lucide icon keys (kebab-case) a user can pick as an avatar. */
export const AVATAR_ICONS = [
  'cat', 'dog', 'bird', 'fish', 'rabbit', 'squirrel', 'turtle', 'snail',
  'book-open', 'graduation-cap', 'pencil', 'backpack', 'lightbulb', 'calculator',
  'dumbbell', 'bike', 'trophy', 'volleyball', 'target',
  'music', 'headphones', 'guitar', 'gamepad-2', 'dices', 'puzzle',
  'leaf', 'flower-2', 'sun', 'moon', 'mountain', 'tree-pine',
  'star', 'heart', 'zap', 'flame', 'rocket',
] as const

/** Preset colour keys; the SPA maps each to theme-aware tokens. */
export const AVATAR_COLORS = [
  'blue', 'indigo', 'violet', 'pink', 'red', 'orange',
  'gold', 'green', 'teal', 'sky', 'slate', 'brown',
] as const

export type AvatarIcon = (typeof AVATAR_ICONS)[number]
export type AvatarColor = (typeof AVATAR_COLORS)[number]

const ICON_SET: ReadonlySet<string> = new Set(AVATAR_ICONS)
const COLOR_SET: ReadonlySet<string> = new Set(AVATAR_COLORS)

export function isAvatarIcon(value: unknown): value is AvatarIcon {
  return typeof value === 'string' && ICON_SET.has(value)
}

export function isAvatarColor(value: unknown): value is AvatarColor {
  return typeof value === 'string' && COLOR_SET.has(value)
}

/** Parses a request body into an avatar pair, the reset pair, or null when invalid. */
export function parseAvatar(
  input: unknown,
): { icon: AvatarIcon; color: AvatarColor } | { icon: null; color: null } | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null
  const keys = Object.keys(input)
  if (keys.length !== 2 || !keys.includes('icon') || !keys.includes('color')) return null
  const { icon, color } = input as Record<string, unknown>
  if (icon === null && color === null) return { icon: null, color: null }
  if (isAvatarIcon(icon) && isAvatarColor(color)) return { icon, color }
  return null
}
