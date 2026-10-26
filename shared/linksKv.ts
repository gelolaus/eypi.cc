export type LinkKvEntry = {
  id: string
  url: string
  exp?: number
  pw?: boolean
}

export function encodeLinkKv(entry: LinkKvEntry): string {
  const payload: { v: 2; id: string; url: string; exp?: number; pw?: 1 } = {
    v: 2,
    id: entry.id,
    url: entry.url,
  }
  if (entry.exp !== undefined) payload.exp = entry.exp
  if (entry.pw) payload.pw = 1
  return JSON.stringify(payload)
}

export function decodeLinkKv(raw: string | null): LinkKvEntry | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as {
      id?: unknown
      url?: unknown
      exp?: unknown
      pw?: unknown
    }
    if (typeof parsed.id !== 'string' || typeof parsed.url !== 'string') return null
    const entry: LinkKvEntry = { id: parsed.id, url: parsed.url }
    if (typeof parsed.exp === 'number' && Number.isFinite(parsed.exp)) entry.exp = parsed.exp
    if (parsed.pw === true || parsed.pw === 1) entry.pw = true
    return entry
  } catch {
    return null
  }
}

export function encodeLinkKvEntry(entry: LinkKvEntry): string {
  return encodeLinkKv(entry)
}

export function decodeLinkKvEntry(raw: string | null): LinkKvEntry | null {
  return decodeLinkKv(raw)
}
