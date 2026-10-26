import { describe, expect, it } from 'vitest'
import { attendeeQrZipNames } from './qrFiles'

describe('attendee QR zip names', () => {
  it('ZIP names are unique for same-name attendees', () => {
    const names = attendeeQrZipNames([
      { id: 'aaaaaaaa-1111-4111-8111-111111111111', firstName: 'Ana', lastName: 'Santos' },
      { id: 'bbbbbbbb-2222-4222-8222-222222222222', firstName: 'Ana', lastName: 'Santos' },
    ])

    expect(names).toEqual([
      'Santos_Ana_aaaaaaaa.png',
      'Santos_Ana_bbbbbbbb.png',
    ])
    expect(new Set(names).size).toBe(names.length)
  })
})
