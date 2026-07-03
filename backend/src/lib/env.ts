import type { Bindings } from './db'

/** Secrets required for core API auth and database access. */
export const REQUIRED_ENV_KEYS = [
  'TURSO_DATABASE_URL',
  'TURSO_AUTH_TOKEN',
  'JWT_SECRET',
] as const satisfies readonly (keyof Bindings)[]

export function missingRequiredEnv(env: Bindings): (typeof REQUIRED_ENV_KEYS)[number][] {
  return REQUIRED_ENV_KEYS.filter((key) => !String(env[key] ?? '').trim())
}

export function requiredEnvError(missing: (typeof REQUIRED_ENV_KEYS)[number][]): string {
  return `Missing required secrets in backend/.dev.vars: ${missing.join(', ')}`
}
