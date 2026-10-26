// OWNER REVIEW REQUIRED before publish
import type { LegalDocument } from './types'

export const privacy: LegalDocument = {
  version: '2026-11-01',
  title: 'Privacy policy',
  effectiveDate: '1 November 2026',
  sections: [
    {
      heading: 'Who controls this data',
      paragraphs: [
        'This policy describes how eypi.cc handles personal data under the Data Privacy Act of 2012 (Republic Act No. 10173). It is a draft. The owner reviews it before publish.',
        'The personal information controller is eypi.cc, operated by Angelo Laus. Contact the controller at /contact. Until Angelo Laus names a data protection officer, use that same contact for privacy requests.',
      ],
    },
    {
      heading: 'Accounts',
      paragraphs: [
        'Sign-in uses Microsoft for @apc.edu.ph and @student.apc.edu.ph accounts. eypi.cc stores the account id, name, email address, and role returned by Microsoft.',
        'eypi.cc does not store a password for your account. There is no separate eypi.cc password.',
      ],
    },
    {
      heading: 'Links',
      paragraphs: [
        'When you create a short link, eypi.cc stores the destination URL, the slug, the click count, the time it was created, optional expiry, and any disable reason. Optional QR settings and a logo image are stored with the link.',
        'If you set a password on a short link, eypi.cc stores a one-way hash of that link password so a visitor can open the protected link. That hash is not a password for your Microsoft account.',
      ],
    },
    {
      heading: 'Link analytics',
      paragraphs: [
        'A click on a short link can store the operating system, the country, the referrer, whether the click came from a QR code or a direct visit, the time, and a hashed visitor id.',
        'The hashed visitor id is a truncated HMAC of the calendar day, the IP address, and the user agent. The analytics row does not store the raw IP address.',
      ],
    },
    {
      heading: 'Rate limits and reports',
      paragraphs: [
        'eypi.cc applies a rate-limit to some requests. The rate-limit key can be your account id, the connecting IP address, or a hash of that IP address. The key and the count are kept in Cloudflare KV and expire by the KV time-to-live. eypi.cc does not copy those raw IP addresses into the analytics table.',
        'A link report stores the slug, the reason, optional details of up to 1000 characters, a hash of the IP address of the person who sent the report, and the account id if that person is signed in.',
      ],
    },
    {
      heading: 'Organizations',
      paragraphs: [
        'Organization records can include the name, the type, the owner, member and invite email addresses, a tagline, about text, a logo, a banner, and social links. Invites are emailed through Resend.',
      ],
    },
    {
      heading: 'Tix',
      paragraphs: [
        'Event leads can upload a CSV. eypi.cc stores those rows in event_csv_rows. A row can include names, email addresses, and any other columns in the file. Selected attendees are stored with a name, an email address, a ticket token, and an optional cluster. Check-in stores that a ticket was scanned.',
        'Google Wallet is the wallet pass eypi.cc issues. Google receives the holder name, the ticket number, the event name, date, time, and location, the tier, and any custom fields placed on the pass.',
      ],
    },
    {
      heading: 'Frames',
      paragraphs: [
        'Organizers upload frame images. eypi.cc stores those images. The photo a visitor places on a frame is drawn in the browser and is not uploaded.',
      ],
    },
    {
      heading: 'Forms',
      paragraphs: [
        'The concessionaire, visitors pass, and letter of intent generators run in the browser. Form inputs for those generators stay in the browser. They are not sent to eypi.cc.',
      ],
    },
    {
      heading: 'Sessions and consent records',
      paragraphs: [
        'A signed-in session stores a hash of the session token, the account id, created and last-seen times, the expiry, the user agent, and a hash of the IP address. The session cookie holds the token.',
        'When you accept this policy and the terms, eypi.cc records the document name, the version, the time, your account id, a hash of the IP address, and the user agent.',
      ],
    },
    {
      heading: 'Purposes and legal basis',
      paragraphs: [
        'eypi.cc processes account, link, organization, event, attendee, and frame data to provide the service you asked for. That processing is necessary to take steps at your request and to perform the service (Data Privacy Act of 2012, section 12(b)).',
        'eypi.cc processes the hashed visitor id, rate-limit keys, and abuse reports to keep the service available and to understand link use. That processing is a legitimate interest of the controller (section 12(f)).',
        'eypi.cc asks you to accept this policy and the terms. That acceptance is consent (section 12(a)). You may object to processing that relies on legitimate interest by writing through /contact. Processing that a feature needs in order to run can continue while you use that feature.',
      ],
    },
    {
      heading: 'Processors and cross-border transfer',
      paragraphs: [
        'eypi.cc uses these processors: Cloudflare (hosting, KV, and file storage), Turso (the database), Microsoft (sign-in), Resend (email, including organization invites), and Google Wallet (passes).',
        'These processors may process personal data outside the Philippines. The transfer is made so eypi.cc can be hosted, store data, sign you in, send mail, and issue a Google Wallet pass. This draft does not list transfer clauses. The owner confirms those before publish. Ask through /contact for the current details.',
      ],
    },
    {
      heading: 'Retention',
      paragraphs: [
        'Expired sessions are deleted daily. Rows in event_csv_rows are deleted 30 days after the event date. Resolved link reports older than 180 days are deleted. Rate-limit keys expire by their KV time-to-live.',
        'Other account, link, organization, event, attendee, and frame records are kept while that record exists. The owner sets any further retention periods before publish.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'You have the right to access your personal data, to correction, to erasure, to portability, and to objection. Send a request through /contact.',
        'You may file a complaint with the National Privacy Commission if you believe your personal data has been processed in violation of the Data Privacy Act of 2012 (Republic Act No. 10173). The Commission describes that complaint right and its process at https://privacy.gov.ph.',
      ],
    },
    {
      heading: 'Data on your device',
      paragraphs: [
        'This browser stores two localStorage keys. eypi_dark_mode remembers the light or dark theme. active_org_id remembers the organization selected in this browser.',
        'The only cookie is the session cookie. Its name is __Host-eypi_session in production and eypi_session in development. It is HttpOnly, Secure, and SameSite=Lax. It is strictly necessary to keep you signed in. eypi.cc does not use analytics or advertising cookies, and it does not show a cookie banner.',
      ],
    },
  ],
}
