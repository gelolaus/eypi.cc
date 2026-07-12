import { describe, it, expect } from 'vitest'
import { encodeLinkKvEntry, decodeLinkKvEntry } from './linksKv'

describe('linksKv', () => {
  it('round-trips an entry through encode and decode', () => {
    const entry = { id: 'abc-123', url: 'https://example.com' }
    expect(decodeLinkKvEntry(encodeLinkKvEntry(entry))).toEqual(entry)
  })

  it('returns null for a null value', () => {
    expect(decodeLinkKvEntry(null)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(decodeLinkKvEntry('{not json')).toBeNull()
  })

  it('returns null when required fields are missing', () => {
    expect(decodeLinkKvEntry(JSON.stringify({ id: 'abc-123' }))).toBeNull()
    expect(decodeLinkKvEntry(JSON.stringify({ url: 'https://example.com' }))).toBeNull()
  })
})
