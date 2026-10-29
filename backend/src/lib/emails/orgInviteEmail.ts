import { Resend } from 'resend'
import {
  emailButton,
  emailFallbackLink,
  emailFootnote,
  emailHeading,
  emailParagraph,
  emailPill,
  emailStrong,
  escapeHtml,
  renderEmailShell,
} from './emailLayout'

export const ORG_INVITE_FROM = 'Eypi <invites@eypi.cc>'
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
  const subject = `Eypi | You're invited to join ${input.orgName}`
  const inviter = escapeHtml(input.inviterName)
  const org = escapeHtml(input.orgName)
  const url = escapeHtml(input.inviteUrl)
  const html = renderEmailShell({
    title: subject,
    preheader: `${inviter} invited you to join ${org}.`,
    body: [
      emailHeading(`You're invited to join ${org}`),
      emailParagraph(`${emailStrong(inviter)} invited you to join ${emailPill(org)} on Eypi.`),
      `<div style="padding:24px 0 16px;">${emailButton('Review invites', url)}</div>`,
    ].join(''),
    footer: [
      emailFootnote("If you weren't expecting this, you can ignore this email."),
      emailFallbackLink(url),
    ].join(''),
  })
  const text = [
    `${input.inviterName} invited you to join ${input.orgName} on Eypi.`,
    '',
    `Review invites: ${input.inviteUrl}`,
    '',
    "If you weren't expecting this, you can ignore this email.",
  ].join('\n')
  return { subject, html, text }
}
