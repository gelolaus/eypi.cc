/**
 * Markdown (or markup-looking text) to a single plain-text line for share previews.
 * The result is not HTML: callers must still escape it for the context they put it in.
 */
export function markdownToPlainText(markdown: string | null | undefined, maxLength = 200): string {
  let text = String(markdown ?? '').replace(/\r\n?/g, '\n')
  text = text
    .replace(/```[^\n]*\n?/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  // Repeat so nested or split tags such as "<scr<b>ipt>" cannot reassemble after one pass.
  for (let before = ''; before !== text;) {
    before = text
    text = text.replace(/<[^<>]*>/g, ' ')
  }
  text = text
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d{1,9}[.)])\s+/gm, '')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}
