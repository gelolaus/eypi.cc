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
  const inviter = escapeHtml(input.inviterName)
  const org = escapeHtml(input.orgName)
  const url = escapeHtml(input.inviteUrl)
  const font = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
  const html = [
    '<!doctype html>',
    '<html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="color-scheme" content="light">',
    '<meta name="supported-color-schemes" content="light">',
    `<title>${escapeHtml(subject)}</title>`,
    '</head>',
    `<body style="margin:0;padding:0;background:#f5f5f5;font-family:${font};color:#0a0a0a;">`,
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${inviter} invited you to join ${org}.</div>`,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;">',
    '<tr><td align="center" style="padding:32px 16px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e2e2;border-radius:14px;">',
    '<tr><td style="height:6px;background:#35438c;border-radius:14px 14px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>',
    '<tr><td style="padding:32px 32px 8px;">',
    `<p style="margin:0 0 24px;font-family:${font};font-size:18px;font-weight:700;color:#35438c;">eypi.cc</p>`,
    `<h1 style="margin:0 0 12px;font-family:${font};font-size:22px;line-height:1.3;font-weight:700;color:#0a0a0a;">You're invited to join ${org}</h1>`,
    `<p style="margin:0;font-family:${font};font-size:16px;line-height:1.5;color:#5c5c5c;"><strong style="color:#0a0a0a;">${inviter}</strong> invited you to join <strong style="color:#0a0a0a;">${org}</strong> on eypi.cc.</p>`,
    '</td></tr>',
    '<tr><td style="padding:24px 32px 32px;">',
    `<a href="${url}" style="display:inline-block;padding:12px 24px;background:#35438c;color:#ffffff;font-family:${font};font-size:16px;font-weight:600;text-decoration:none;border-radius:10px;">Review invites</a>`,
    '</td></tr>',
    '<tr><td style="padding:16px 32px;border-top:1px solid #e2e2e2;">',
    `<p style="margin:0;font-family:${font};font-size:13px;line-height:1.5;color:#5c5c5c;">If you weren't expecting this, you can ignore this email.</p>`,
    `<p style="margin:8px 0 0;font-family:${font};font-size:13px;line-height:1.5;color:#5c5c5c;">Button not working? Open <a href="${url}" style="color:#35438c;">${url}</a></p>`,
    '</td></tr>',
    '</table>',
    '</td></tr></table>',
    '</body></html>',
  ].join('')
  const text = [
    `${input.inviterName} invited you to join ${input.orgName} on eypi.cc.`,
    '',
    `Review invites: ${input.inviteUrl}`,
    '',
    "If you weren't expecting this, you can ignore this email.",
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
