export type LegalSection = {
  heading: string
  paragraphs: string[]
}

export type LegalDocument = {
  version: string
  title: string
  effectiveDate: string
  sections: LegalSection[]
}
