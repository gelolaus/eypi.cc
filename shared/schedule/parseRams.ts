export const MAX_PASTE_LENGTH = 100_000

/** CRLF to LF, non-breaking spaces and tabs to spaces, each line trimmed, blank lines dropped. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[\xa0\t]/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

const TERM_LINE = /Academic Year\s*&\s*Term:\s*(\d{4})\s*-\s*(\d{4})\s*,\s*Term\s*(\d)/i

/** The term from the "Academic Year & Term:" line, as `2026-2027 · Term 2`, or null when it is not there. */
export function parseTerm(text: string): string | null {
  const match = TERM_LINE.exec(text)
  return match ? `${match[1]}-${match[2]} · Term ${match[3]}` : null
}

export type RawRow = { code: string; section: string; units: number; lines: string[] }

/** A row starts where a subject code, a section and the units sit on one line, like `MIKE1 AB101 3.0`. */
const ROW_START = /^([A-Z][A-Z0-9]{2,9})\s+([A-Z0-9][A-Z0-9/-]*)\s+(\d+\.\d)\b/

/** Splits normalized text into subject rows. A row runs to the next row start or to the `Total Units` line. */
export function splitRows(normalized: string): RawRow[] {
  const rows: RawRow[] = []
  let current: RawRow | null = null
  for (const line of normalized.split('\n')) {
    const start = ROW_START.exec(line)
    if (start) {
      current = { code: start[1], section: start[2], units: Number(start[3]), lines: [] }
      rows.push(current)
    } else if (/^Total Units\b/i.test(line)) {
      current = null
    } else if (current) {
      current.lines.push(line)
    }
  }
  return rows
}
