/**
 * Server-side Markdown to HTML for public event descriptions.
 *
 * The Worker has no DOM, so DOMPurify is not available. Instead of sanitising marked's
 * output, this renderer is safe by construction: every character of input is HTML-escaped
 * before any tag is emitted, and the only tags it can emit are the allowlist below.
 * Raw HTML in the source is shown as text, images are dropped, and links must be
 * http(s) or mailto.
 *
 * Supported: paragraphs, line breaks, #-####, **bold**, *italic*, `code`, fenced code,
 * flat bullet and numbered lists, > quotes, [text](url).
 * Limits: no nested lists or tables, and a link URL ends at the first `)`.
 */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (ch) => ESCAPES[ch])

const SAFE_URL = /^(?:https?:\/\/[^\s<>"'`]+|mailto:[^\s<>"'`]+)$/i
const INLINE = /!\[[^\]\n]*\]\([^)\n]*\)|`([^`\n]+)`|\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"[^"\n]*")?\)/g

function emphasis(escaped: string): string {
  return escaped
    .replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__([^_\n]+?)__(?=[^\w]|$)/g, '$1<strong>$2</strong>')
    .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_([^_\n]+?)_(?=[^\w]|$)/g, '$1<em>$2</em>')
}

function inline(source: string): string {
  let out = ''
  let last = 0
  for (const match of source.matchAll(INLINE)) {
    out += emphasis(escapeHtml(source.slice(last, match.index)))
    last = match.index + match[0].length
    if (match[0].startsWith('!')) continue
    if (match[1] !== undefined) {
      out += `<code>${escapeHtml(match[1])}</code>`
    } else if (SAFE_URL.test(match[3])) {
      out += `<a href="${escapeHtml(match[3])}" rel="noopener nofollow ugc" target="_blank">${emphasis(escapeHtml(match[2]))}</a>`
    } else {
      out += emphasis(escapeHtml(match[2]))
    }
  }
  return out + emphasis(escapeHtml(source.slice(last)))
}

const HEADING = /^(#{1,6})[ \t]+(.+)$/
const BULLET = /^\s*[-*+]\s+(.*)$/
const NUMBERED = /^\s*\d{1,9}[.)]\s+(.*)$/
const FENCE = /^\s*```/

function blocks(lines: string[], depth: number): string {
  const html: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    if (FENCE.test(line)) {
      const code: string[] = []
      i++
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++])
      i++
      html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`)
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      const level = Math.min(heading[1].length, 4)
      const title = heading[2].trim().replace(/[ \t]+#+$/, '')
      html.push(`<h${level}>${inline(title)}</h${level}>`)
      i++
      continue
    }
    if (/^\s*>/.test(line)) {
      const quoted: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) quoted.push(lines[i++].replace(/^\s*>\s?/, ''))
      // Depth cap keeps pathological "> > > >" input from recursing without bound.
      html.push(`<blockquote>${depth < 3 ? blocks(quoted, depth + 1) : inline(quoted.join(' '))}</blockquote>`)
      continue
    }
    const listPattern = BULLET.test(line) ? BULLET : NUMBERED.test(line) ? NUMBERED : null
    if (listPattern) {
      const tag = listPattern === BULLET ? 'ul' : 'ol'
      const items: string[] = []
      while (i < lines.length) {
        const item = listPattern.exec(lines[i])
        if (!item) break
        items.push(`<li>${inline(item[1])}</li>`)
        i++
      }
      html.push(`<${tag}>${items.join('')}</${tag}>`)
      continue
    }
    const paragraph: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() &&
      !FENCE.test(lines[i]) &&
      !HEADING.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !BULLET.test(lines[i]) &&
      !NUMBERED.test(lines[i])
    ) {
      paragraph.push(inline(lines[i++].trim()))
    }
    html.push(`<p>${paragraph.join('<br>')}</p>`)
  }
  return html.join('')
}

export function renderEventMarkdown(markdown: string | null | undefined): string {
  if (!markdown?.trim()) return ''
  return blocks(markdown.replace(/\r\n?/g, '\n').split('\n'), 0)
}
