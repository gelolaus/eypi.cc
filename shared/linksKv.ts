export type LinkKvEntry = { id: string; url: string }

export function encodeLinkKvEntry(entry: LinkKvEntry): string {
  return JSON.stringify(entry)
}

export function decodeLinkKvEntry(raw: string | null): LinkKvEntry | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as LinkKvEntry
    if (typeof parsed.id === 'string' && typeof parsed.url === 'string') return parsed
  } catch {
    /* invalid */
  }
  return null
}
