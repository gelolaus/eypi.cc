import DOMPurify from 'dompurify'

/**
 * Event descriptions arrive as server-rendered, already sanitized HTML. This is the second pass:
 * links keep `target` but always get `rel="noopener nofollow ugc"`.
 */
export function sanitizeEventHtml(html: string | null | undefined): string {
  if (!html) return ''
  const hook = (node: Element) => {
    if (node.tagName === 'A') node.setAttribute('rel', 'noopener nofollow ugc')
  }
  DOMPurify.addHook('afterSanitizeAttributes', hook)
  try {
    return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] })
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes', hook)
  }
}
