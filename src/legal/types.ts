export type LegalSection = {
  heading: string
  paragraphs: string[]
}

export type LegalDocument = {
  version: '2026-11-01'
  title: string
  effectiveDate: '1 November 2026'
  sections: LegalSection[]
}
