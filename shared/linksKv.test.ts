import { describe, it, expect } from 'vitest'
import { encodeLinkKv, decodeLinkKv, encodeLinkKvEntry, decodeLinkKvEntry } from './linksKv'

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

  it('decodes a v1 value that has only id and url', () => {
    expect(decodeLinkKv('{"id":"link-1","url":"https://example.com/a"}')).toEqual({
      id: 'link-1',
      url: 'https://example.com/a',
    })
  })

  it('round-trips a v2 entry with expiry and protection', () => {
    const raw = encodeLinkKv({
      id: 'link-1',
      url: 'https://example.com/a',
      exp: 1700000000,
      pw: true,
    })

    expect(JSON.parse(raw)).toEqual({
      v: 2,
      id: 'link-1',
      url: 'https://example.com/a',
      exp: 1700000000,
      pw: 1,
    })
    expect(decodeLinkKv(raw)).toEqual({
      id: 'link-1',
      url: 'https://example.com/a',
      exp: 1700000000,
      pw: true,
    })
  })
})
