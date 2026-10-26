import { describe, expect, it } from 'vitest'
import { APC_EMAIL_DOMAINS, isApcEmail, normalizeEmail } from './apcIdentity'

describe('normalizeEmail', () => {
  it('trims surrounding space and lowercases', () => {
    expect(normalizeEmail('  Ada@Student.APC.edu.ph  ')).toBe('ada@student.apc.edu.ph')
  })
})

describe('APC_EMAIL_DOMAINS', () => {
  it('lists the staff and student APC domains', () => {
    expect(APC_EMAIL_DOMAINS).toEqual(['apc.edu.ph', 'student.apc.edu.ph'])
  })
})

describe('isApcEmail', () => {
  it('accepts both APC domains after normalizeEmail', () => {
    expect(isApcEmail('a@apc.edu.ph')).toBe(true)
    expect(isApcEmail('a@student.apc.edu.ph')).toBe(true)
    expect(isApcEmail('  A@APC.EDU.PH ')).toBe(true)
    expect(isApcEmail('  A@STUDENT.APC.EDU.PH ')).toBe(true)
  })

  it('rejects a domain that only contains an APC suffix', () => {
    expect(isApcEmail('x@evil.apc.edu.ph.com')).toBe(false)
  })

  it('rejects a subdomain of an APC domain', () => {
    expect(isApcEmail('x@sub.apc.edu.ph')).toBe(false)
    expect(isApcEmail('x@sub.student.apc.edu.ph')).toBe(false)
  })

  it('rejects other domains and addresses without one exact domain', () => {
    expect(isApcEmail('a@gmail.com')).toBe(false)
    expect(isApcEmail('not-an-email')).toBe(false)
    expect(isApcEmail('a@apc.edu.ph@apc.edu.ph')).toBe(false)
    expect(isApcEmail('')).toBe(false)
  })
})
