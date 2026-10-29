import { beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.hoisted(() => vi.fn())

vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
  },
}))

import { deliverOrgInviteEmail, renderOrgInviteEmail } from './orgInviteEmail'

const base = {
  orgName: 'Alpha Org',
  inviterName: 'Ada Owner',
  inviteUrl: 'https://eypi.cc/invites',
}

describe('renderOrgInviteEmail', () => {
  it('uses the invite subject and a CTA to the invites inbox', () => {
    const rendered = renderOrgInviteEmail(base)

    expect(rendered.subject).toBe("You're invited to join Alpha Org on Eypi")
    expect(rendered.html).toContain('href="https://eypi.cc/invites"')
    expect(rendered.text).toContain('https://eypi.cc/invites')
    expect(rendered.text).toContain('Ada Owner')
    expect(rendered.text).toContain('Alpha Org')
  })

  it('renders a branded, email-client-safe layout', () => {
    const rendered = renderOrgInviteEmail(base)

    expect(rendered.html).toContain('<!doctype html>')
    expect(rendered.html).toContain('width="100%"')
    expect(rendered.html).toContain('#35438c')
    expect(rendered.html).toContain('Review invites</a>')
    expect(rendered.html).toContain('color-scheme')
    expect(rendered.html).not.toMatch(/<(script|style|link)\b[^>]*(src|href)=/i)
  })

  it('shows the Eypi mascot and name, never the eypi.cc brand text', () => {
    const rendered = renderOrgInviteEmail(base)

    expect(rendered.html).toContain('<img src="https://eypi.cc/eypi-mark.png"')
    expect(rendered.html).toContain('alt="Eypi"')
    expect(rendered.html).toContain('>Eypi</')
    expect(rendered.html).not.toContain('>eypi.cc<')
    expect(rendered.html).not.toMatch(/on eypi\.cc/)
    expect(rendered.text).not.toMatch(/on eypi\.cc/)
  })

  it('has no accent bars across the top of the card', () => {
    const rendered = renderOrgInviteEmail(base)

    expect(rendered.html).not.toContain('height:6px')
    expect(rendered.html).not.toContain('height:3px')
    expect(rendered.html).not.toContain('#deac4b')
  })

  it('shows the org as a card with its initial and the inviter', () => {
    const rendered = renderOrgInviteEmail(base)

    expect(rendered.html).toContain('#f7ead2')
    expect(rendered.html).toContain('>A</td>')
    expect(rendered.html).toContain('>Alpha Org</')
    expect(rendered.html).toContain('Invited by')
    expect(rendered.html).toContain('>Ada Owner</')
  })

  it('uses the first character of the org name as the initial, escaped', () => {
    expect(renderOrgInviteEmail({ ...base, orgName: 'beta club' }).html).toContain('>B</td>')
    expect(renderOrgInviteEmail({ ...base, orgName: '<b>x' }).html).toContain('>&lt;</td>')
    expect(renderOrgInviteEmail({ ...base, orgName: '   ' }).html).toContain('>E</td>')
  })

  it('explains why the recipient got the email', () => {
    const rendered = renderOrgInviteEmail(base)

    expect(rendered.html).toContain('You received this because Ada Owner invited you on Eypi.')
    expect(rendered.html).toContain("If you weren't expecting this, you can ignore this email.")
  })

  it('keeps the plain-text part readable', () => {
    const rendered = renderOrgInviteEmail(base)

    expect(rendered.text).toBe(
      [
        'Ada Owner invited you to join Alpha Org on Eypi.',
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
    expect(rendered.subject).toBe("You're invited to join <script>alert(1)</script> on Eypi")
  })
})

describe('deliverOrgInviteEmail', () => {
  beforeEach(() => {
    send.mockReset()
    send.mockResolvedValue({ data: { id: 'email_1' }, error: null })
  })

  const input = { apiKey: 'key', to: 'new@apc.edu.ph', orgName: 'Alpha Org', inviterName: 'Ada Owner' }

  it('sends from invites@eypi.cc and sets the reply-to when one is given', async () => {
    await deliverOrgInviteEmail({ ...input, replyTo: 'owner@example.test' })

    const payload = send.mock.calls[0][0] as { from: string; replyTo?: string }
    expect(payload.from).toBe('Eypi <invites@eypi.cc>')
    expect(payload.replyTo).toBe('owner@example.test')
  })

  it('omits the reply-to when none is configured or the value is blank', async () => {
    await deliverOrgInviteEmail(input)
    await deliverOrgInviteEmail({ ...input, replyTo: '  ' })

    for (const call of send.mock.calls) {
      expect(call[0]).not.toHaveProperty('replyTo')
    }
  })
})
