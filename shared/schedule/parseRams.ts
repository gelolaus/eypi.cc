export const MAX_PASTE_LENGTH = 100_000

/** CRLF to LF, non-breaking spaces and tabs to spaces, each line trimmed, blank lines dropped. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}
