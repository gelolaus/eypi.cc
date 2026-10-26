export const LEGAL_VERSIONS = {
  privacy: '2026-11-01',
  terms: '2026-11-01',
  'acceptable-use': '2026-11-01',
} as const

export type LegalDocument = keyof typeof LEGAL_VERSIONS

const DOCUMENTS = new Set<string>(Object.keys(LEGAL_VERSIONS))

export function isLegalDocument(value: unknown): value is LegalDocument {
  return typeof value === 'string' && DOCUMENTS.has(value)
}
