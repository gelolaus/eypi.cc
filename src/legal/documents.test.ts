import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { acceptableUse } from './acceptable-use'
import { privacy } from './privacy'
import { terms } from './terms'
import type { LegalDocument } from './types'

const legalDir = dirname(fileURLToPath(import.meta.url))

function source(name: string): string {
  return readFileSync(join(legalDir, name), 'utf8')
}

function prose(document: LegalDocument): string {
  return document.sections.flatMap((section) => [section.heading, ...section.paragraphs]).join('\n')
}

describe('legal documents', () => {
  it('marks each draft for owner review and shares the version', () => {
    for (const name of ['privacy.ts', 'terms.ts', 'acceptable-use.ts']) {
      expect(source(name).replace(/\r\n/g, '\n').startsWith('// OWNER REVIEW REQUIRED before publish\n')).toBe(true)
    }

    for (const document of [privacy, terms, acceptableUse]) {
      const expected = document === privacy
        ? { version: '2026-11-15', effectiveDate: '15 November 2026' }
        : { version: '2026-11-01', effectiveDate: '1 November 2026' }
      expect(document.version).toBe(expected.version)
      expect(document.effectiveDate).toBe(expected.effectiveDate)
      expect(document.title.length).toBeGreaterThan(0)
      expect(document.sections.length).toBeGreaterThan(0)
      for (const section of document.sections) {
        expect(section.heading.length).toBeGreaterThan(0)
        expect(section.paragraphs.length).toBeGreaterThan(0)
        for (const paragraph of section.paragraphs) {
          expect(paragraph).not.toMatch(/—|–/)
          expect(paragraph.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('covers the privacy bullets without the retired password and wallet claims', () => {
    const text = prose(privacy)
    const required = [
      'Angelo Laus',
      '/contact',
      'data protection officer',
      '@apc.edu.ph',
      '@student.apc.edu.ph',
      'Microsoft',
      'hashed visitor id',
      'rate-limit',
      'event_csv_rows',
      '30 days',
      '180 days',
      'deleted daily',
      '400 days',
      'source app',
      'user agent string itself',
      'cannot link a person across days',
      'Speed samples',
      'guest ticket link',
      'name and email address stay on them',
      'Cloudflare',
      'Turso',
      'Resend',
      'Google Wallet',
      'outside the Philippines',
      'National Privacy Commission',
      'Republic Act No. 10173',
      'access',
      'correction',
      'erasure',
      'portability',
      'objection',
      'Form inputs',
      'stay in the browser',
      'active_org_id',
      '__Host-eypi_session',
      'eypi_session in development',
      'strictly necessary',
      'cookie banner',
    ]

    for (const phrase of required) {
      expect(text, phrase).toContain(phrase)
    }

    expect(text).not.toMatch(/bcrypt/i)
    expect(text).not.toMatch(/argon2/i)
    expect(text).not.toMatch(/apple wallet/i)
  })
})
