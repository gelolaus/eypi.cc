import { describe, expect, it } from 'vitest'
import { renderOrgInviteEmail } from './orgInviteEmail'

describe('renderOrgInviteEmail', () => {
  it('uses the invite subject and a CTA to the invites inbox', () => {
    const rendered = renderOrgInviteEmail({
      orgName: 'Alpha Org',
      inviterName: 'Ada Owner',
      inviteUrl: 'https://eypi.cc/invites',
    })

    expect(rendered.subject).toBe("You're invited to join Alpha Org on eypi.cc")
    expect(rendered.html).toContain('href="https://eypi.cc/invites"')
    expect(rendered.text).toContain('https://eypi.cc/invites')
    expect(rendered.text).toContain('Ada Owner')
    expect(rendered.text).toContain('Alpha Org')
  })

  it('renders a branded, email-client-safe layout', () => {
    const rendered = renderOrgInviteEmail({
      orgName: 'Alpha Org',
      inviterName: 'Ada Owner',
      inviteUrl: 'https://eypi.cc/invites',
    })

    expect(rendered.html).toContain('<!doctype html>')
    expect(rendered.html).toContain('width="100%"')
    expect(rendered.html).toContain('#35438c')
    expect(rendered.html).toContain('Review invites</a>')
    expect(rendered.html).toContain('color-scheme')
    expect(rendered.html).not.toMatch(/<(script|style|link)\b[^>]*(src|href)=/i)
  })

  it('keeps the plain-text part readable', () => {
    const rendered = renderOrgInviteEmail({
      orgName: 'Alpha Org',
      inviterName: 'Ada Owner',
      inviteUrl: 'https://eypi.cc/invites',
    })

    expect(rendered.text).toBe(
      [
        'Ada Owner invited you to join Alpha Org on eypi.cc.',
        '',
        'Review invites: https://eypi.cc/invites',
        '',
        "If you weren't expecting this, you can ignore this email.",
      ].join('\n'),
    )
  })

  it('escapes a script tag in the org name inside the HTML', () => {
    const rendered = renderOrgInviteEmail({
      orgName: '<script>alert(1)</script>',
      inviterName: 'Ada <b>Owner</b>',
      inviteUrl: 'https://eypi.cc/invites',
    })

    expect(rendered.html).not.toContain('<script>')
    expect(rendered.html).not.toContain('<b>')
    expect(rendered.html).toContain('&lt;script&gt;')
    expect(rendered.html).toContain('&lt;b&gt;')
    expect(rendered.subject).toBe("You're invited to join <script>alert(1)</script> on eypi.cc")
  })
})
