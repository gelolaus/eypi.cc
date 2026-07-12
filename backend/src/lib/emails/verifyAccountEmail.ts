export type VerifyAccountEmailInput = {
  verifyUrl: string
  email: string
}

/** APC / gelolaus tokens from DESIGN_SYSTEM.md (inline hex required for email clients). */
const C = {
  bg: '#F5F5F5',
  surface: '#ffffff',
  border: '#E8E8E8',
  text: '#0A0A0A',
  muted: '#6B6B6B',
  primary: '#34418F',
  accent: '#DEAC4B',
} as const

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

/**
 * Verification email HTML for Resend.
 * Table layout for Outlook / Microsoft 365 (APC campus mail).
 */
export function buildVerifyAccountEmailHtml(input: VerifyAccountEmailInput): string {
  const { verifyUrl, email } = input
  const safeEmail = escapeHtml(email)
  const safeUrl = escapeHtml(verifyUrl)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>Verify your eypi.cc account</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.bg};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:${C.surface};border:1px solid ${C.border};border-radius:16px;">
          <tr>
            <td style="padding:36px 32px 28px 32px;font-family:${FONT};">
              <p style="margin:0 0 28px 0;font-size:22px;font-weight:700;line-height:1.2;color:${C.primary};letter-spacing:-0.02em;">
                eypi.cc
              </p>
              <h1 style="margin:0 0 12px 0;font-size:20px;font-weight:700;line-height:1.3;color:${C.text};">
                Verify your account
              </h1>
              <p style="margin:0 0 8px 0;font-size:15px;line-height:1.55;color:${C.text};">
                We received a registration for <strong style="font-weight:600;">${safeEmail}</strong> on eypi.cc, the APC campus URL shortener and org tools suite.
              </p>
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.55;color:${C.muted};">
                You cannot log in until you verify. Use the button below. The link works once.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px 0;">
                <tr>
                  <td align="center" bgcolor="${C.accent}" style="border-radius:8px;">
                    <a href="${safeUrl}"
                       style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:14px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Verify account
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:${C.muted};">
                Button not working? Paste this link into your browser:
              </p>
              <p style="margin:0 0 28px 0;font-size:13px;line-height:1.5;word-break:break-all;">
                <a href="${safeUrl}" style="color:${C.primary};text-decoration:underline;">${safeUrl}</a>
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.border};">
                <tr>
                  <td style="padding-top:20px;font-family:${FONT};">
                    <p style="margin:0 0 8px 0;font-size:12px;line-height:1.5;color:${C.muted};">
                      If you did not create an eypi.cc account, ignore this email. No account will be activated.
                    </p>
                    <p style="margin:0;font-size:12px;line-height:1.5;color:${C.muted};">
                      Sender: eypicc@resend.gelolaus.com · Product: eypi.cc
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildVerifyAccountEmailText(input: VerifyAccountEmailInput): string {
  const { verifyUrl, email } = input
  return [
    'eypi.cc',
    '',
    'Verify your account',
    '',
    `We received a registration for ${email} on eypi.cc, the APC campus URL shortener and org tools suite.`,
    '',
    'You cannot log in until you verify. Open this link (it works once):',
    verifyUrl,
    '',
    'If you did not create an eypi.cc account, ignore this email. No account will be activated.',
    '',
    'Sender: eypicc@resend.gelolaus.com',
  ].join('\n')
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
