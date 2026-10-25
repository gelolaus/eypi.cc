import { describe, expect, it } from 'vitest'
import { diffKv, liveLinksSql, parseArgs, parseKvKeyList, writePlan } from './backfill-links-kv.mjs'

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
      "SELECT id, slug, original_url FROM links WHERE disabled_at IS NULL AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))",
    )
  })
})

describe('parseKvKeyList', () => {
  it('reads slug names from a wrangler key list', () => {
    const raw = '[\n  { "name": "live" },\n  { "name": "stale" }\n]\n'
    expect(parseKvKeyList(raw)).toEqual(['live', 'stale'])
  })
})

describe('writePlan', () => {
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
