import { describe, expect, it } from 'vitest'
import { renderEventMarkdown } from './markdownHtml'

describe('renderEventMarkdown', () => {
  it('renders the allowed formatting', () => {
    const html = renderEventMarkdown('# Title\n\nHello **bold** and *em* and `code`\nnext line\n\n- a\n- b\n\n1. one\n2. two\n\n> quoted')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>em</em>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<br>')
    expect(html).toContain('<ul><li>a</li><li>b</li></ul>')
    expect(html).toContain('<ol><li>one</li><li>two</li></ol>')
    expect(html).toContain('<blockquote>')
  })

  it('returns an empty string for empty input', () => {
    expect(renderEventMarkdown(null)).toBe('')
    expect(renderEventMarkdown('  \n ')).toBe('')
  })

  it('escapes plain text', () => {
    expect(renderEventMarkdown('Tom & "Jerry" <3')).toBe('<p>Tom &amp; &quot;Jerry&quot; &lt;3</p>')
  })

  it('adds safe attributes to http, https and mailto links only', () => {
    const html = renderEventMarkdown('[a](https://x.test/p?a=1&b=2) [m](mailto:a@b.test)')
    expect(html).toContain('<a href="https://x.test/p?a=1&amp;b=2" rel="noopener nofollow ugc" target="_blank">a</a>')
    expect(html).toContain('href="mailto:a@b.test"')
  })

  const vectors: Array<[string, string]> = [
    ['script tag', 'hi <script>alert(1)</script>'],
    ['img onerror', '<img src=x onerror=alert(1)>'],
    ['javascript link', '[x](javascript:alert(1))'],
    ['mixed case javascript', '[x](JaVaScRiPt:alert(1))'],
    ['entity scheme', '[x](java&#115;cript:alert(1))'],
    ['tab scheme', '[x](java\tscript:alert(1))'],
    ['data link', '[x](data:text/html;base64,PHNjcmlwdD4=)'],
    ['svg', '<svg onload=alert(1)><circle/></svg>'],
    ['iframe', '<iframe src="https://evil.test"></iframe>'],
    ['style', '<style>body{display:none}</style>'],
    ['nested malformed', '<scr<script>ipt>alert(1)</scr</script>ipt>'],
    ['attribute breakout', '[x](https://a.test" onmouseover="alert(1))'],
    ['markdown image', '![x](https://evil.test/p.png)'],
    ['html autolink', '<a href="javascript:alert(1)">x</a>'],
  ]
  for (const [name, input] of vectors) {
    it(`neutralises ${name}`, () => {
      const html = renderEventMarkdown(input)
      expect(html).not.toMatch(/<(script|img|svg|iframe|style|scr)/i)
      expect(html).not.toMatch(/<a[^>]*(javascript|data):/i)
      expect(html).not.toMatch(/<[^>]*\son\w+=/i)
      // Every tag in the output is on the allowlist and carries no stray attributes.
      for (const tag of html.matchAll(/<\/?([a-z0-9]+)([^>]*)>/gi)) {
        expect(['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre']).toContain(tag[1])
        if (tag[1] !== 'a') expect(tag[2]).toBe('')
      }
    })
  }
})
