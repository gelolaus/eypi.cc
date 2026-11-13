import { Resend } from 'resend'
import { ORG_INVITE_FROM } from './orgInviteEmail'
import {
  emailButton,
  emailFootnote,
  emailHeading,
  emailParagraph,
  escapeHtml,
  renderEmailShell,
} from './emailLayout'

export const JOIN_URL = 'https://eypi.cc/login'

export type FramePreviewEmail = {
  subject: string
  html: string
  text: string
}

export function renderFramePreviewEmail(input: { campaignTitle: string }): FramePreviewEmail {
  const title = escapeHtml(input.campaignTitle)
  const subject = `Your ${input.campaignTitle} photo from Eypi`
  const html = renderEmailShell({
    title: subject,
    preheader: `Your ${title} photo is attached.`,
    body: [
      emailHeading(`Your ${title} photo`),
      emailParagraph('Thanks for stopping by. Your photo is attached to this email.'),
      emailParagraph('Join Eypi.cc by registering today.'),
      `<div style="padding:8px 0 16px;">${emailButton('Join Eypi.cc', JOIN_URL)}</div>`,
    ].join(''),
    footer: [
      emailFootnote('You received this because you entered your email to get your photo from an Eypi frame.'),
      emailFootnote("If you weren't expecting this, you can ignore this email."),
    ].join(''),
  })
  const text = [
    `Your ${input.campaignTitle} photo is attached.`,
    '',
    `Join Eypi.cc by registering today: ${JOIN_URL}`,
    '',
    "If you weren't expecting this, you can ignore this email.",
  ].join('\n')
  return { subject, html, text }
}

/** Sends the rendered PNG from the same sender as invites. Returns false on any failure. */
export async function deliverFramePreviewEmail(input: {
  apiKey: string
  to: string
  campaignTitle: string
  png: Uint8Array
  replyTo?: string
}): Promise<boolean> {
  const rendered = renderFramePreviewEmail({ campaignTitle: input.campaignTitle })
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
      attachments: [{ filename: 'eypi-photo.png', content: Buffer.from(input.png) }],
    })
    return result.error == null
  } catch {
    return false
  }
}
