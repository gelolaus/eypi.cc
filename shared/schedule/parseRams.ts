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
