import { Resend } from 'resend'
import {
  emailButton,
  emailFallbackLink,
  emailFootnote,
  emailHeading,
  emailInfoCard,
  emailParagraph,
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
  replyTo?: string
}): Promise<boolean> {
  const rendered = renderOrgInviteEmail({
    orgName: input.orgName,
    inviterName: input.inviterName,
    inviteUrl: ORG_INVITE_URL,
  })
  const replyTo = input.replyTo?.trim()
  try {
    const resend = new Resend(input.apiKey)
    const result = await resend.emails.send({
      from: ORG_INVITE_FROM,
      to: input.to,
      ...(replyTo ? { replyTo } : {}),
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
  const subject = `You're invited to join ${input.orgName} on Eypi`
  const inviter = escapeHtml(input.inviterName)
  const org = escapeHtml(input.orgName)
  const url = escapeHtml(input.inviteUrl)
  const initial = escapeHtml(([...input.orgName.trim()][0] ?? 'E').toUpperCase())
  const html = renderEmailShell({
    title: subject,
    preheader: `${inviter} invited you to join ${org}.`,
    body: [
      emailHeading(`You're invited to join ${org}`),
      emailParagraph('Accept or decline it from your invites.'),
      `<div style="padding:24px 0 0;">${emailInfoCard({
        initial,
        title: org,
        subtitleHtml: `Invited by ${emailStrong(inviter)}`,
      })}</div>`,
      `<div style="padding:24px 0 16px;">${emailButton('Review invites', url)}</div>`,
    ].join(''),
    footer: [
      emailFootnote(`You received this because ${inviter} invited you on Eypi.`),
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
