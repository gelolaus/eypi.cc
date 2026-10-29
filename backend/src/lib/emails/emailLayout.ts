export const EMAIL_LOGO_URL = 'https://eypi.cc/eypi-mark.png'

const color = {
  background: '#f5f5f5',
  foreground: '#0a0a0a',
  muted: '#5c5c5c',
  border: '#e2e2e2',
  primary: '#35438c',
  gold: '#deac4b',
  goldWash: '#f7ead2',
}

export const emailFont = {
  sans: "'Plus Jakarta Sans',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  heading: "Syne,'Plus Jakarta Sans',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  mono: "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace",
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function emailHeading(html: string): string {
  return `<h1 style="margin:0 0 12px;font-family:${emailFont.heading};font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;color:${color.foreground};">${html}</h1>`
}

export function emailParagraph(html: string): string {
  return `<p style="margin:0;font-family:${emailFont.sans};font-size:16px;line-height:1.6;color:${color.muted};">${html}</p>`
}

export function emailStrong(html: string): string {
  return `<strong style="color:${color.foreground};font-weight:600;">${html}</strong>`
}

export function emailPill(html: string): string {
  return `<span style="display:inline-block;padding:4px 12px;background:${color.goldWash};border-radius:999px;font-family:${emailFont.sans};font-size:14px;font-weight:600;color:${color.foreground};">${html}</span>`
}

export function emailButton(label: string, href: string): string {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
    `<td style="background:${color.primary};border-radius:12px;">`,
    `<a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${emailFont.sans};font-size:16px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">${label}</a>`,
    '</td></tr></table>',
  ].join('')
}

export function emailFallbackLink(href: string): string {
  return `<p style="margin:8px 0 0;font-family:${emailFont.sans};font-size:13px;line-height:1.5;color:${color.muted};">Button not working? Open <a href="${href}" style="font-family:${emailFont.mono};font-size:12px;color:${color.primary};word-break:break-all;">${href}</a></p>`
}

export function emailFootnote(html: string): string {
  return `<p style="margin:0;font-family:${emailFont.sans};font-size:13px;line-height:1.5;color:${color.muted};">${html}</p>`
}

/** Eypi-branded shell: mascot + name header, blue and gold bars, white card on the page grey. */
export function renderEmailShell(input: {
  title: string
  preheader: string
  body: string
  footer: string
}): string {
  return [
    '<!doctype html>',
    '<html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<meta name="color-scheme" content="light">',
    '<meta name="supported-color-schemes" content="light">',
    `<title>${escapeHtml(input.title)}</title>`,
    '</head>',
    `<body style="margin:0;padding:0;background:${color.background};font-family:${emailFont.sans};color:${color.foreground};">`,
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${input.preheader}</div>`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${color.background};">`,
    '<tr><td align="center" style="padding:32px 16px;">',
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid ${color.border};border-radius:24px;">`,
    `<tr><td style="height:6px;background:${color.primary};border-radius:24px 24px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>`,
    `<tr><td style="height:3px;background:${color.gold};font-size:0;line-height:0;">&nbsp;</td></tr>`,
    '<tr><td style="padding:28px 32px 0;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>',
    `<td style="padding-right:12px;"><img src="${EMAIL_LOGO_URL}" width="40" height="40" alt="Eypi" style="display:block;width:40px;height:40px;border:0;border-radius:10px;"></td>`,
    `<td style="font-family:${emailFont.sans};font-size:22px;line-height:40px;font-weight:600;letter-spacing:-0.01em;color:${color.foreground};">Eypi</td>`,
    '</tr></table>',
    '</td></tr>',
    `<tr><td style="padding:28px 32px 8px;">${input.body}</td></tr>`,
    `<tr><td style="padding:20px 32px 28px;border-top:1px solid ${color.border};">${input.footer}</td></tr>`,
    '</table>',
    '</td></tr></table>',
    '</body></html>',
  ].join('')
}
