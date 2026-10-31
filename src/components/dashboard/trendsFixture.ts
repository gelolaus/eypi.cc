import type { UserTrends } from '@/lib/queries'

export const sampleTrends: UserTrends = {
  totals: { clicks: 110, uniques: 40, qr: 5, activeLinks: 2, links: 3 },
  timeline: [
    { day: '2026-10-01', clicks: 40, uniques: 15 },
    { day: '2026-10-02', clicks: 70, uniques: 25 },
  ],
  top: {
    links: [
      { slug: 'aa', clicks: 70 },
      { slug: 'bb', clicks: 30 },
      { slug: 'cc', clicks: 10 },
      { slug: 'dd', clicks: 5 },
      { slug: 'ee', clicks: 4 },
      { slug: 'ff', clicks: 1 },
    ],
    device: [{ value: 'mobile', clicks: 80 }],
    country: [{ value: 'PH', clicks: 90 }],
    referrer: [{ value: 'direct', clicks: 50 }],
    app: [{ value: 'instagram', clicks: 12 }],
  },
  heat: Array.from({ length: 168 }, (_, i) => (i === 19 ? 9 : 0)),
  previous: {
    totals: { clicks: 100, uniques: 30, qr: 0, activeLinks: 1 },
    timeline: [
      { day: '2026-09-01', clicks: 50, uniques: 20 },
      { day: '2026-09-02', clicks: 50, uniques: 10 },
    ],
  },
}