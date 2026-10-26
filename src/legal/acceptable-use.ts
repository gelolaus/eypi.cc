// OWNER REVIEW REQUIRED before publish
import type { LegalDocument } from './types'

export const acceptableUse: LegalDocument = {
  version: '2026-11-01',
  title: 'Acceptable use',
  effectiveDate: '1 November 2026',
  sections: [
    {
      heading: 'Scope',
      paragraphs: [
        'These rules apply to links, organizations, Tix, frames, forms, and every other part of eypi.cc.',
      ],
    },
    {
      heading: 'Prohibited use',
      paragraphs: [
        'Do not point a short link at malware, phishing, or a page built to steal credentials. Do not publish content that breaks Philippine law. Do not infringe intellectual property that belongs to someone else.',
        'Do not upload attendee lists, frame images, logos, or organization material unless you have permission to use them on eypi.cc. Do not probe, overload, or bypass rate limits, access controls, or another account.',
      ],
    },
    {
      heading: 'Reports',
      paragraphs: [
        'Anyone can report a link at /report. Choose a reason. Do not use the report form to harass a person.',
      ],
    },
    {
      heading: 'Enforcement',
      paragraphs: [
        'eypi.cc may remove content, disable a link, or end access for a person who breaks these rules. When the law requires it, abuse may be referred to Asia Pacific College or to a competent authority.',
      ],
    },
  ],
}
