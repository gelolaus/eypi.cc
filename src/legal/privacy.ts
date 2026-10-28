// OWNER REVIEW REQUIRED before publish
import type { LegalDocument } from './types'

export const privacy: LegalDocument = {
  version: '2026-11-15',
  title: 'Privacy policy',
  effectiveDate: '15 November 2026',
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
        'When someone opens a short link, eypi.cc can store one click row with the country, the operating system, the device type (mobile, tablet, or desktop), the browser family (for example Chrome or Safari), the source app when the click comes from inside one (Messenger, Facebook, Instagram, TikTok, X, LINE, or Discord), the referrer, whether the click came from a QR code or a direct visit, the time, and a hashed visitor id. Known bots are not counted.',
        "The device type, browser family, and source app are worked out from the browser's user agent at the moment of the click. eypi.cc does not store the user agent string itself. The referrer is stored as a site name or host name, not the full address.",
        'The hashed visitor id is a truncated HMAC of the calendar day, the IP address, and the user agent. It changes every day, so it only lets eypi.cc count unique visitors within one day. It cannot link a person across days. The analytics row does not store the raw IP address.',
        "eypi.cc adds up each link's clicks, unique visitors per day, QR clicks, and the breakdowns above into daily totals. The link owner sees these totals and a live view of their own recent clicks that shows only the time, the country, and the source app.",
      ],
    },
    {
      heading: 'Frames and organization page activity',
      paragraphs: [
        'When someone views a Frame, adds a photo to it, downloads the result, or shares it, eypi.cc stores that action with the Frame, the day, and the same kind of daily hashed visitor id described above. It does the same when someone views a public organization profile. The photo itself is not uploaded.',
        'eypi.cc limits these events to a small number per visitor, per campaign (or organization page), per action each hour. It adds them up into daily totals that the organization sees.',
      ],
    },
    {
      heading: 'Speed samples',
      paragraphs: [
        'For about one in four page loads, the browser sends page speed measurements to eypi.cc (Core Web Vitals: LCP, INP, CLS, FCP, and TTFB). Each sample has the measurement, its rating, the name of the page type (not the address), the day, the device type, the connection type the browser reports (for example 4g), and how the page was opened. A sample has no account id, IP address, or visitor id. The platform admin reads daily summaries to find slow pages.',
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
        "Signed-in students can register for an event on eypi.cc. A registration stores your account link, your name and email address, your status (for example confirmed, waitlisted, or cancelled), the time you registered, and your answers to the organizer's registration questions. Organizers of that event can see these and can export them.",
        "Organizers can issue a private guest ticket link to an attendee who has no account. Anyone who has the link can open the ticket without signing in. The ticket shows the event name, date, time and location, the ticket status, the ticket QR code, the answers to the registration questions, and the waitlist position. eypi.cc stores only a hash of the link's token. An organizer can issue a new link at any time, which stops the old link from working. Keep the link private. When an organizer exports the attendee CSV, eypi.cc issues guest ticket links for confirmed attendees who have no account and no link yet, and puts those links in the file.",
        "If you delete your account, your future self-registrations that have no check-ins are deleted. Every other registration linked to your account, other than registrations for events you lead, which are deleted with the account (an event of an organization owned by someone else is handed to that owner instead), is kept as the organization's attendance record with the account link removed. That includes past registrations, registrations with a check-in, and registrations an organizer imported for you, even for future events. Your name and email address stay on those kept records.",
        "To have a kept attendance record erased, ask through /contact. The organization that holds the record may need to confirm it first.",
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
        'eypi.cc processes account, link, organization, event, registration, attendee, and frame data to provide the service you asked for. That processing is necessary to take steps at your request and to perform the service (Data Privacy Act of 2012, section 12(b)).',
        'eypi.cc processes click details, hashed visitor ids, Frames and organization page activity, speed samples, rate-limit keys, and abuse reports to keep the service available, to find slow pages, and to understand link, Frame, and organization page use. That processing is a legitimate interest of the controller (section 12(f)).',
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
        'Expired sessions are deleted daily. Raw click rows and raw Frames and organization page activity rows are deleted after 400 days, once the daily totals for their day exist. The daily totals themselves are kept. Speed samples are deleted after 30 days. Rows in event_csv_rows are deleted 30 days after the event date. Resolved link reports older than 180 days are deleted. Rate-limit keys expire by their KV time-to-live.',
        'Other account, link, organization, event, attendee, and frame records are kept while that record exists. The owner sets any further retention periods before publish.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'You have the right to access your personal data, to correction, to erasure, to portability, and to objection. Send a request through /contact. Erasure of an attendance record kept after account deletion is described under Tix.',
        'You may file a complaint with the National Privacy Commission if you believe your personal data has been processed in violation of the Data Privacy Act of 2012 (Republic Act No. 10173). The Commission describes that complaint right and its process at https://privacy.gov.ph.',
      ],
    },
    {
      heading: 'Data on your device',
      paragraphs: [
        'This browser stores one localStorage key. active_org_id remembers the organization selected in this browser. The app also keeps a copy of your ticket list on your device so tickets can open offline. Door mode keeps the guest roster (names and ticket codes) on the device until you sign out.',
        'The only cookie is the session cookie. Its name is __Host-eypi_session in production and eypi_session in development. It is HttpOnly, Secure, and SameSite=Lax. It is strictly necessary to keep you signed in. eypi.cc does not use analytics or advertising cookies, and it does not show a cookie banner.',
      ],
    },
  ],
}
