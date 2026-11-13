import { Resend } from 'resend'
import { ORG_INVITE_FROM } from './orgInviteEmail'
import {
  emailFootnote,
  emailHeading,
  emailParagraph,
  escapeHtml,
  renderEmailShell,
} from './emailLayout'

export type FramePreviewEmail = {
  subject: string
  html: string
  text: string
}

export function renderFramePreviewEmail(input: { campaignTitle: string }): FramePreviewEmail {
  const title = escapeHtml(input.campaignTitle)
  const subject = `Your ${input.campaignTitle} preview from Eypi`
  const html = renderEmailShell({
    title: subject,
    preheader: `Your ${title} preview is attached.`,
    body: [
      emailHeading(`Your ${title} preview`),
      emailParagraph('The image you just made is attached to this email.'),
    ].join(''),
    footer: [
      emailFootnote('You received this because you tested a frame in admin preview on Eypi.'),
      emailFootnote("If you weren't expecting this, you can ignore this email."),
    ].join(''),
  })
  const text = [
    `Your ${input.campaignTitle} preview is attached.`,
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
      attachments: [{ filename: 'eypi-preview.png', content: Buffer.from(input.png) }],
    })
    return result.error == null
  } catch {
    return false
  }
}
