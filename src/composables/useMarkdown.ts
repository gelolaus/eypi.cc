import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({
  breaks: true,
  gfm: true,
})

export function renderMarkdown(markdown: string | null | undefined): string {
  if (!markdown?.trim()) return ''
  const raw = marked.parse(markdown, { async: false }) as string
  return DOMPurify.sanitize(raw)
}
