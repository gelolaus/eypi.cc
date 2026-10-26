// OWNER REVIEW REQUIRED before publish
import type { LegalDocument } from './types'

export const terms: LegalDocument = {
  version: '2026-11-01',
  title: 'Terms of service',
  effectiveDate: '1 November 2026',
  sections: [
    {
      heading: 'Agreement',
      paragraphs: [
        'These terms govern your use of eypi.cc. If you do not agree, stop using the service. The consent screen is how you agree to these terms and to the privacy policy.',
      ],
    },
    {
      heading: 'Accounts',
      paragraphs: [
        'Sign-in uses Microsoft for @apc.edu.ph and @student.apc.edu.ph accounts. You are responsible for activity under your account.',
      ],
    },
    {
      heading: 'The service',
      paragraphs: [
        'eypi.cc provides short links, organization tools, event ticketing (Tix), profile frames, and form generators that run in the browser. Features can change, pause, or end.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'You must follow the acceptable use rules at /acceptable-use. Those rules are part of these terms.',
      ],
    },
    {
      heading: 'Suspension',
      paragraphs: [
        'Angelo Laus may disable a link, event, frame, organization page, or account that breaks these terms, breaks the law, or puts other people at risk.',
      ],
    },
    {
      heading: 'Availability and liability',
      paragraphs: [
        'The service is provided as available. eypi.cc does not promise uninterrupted hosting or that a link will stay online.',
        'To the extent Philippine law allows, Angelo Laus is not liable for indirect or consequential loss from use of the service, including lost traffic. These terms do not limit liability that Philippine law does not let a contract limit.',
      ],
    },
    {
      heading: 'Law',
      paragraphs: [
        'These terms are governed by the laws of the Republic of the Philippines. Courts in Metro Manila may hear disputes, except where a mandatory rule gives you another venue.',
      ],
    },
  ],
}
