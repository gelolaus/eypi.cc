import { Resend } from 'resend'

export const ORG_INVITE_FROM = 'eypi.cc <invites@eypi.cc>'
export const ORG_INVITE_URL = 'https://eypi.cc/invites'

export type OrgInviteEmail = {
  subject: string
  html: string
  text: string
}

export async function deliverOrgInviteEmail(input: {
  apiKey: string
  to: string
  orgName: string
  inviterName: string
}): Promise<boolean> {
  const rendered = renderOrgInviteEmail({
    orgName: input.orgName,
    inviterName: input.inviterName,
    inviteUrl: ORG_INVITE_URL,
  })
  try {
    const resend = new Resend(input.apiKey)
    const result = await resend.emails.send({
      from: ORG_INVITE_FROM,
      to: input.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })
    return result.error == null
  } catch {
    return false
  }
}

export function renderOrgInviteEmail(input: {
  orgName: string
  inviterName: string
  inviteUrl: string
}): OrgInviteEmail {
  const subject = `You're invited to join ${input.orgName} on eypi.cc`
  const html = [
    '<p>',
    escapeHtml(input.inviterName),
    ' invited you to join ',
    escapeHtml(input.orgName),
    ' on eypi.cc.</p>',
    '<p><a href="',
    escapeHtml(input.inviteUrl),
    '">Review invites</a></p>',
  ].join('')
  const text = [
    `${input.inviterName} invited you to join ${input.orgName} on eypi.cc.`,
    '',
    input.inviteUrl,
  ].join('\n')
  return { subject, html, text }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
