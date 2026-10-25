import { describe, it, expect } from 'vitest'
import { parseEnvFile, checkDevVars, seedDevVars } from './envFile.mjs'

const example = {
  TURSO_DATABASE_URL: 'libsql://your-database-name-your-org.turso.io',
  TURSO_AUTH_TOKEN: 'your-turso-database-token',
  PASS_TOKEN_SECRET: 'your-local-only-pass-token-secret-min-32-chars',
  AUTH_COOKIE_SECRET: 'your-local-only-auth-cookie-secret-min-32-chars',
  IP_HASH_SECRET: 'your-local-only-ip-hash-secret-min-32-chars',
  RESEND_API_KEY: 'your-resend-api-key',
  MS_CLIENT_ID: '',
  APPLE_TEAM_ID: 'XXXXXXXXXX',
}

const setRequired = {
  TURSO_DATABASE_URL: 'libsql://a',
  TURSO_AUTH_TOKEN: 't',
  PASS_TOKEN_SECRET: 'p',
  AUTH_COOKIE_SECRET: 'c',
  IP_HASH_SECRET: 'i',
}

describe('parseEnvFile', () => {
  it('parses CRLF files and strips one pair of surrounding quotes', () => {
    const text = 'AUTH_COOKIE_SECRET="abc"\r\nTURSO_DATABASE_URL=libsql://x.turso.io\r\n'
    expect(parseEnvFile(text)).toEqual({ AUTH_COOKIE_SECRET: 'abc', TURSO_DATABASE_URL: 'libsql://x.turso.io' })
  })
  it('keeps = inside values (base64 padding, PEM)', () => {
    expect(parseEnvFile('AUTH_COOKIE_SECRET=ab+cd/ef==\n').AUTH_COOKIE_SECRET).toBe('ab+cd/ef==')
  })
  it('skips comments and blank lines', () => {
    expect(parseEnvFile('# note\n\nA=1\n')).toEqual({ A: '1' })
  })
})

describe('checkDevVars', () => {
  it('counts example placeholders as unset', () => {
    const r = checkDevVars({ ...example }, example)
    expect(r.requiredUnset).toEqual([
      'TURSO_DATABASE_URL',
      'TURSO_AUTH_TOKEN',
      'PASS_TOKEN_SECRET',
      'AUTH_COOKIE_SECRET',
      'IP_HASH_SECRET',
    ])
  })
  it('reports unset optional keys with their feature label', () => {
    const r = checkDevVars(setRequired, example)
    expect(r.requiredUnset).toEqual([])
    expect(r.optionalUnset).toContainEqual({ key: 'RESEND_API_KEY', feature: 'invite emails' })
    expect(r.optionalUnset).toContainEqual({ key: 'MS_CLIENT_ID', feature: 'Microsoft sign-in' })
  })
  it('treats a copied XXXXXXXXXX placeholder as unset', () => {
    const r = checkDevVars({ ...setRequired, APPLE_TEAM_ID: 'XXXXXXXXXX' }, example)
    expect(r.optionalUnset.map((o) => o.key)).toContain('APPLE_TEAM_ID')
  })
})

describe('seedDevVars', () => {
  it('creates the file from the example with fresh generated secrets', () => {
    const r = seedDevVars(
      [
        'PASS_TOKEN_SECRET=your-local-only-pass-token-secret-min-32-chars',
        'AUTH_COOKIE_SECRET=your-local-only-auth-cookie-secret-min-32-chars',
        'IP_HASH_SECRET=your-local-only-ip-hash-secret-min-32-chars',
        'TURSO_AUTH_TOKEN=',
      ].join('\n'),
      null,
      { PASS_TOKEN_SECRET: 'NEWPASS', AUTH_COOKIE_SECRET: 'NEWCOOKIE', IP_HASH_SECRET: 'NEWIP' },
    )
    expect(r.changed).toBe(true)
    expect(r.text).toContain('PASS_TOKEN_SECRET=NEWPASS')
    expect(r.text).toContain('AUTH_COOKIE_SECRET=NEWCOOKIE')
    expect(r.text).toContain('IP_HASH_SECRET=NEWIP')
    expect(r.text).not.toContain('your-local-only')
  })
  it('never overwrites an existing file', () => {
    expect(seedDevVars('PASS_TOKEN_SECRET=x\n', 'PASS_TOKEN_SECRET=mine\n', {})).toEqual({
      text: 'PASS_TOKEN_SECRET=mine\n',
      changed: false,
    })
  })
})
