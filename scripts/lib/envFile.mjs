export const REQUIRED_KEYS = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'PASS_TOKEN_SECRET',
  'AUTH_COOKIE_SECRET',
  'IP_HASH_SECRET',
]

export const OPTIONAL_KEYS = [
  { key: 'MS_CLIENT_ID', feature: 'Microsoft sign-in' },
  { key: 'MS_CLIENT_SECRET', feature: 'Microsoft sign-in' },
  { key: 'MS_ALLOWED_TENANT_IDS', feature: 'Microsoft sign-in' },
  { key: 'RESEND_API_KEY', feature: 'invite emails' },
  { key: 'SAFE_BROWSING_API_KEY', feature: 'Safe Browsing' },
  { key: 'GOOGLE_WALLET_ISSUER_ID', feature: 'Google Wallet' },
  { key: 'GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL', feature: 'Google Wallet' },
  { key: 'GOOGLE_WALLET_SERVICE_ACCOUNT_PRIVATE_KEY', feature: 'Google Wallet' },
]

function stripSurroundingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length >= 2)
    || (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
  ) {
    return value.slice(1, -1)
  }
  return value
}

/** Parse KEY=value text. Splits on the first `=` only; strips one matching quote pair. */
export function parseEnvFile(text) {
  const values = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = stripSurroundingQuotes(trimmed.slice(eq + 1).trim())
    if (key) values[key] = value
  }
  return values
}

function isUnset(values, example, key) {
  const value = values[key]
  if (value == null || String(value).trim() === '') return true
  const placeholder = example[key]
  if (placeholder != null && placeholder !== '' && value === placeholder) return true
  return false
}

export function checkDevVars(values, example) {
  const requiredUnset = REQUIRED_KEYS.filter((key) => isUnset(values, example, key))
  const optionalUnset = OPTIONAL_KEYS.filter((item) => isUnset(values, example, item.key))
  return { requiredUnset, optionalUnset }
}

const GENERATED_SECRET_KEYS = ['PASS_TOKEN_SECRET', 'AUTH_COOKIE_SECRET', 'IP_HASH_SECRET']

export function seedDevVars(exampleText, existingText, secrets) {
  if (existingText !== null) {
    return { text: existingText, changed: false }
  }
  let text = exampleText
  for (const key of GENERATED_SECRET_KEYS) {
    const value = secrets?.[key]
    if (value == null) continue
    text = text.replace(new RegExp(`^[ \\t]*${key}[ \\t]*=.*$`, 'm'), `${key}=${value}`)
  }
  return { text, changed: true }
}
