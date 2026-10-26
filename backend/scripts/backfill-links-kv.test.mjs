import { describe, expect, it } from 'vitest'
import { encodeLinkKv } from '../../shared/linksKv'
import {
  diffKv,
  expectedKvValue,
  liveLinksSql,
  parseArgs,
  parseKvKeyList,
  staleValues,
  writePlan,
} from './backfill-links-kv.mjs'

describe('diffKv', () => {
  it('puts a live slug missing from KV', () => {
    const diff = diffKv(['live'], [])
    expect(diff.put).toEqual(['live'])
    expect(diff.delete).toEqual([])
  })

  it('deletes a KV slug with no live link', () => {
    const diff = diffKv([], ['stale'])
    expect(diff.put).toEqual([])
    expect(diff.delete).toEqual(['stale'])
  })

  it('includes a slug that is in both in neither put nor delete', () => {
    const diff = diffKv(['live', 'both'], ['stale', 'both'])
    expect(diff.put).toEqual(['live'])
    expect(diff.delete).toEqual(['stale'])
  })
})

describe('parseArgs', () => {
  it('dry-runs unless --yes is passed', () => {
    expect(parseArgs([])).toEqual({ dryRun: true, reconcile: false })
    expect(parseArgs(['--dry-run'])).toEqual({ dryRun: true, reconcile: false })
    expect(parseArgs(['--yes'])).toEqual({ dryRun: false, reconcile: false })
    expect(parseArgs(['--yes', '--dry-run'])).toEqual({ dryRun: true, reconcile: false })
  })

  it('keeps --reconcile on a dry run until --yes is passed', () => {
    expect(parseArgs(['--reconcile'])).toEqual({ dryRun: true, reconcile: true })
    expect(parseArgs(['--yes', '--reconcile'])).toEqual({ dryRun: false, reconcile: true })
  })
})

describe('liveLinksSql', () => {
  it('selects every link when expiry and disable columns are absent', () => {
    expect(liveLinksSql(['id', 'slug', 'original_url'])).toBe(
      'SELECT id, slug, original_url FROM links',
    )
  })

  it('keeps enabled links that are not expired', () => {
    expect(liveLinksSql(['id', 'slug', 'disabled_at', 'expires_at'])).toBe(
      "SELECT id, slug, original_url, expires_at FROM links WHERE disabled_at IS NULL AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))",
    )
  })

  it('selects password_hash when the column exists', () => {
    expect(liveLinksSql(['id', 'slug', 'password_hash'])).toBe(
      'SELECT id, slug, original_url, password_hash FROM links',
    )
  })
})

describe('parseKvKeyList', () => {
  it('reads slug names from a wrangler key list', () => {
    const raw = '[\n  { "name": "live" },\n  { "name": "stale" }\n]\n'
    expect(parseKvKeyList(raw)).toEqual(['live', 'stale'])
  })
})

describe('expectedKvValue', () => {
  it('matches the shared v2 encoding with password and expiry', () => {
    const row = {
      id: 'l1',
      original_url: 'https://example.com/a',
      password_hash: 'pbkdf2$sha256$100000$x$y',
      expires_at: '2030-01-01 00:00:00',
    }
    expect(expectedKvValue(row)).toBe(
      encodeLinkKv({ id: 'l1', url: 'https://example.com/a', pw: true, exp: Date.parse('2030-01-01T00:00:00Z') / 1000 }),
    )
    expect(JSON.parse(expectedKvValue(row))).toMatchObject({ v: 2, pw: 1 })
  })

  it('omits pw and exp for a plain link and never stores the hash', () => {
    const value = expectedKvValue({ id: 'l2', original_url: 'https://example.com/b', password_hash: null, expires_at: null })
    expect(value).toBe(encodeLinkKv({ id: 'l2', url: 'https://example.com/b' }))
    const hashed = expectedKvValue({ id: 'l3', original_url: 'https://example.com/c', password_hash: 'secret-hash', expires_at: null })
    expect(hashed).not.toContain('secret-hash')
  })
})

describe('staleValues', () => {
  it('lists present keys whose stored value differs from the expected value', () => {
    const expected = new Map([['a', 'v2a'], ['b', 'v2b'], ['c', 'v2c']])
    const stored = new Map([['a', 'v2a'], ['b', '{"id":"b","url":"x"}']])
    expect(staleValues(expected, stored)).toEqual(['b'])
  })
})

describe('writePlan', () => {
  it('rewrites differing values only in applied reconcile mode', () => {
    const diff = { put: ['new'], delete: [], rewrite: ['old'] }
    expect(writePlan({ dryRun: false, reconcile: false }, diff).put).toEqual(['new'])
    expect(writePlan({ dryRun: false, reconcile: true }, diff).put).toEqual(['new', 'old'])
    expect(writePlan({ dryRun: true, reconcile: true }, diff).put).toEqual([])
  })

  const diff = { put: ['live'], delete: ['stale'] }

  it('does not write on a dry run', () => {
    expect(writePlan({ dryRun: true, reconcile: true }, diff)).toEqual({
      put: [],
      delete: [],
    })
  })

  it('puts missing slugs and deletes stale ones only when reconcile is applied', () => {
    expect(writePlan({ dryRun: false, reconcile: false }, diff)).toEqual({
      put: ['live'],
      delete: [],
    })
    expect(writePlan({ dryRun: false, reconcile: true }, diff)).toEqual({
      put: ['live'],
      delete: ['stale'],
    })
  })
})
