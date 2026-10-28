import { describe, expect, it } from 'vitest'
import { markdownToPlainText } from './plainText'

describe('markdownToPlainText', () => {
  it('strips markdown and html', () => {
    expect(markdownToPlainText('# Hi\n\n**Join** us [here](https://x.test) <b>now</b>\n- one\n- two')).toBe('Hi Join us here now one two')
  })
  it('drops images and nested tags', () => {
    expect(markdownToPlainText('![x](https://a.test/p.png) a <scr<b>ipt>alert(1)</scr</b>ipt> b')).not.toMatch(/[<>]/)
  })
  it('truncates with an ellipsis', () => {
    const out = markdownToPlainText('word '.repeat(100))
    expect(out.length).toBeLessThanOrEqual(200)
    expect(out.endsWith('…')).toBe(true)
  })
  it('handles null', () => {
    expect(markdownToPlainText(null)).toBe('')
  })
})
