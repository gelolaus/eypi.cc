import { describe, it, expect } from 'vitest'
import {
  buildVerifyAccountEmailHtml,
  buildVerifyAccountEmailText,
} from './verifyAccountEmail'

const sample = {
  email: 'student@student.apc.edu.ph',
  verifyUrl: 'https://eypi.cc/verify?token=sample-token-for-preview',
}

describe('buildVerifyAccountEmailHtml', () => {
  it('includes brand colors from the design system', () => {
    const html = buildVerifyAccountEmailHtml(sample)
    expect(html).toContain('#34418F')
    expect(html).toContain('#DEAC4B')
    expect(html).toContain('#F5F5F5')
  })

  it('names the recipient and the product', () => {
    const html = buildVerifyAccountEmailHtml(sample)
    expect(html).toContain(sample.email)
    expect(html).toContain('eypi.cc')
    expect(html).toContain('Verify account')
  })

  it('includes a ignore-if-unexpected safety line', () => {
    const html = buildVerifyAccountEmailHtml(sample)
    expect(html).toContain('If you did not create an eypi.cc account, ignore this email')
  })

  it('escapes HTML in the email address', () => {
    const html = buildVerifyAccountEmailHtml({
      email: 'a<b>@student.apc.edu.ph',
      verifyUrl: sample.verifyUrl,
    })
    expect(html).not.toContain('a<b>')
    expect(html).toContain('a&lt;b&gt;@student.apc.edu.ph')
  })
})

describe('buildVerifyAccountEmailText', () => {
  it('includes the verify URL as plain text', () => {
    const text = buildVerifyAccountEmailText(sample)
    expect(text).toContain(sample.verifyUrl)
    expect(text).toContain(sample.email)
  })
})
