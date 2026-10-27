# Wantap polish: chrome, landing, dashboard, ram logo

Date: 2026-10-27. Builds on `2026-10-27-apc-light-theme-design.md` and the wantap design port. Palette stays the APC light palette (blue `#35438c`, gold `#deac4b`). Layout, components, type and motion stay wantap's.

## Intent

Make eypi.cc match wantap.cc's design language and practice more exactly, fix three chrome defects, give the landing page real numbers, make the dashboard informational, and replace the placeholder logo with a cute ram (the APC spirit animal).

## Decisions (from the owner)

- Landing keeps wantap's slim top bar: logo left, one text link, a "Get started" pill. No other nav items.
- Landing numbers are real database totals. No invented figures. A metric without a table is omitted.
- Sidebar org label: logo, full name wrapped (never truncated), slug in capitals beneath.
- Logo: hand-built SVG (no image model is available). Three candidates, the owner picks one.

## 1. Chrome fixes

1. **Route announcer.** `router.afterEach` in `src/router/index.ts` appends `#route-announcer` to `body` with no styling, so the title (`Edit frame · eypi.cc`) shows under the app and creates a scroll. Add the `sr-only` class when creating it. Test: the element has `sr-only`.
2. **No scroll when nothing overflows.** After fix 1, confirm the app shell (`h-dvh`, pane `overflow-y-auto`) and the public page produce no page-level scrollbar at 1920x1080 on `/manage/frames/:slug/edit`.
3. **Wider rail.** `AppShell.vue` `aside`: `w-56` becomes `w-72`. Update `DESIGN_SYSTEM.md` section 6 and `design.test.ts` if it asserts the width.
4. **Org switcher label.** `OrgSwitcher.vue` with `block` (rail): trigger shows `OrgLogo`, the org name with `line-clamp-2 break-words` (full text in `title`), and the org slug uppercased in `font-mono text-xs text-muted-foreground`. The compact (top bar) variant stays logo-only below `sm`. Menu rows use the same name and slug layout. Slug source: `org.org_id` (the org slug, `organizations.id`).

## 2. Landing page

- `MarketingHeader.vue`: reduce inline items to one text link plus a CTA pill (wantap: "About" and "Get started"; eypi: link text decided in the plan from existing public routes, CTA "Get started" to `/login`). Signed-in users see "Dashboard" as the CTA.
- `Hero.vue`: left column unchanged in structure (large `BrandLogo`, headline, lead, CTA). Delete the `rows` array and its example hosts. Right column becomes `LiveStats`.
- `LiveStats` (new, `src/components/marketing/LiveStats.vue`): a dense grid of number tiles, `tabular-nums`, section-card styling, skeleton while loading, a quiet "Stats unavailable" state on error (no zeros shown as truth).
- `GET /api/stats` in `backend/src/routes/stats.ts` returns, from existing tables only: `users`, `orgs`, `members` (activated `org_members`), `links`, `clicks` (sum of `links.clicks`), `events`, `tickets` (`attendees`), `checkIns` (`check_ins` with `action = 'checked_in'`), `frames` (`dp_campaigns`), `frameDownloads` (sum of `dp_campaigns.download_count`). Existing keys `orgs`, `links`, `events` keep their meaning. Public, unauthenticated, aggregate only, no personal data. Cache header `public, max-age=300`.
- Remove other placeholder content on the landing (`FeatureStrip`, `ProofSection`, `CtaSection`) only where it shows fake or example data; `ProofSection.vue` already reads `/api/stats` and is folded into `LiveStats`.

## 3. Dashboard

`DashboardView.vue` becomes informational, wantap layout: `h1` greeting plus one line, then a two-column grid of `AppSection` cards.

- **Your links:** link count, total clicks, top link by clicks (from `useLinks`).
- **Your org** (when the user has an active org): name and CAPS slug, activated members, events, tickets, frames. Uses existing endpoints; if no endpoint returns the counts, add `GET /api/orgs/:id/summary` (activated members only, with `orgContext` guard) and test it.
- **Platform:** the same totals as the landing, from `/api/stats`.
- **Modules:** the five launcher cards stay, compact, below the info cards.
- Pending invites banner stays. Empty states state the next action (`DESIGN_SYSTEM.md` section 13).

## 4. Ram logo

Hand-built SVG in `public/`, per the ip-as-logo rules: one soft rounded silhouette from 4 to 7 basic shapes, exactly two character colors (APC blue, APC gold) plus one background, both curled horns shown, two simple eyes, optional tiny mouth, heavy rounded contours, no sharp tips, upright and emerging from a lower corner, readable at 32x32.

- Deliver `docs/logo/ram-a.svg`, `ram-b.svg`, `ram-c.svg` (three treatments: horn-forward, wool-forward, face-forward) and a side-by-side preview at 32, 64 and 256 px.
- After the owner picks one: replace `public/favicon.svg`, regenerate `public/apple-touch-icon.png`, update `BrandLogo.vue` `markSrc` only if the path changes, update the manifest icons.

## Out of scope

Dark theme, theme toggle, new motion, new fonts, restyling untouched views, a real image-model logo flow.

## Testing

Tests first (Vitest). Cover: announcer is `sr-only`; rail width; org label (long name wraps, CAPS slug, `title`); header items on the landing and for a signed-in user; `LiveStats` loading, success and error; stats route returns every key as a number and the cache header; dashboard cards render from mocked data and the org card is hidden without an active org; design tests updated for changed values. `npm run typecheck` and `npm test` pass.

## Risks

- `/api/stats` is public: only aggregates, cached, no email or IP.
- Local dev uses the production Turso database: stats and summary queries are read-only.
- Hand-drawn SVG quality is subjective: the three-candidate pick is the gate.
