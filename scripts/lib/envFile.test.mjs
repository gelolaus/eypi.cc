import { describe, it, expect } from 'vitest'
import { parseEnvFile, checkDevVars, seedDevVars } from './envFile.mjs'

const example = {
  TURSO_DATABASE_URL: 'libsql://your-database-name-your-org.turso.io',
  TURSO_AUTH_TOKEN: 'your-turso-database-token',
  JWT_SECRET: 'your-local-only-jwt-secret-min-32-chars',
  RESEND_API_KEY: 'your-resend-api-key',
  APPLE_TEAM_ID: 'XXXXXXXXXX',
}

describe('parseEnvFile', () => {
  it('parses CRLF files and strips one pair of surrounding quotes', () => {
    const text = 'JWT_SECRET="abc"\r\nTURSO_DATABASE_URL=libsql://x.turso.io\r\n'
    expect(parseEnvFile(text)).toEqual({ JWT_SECRET: 'abc', TURSO_DATABASE_URL: 'libsql://x.turso.io' })
  })
  it('keeps = inside values (base64 padding, PEM)', () => {
    expect(parseEnvFile('JWT_SECRET=ab+cd/ef==\n').JWT_SECRET).toBe('ab+cd/ef==')
  })
  it('skips comments and blank lines', () => {
    expect(parseEnvFile('# note\n\nA=1\n')).toEqual({ A: '1' })
  })
})

describe('checkDevVars', () => {
  it('counts example placeholders as unset', () => {
    const r = checkDevVars({ ...example }, example)
    expect(r.requiredUnset).toEqual(['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'JWT_SECRET'])
  })
  it('reports unset optional keys with their feature label', () => {
    const r = checkDevVars({ TURSO_DATABASE_URL: 'libsql://a', TURSO_AUTH_TOKEN: 't', JWT_SECRET: 's' }, example)
    expect(r.requiredUnset).toEqual([])
    expect(r.optionalUnset).toContainEqual({ key: 'RESEND_API_KEY', feature: 'verification emails' })
  })
  it('treats a copied XXXXXXXXXX placeholder as unset', () => {
    const r = checkDevVars({ TURSO_DATABASE_URL: 'libsql://a', TURSO_AUTH_TOKEN: 't', JWT_SECRET: 's', APPLE_TEAM_ID: 'XXXXXXXXXX' }, example)
    expect(r.optionalUnset.map((o) => o.key)).toContain('APPLE_TEAM_ID')
  })
})

describe('seedDevVars', () => {
  it('creates the file from the example with a fresh JWT_SECRET', () => {
    const r = seedDevVars('JWT_SECRET=your-local-only-jwt-secret-min-32-chars\nTURSO_AUTH_TOKEN=\n', null, 'NEWSECRET')
    expect(r.changed).toBe(true)
    expect(r.text).toContain('JWT_SECRET=NEWSECRET')
    expect(r.text).not.toContain('your-local-only-jwt-secret')
  })
  it('never overwrites an existing file', () => {
    expect(seedDevVars('JWT_SECRET=x\n', 'JWT_SECRET=mine\n', 'NEW')).toEqual({ text: 'JWT_SECRET=mine\n', changed: false })
  })
})
