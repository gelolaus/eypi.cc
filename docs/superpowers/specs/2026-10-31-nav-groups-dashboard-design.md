# Nav groups, org gating and descriptive dashboard

Date: 2026-10-31 · Status: approved by the owner in chat · Plans: `docs/superpowers/plans/2026-10-31-phase-{1-nav,2-analytics-api,3-dashboard,4-extras}.md`

## Why

1. People who are not in an org still see org-only features (Tix, Frames, Forms) in the sidebar and the tab bar. They open them and get bounced.
2. Features for every student and features for org members sit in one flat list.
3. The dashboard shows org details, a live-click panel and four numbers. It does not describe anything.
4. The mobile tab bar spends slots on Tix, an org-only feature, instead of features everyone has.

## Decisions (owner answers)

| Question | Decision |
|---|---|
| Group names | **Rams** (every signed-in student) and **Orgs** (activated org members only) |
| "Orgs" appears in both groups | Rams → **Orgs** = public directory `/orgs`. Orgs group → **My org** = `/orgs/modify` |
| Dashboard data | Own links over time, own tickets and events, org analytics (members), campus pulse strip |
| Mobile org tools | Reached from the dashboard cards and the profile menu. No change to the tab bar for members |
| Profile menu on phones | Same size and form as the org switcher (bottom sheet) |
| Analytics type | Descriptive only: what happened, compared with the previous period. No forecasts, scores or recommendations |

## Information architecture

| Group | Item | Route | Visible to |
|---|---|---|---|
| Rams | Dashboard | `/dashboard` | everyone signed in |
| Rams | Links | `/links` | everyone |
| Rams | My tickets | `/tickets` | everyone |
| Rams | Wallpaper | `/wallpaper` | everyone |
| Rams | Invites | `/invites` | everyone |
| Rams | Orgs | `/orgs` | everyone |
| Orgs | Tix | `/manage/tix` | activated members and owners |
| Orgs | Frames | `/manage/frames` | activated members and owners |
| Orgs | Forms | `/forms` | activated members and owners |
| Orgs | My org | `/orgs/modify` | activated members and owners |
| menu | Account, Admin | `/account`, `/admin/users` | unchanged (account menu) |

"Member" means `useActiveOrg().orgs.length > 0`. `GET /api/orgs` already returns exactly the orgs the user owns or holds an activated membership in, so there is no new endpoint for membership.

Route guards do not change: `requiresOrg` still redirects non-members to `/forms`. Hiding is a courtesy on top of the guard, never a replacement for it.

## Navigation behaviour

### Single source
`src/config/nav.ts` owns the list. Each `NavItem` gains `group?: 'rams' | 'orgs'`, `orgOnly?: boolean` and `tab?: boolean`. Everything that lists destinations reads it: rail, tab bar, profile menu, `SiteNavSheet`, `CommandPalette` (`src/lib/commands.ts`) and the dashboard feature cards. No surface keeps its own list.

### Desktop rail
- Two labelled sections, Rams first. Section headings are small, muted, uppercase-free text (`text-xs font-medium text-muted-foreground`). In the collapsed rail the heading becomes a 1px divider with a screen-reader-only heading.
- The Orgs section is not rendered at all for a non-member. While `orgsLoaded` is false it is also not rendered, unless the stored hint says the user was a member last time (see below).
- The org switcher stays in the rail footer, shown only when the user has orgs (unchanged).

### Mobile tab bar
- Five tabs, in this order: **Dashboard, Links, My tickets, Wallpaper, Invites**. They are the `tab: true` items. `TAB_COUNT` becomes 5 and the grid is `grid-cols-5`.
- The Invites tab carries the pending-invite badge, the My tickets tab keeps its update badge.
- Labels at 11px must not wrap: "My tickets" and "Wallpaper" truncate with `truncate`; verified at 360px width.

### Profile menu on phones
- Below `sm` the account menu opens as a bottom sheet with the same classes and behaviour as `OrgSwitcher` (backdrop, `rounded-t-3xl`, `max-h-[80dvh]`, safe-area padding, focus trap, Escape closes). From `sm` up it stays the anchored `w-72` dropdown. The org switcher's `w-72` desktop dropdown and the profile dropdown are the same width.
- Content order: identity, **Rams** overflow (Orgs directory), **Orgs** section (members only: Tix, Frames, Forms, My org), Account and Admin, Change avatar, Appearance, Install, legal links, Sign out.
- Shared sheet behaviour moves into one composable/component so `OrgSwitcher` and `AccountMenu` do not duplicate it (see Phase 1, Task 5).

### Active state
`/orgs` must not be active on `/orgs/modify`. Add `except?: string` to `NavItem` (a path prefix that never matches) and set it on the Orgs directory item.

### No flicker
`useActiveOrg` exports `orgsLoaded` (false until the first `fetchOrgs` settles) and persists `localStorage['eypi.hasOrg']` (`'1'` or `'0'`, wrapped in try/catch). The rail shows the Orgs section when `orgs.length > 0`, or while `!orgsLoaded` and the hint is `'1'`. Logout clears the hint.

## Dashboard

Title stays `Hi, {name}.` with the invite banner. Two sections, each a labelled landmark (`<section aria-labelledby>`): **Rams** and **Orgs** (members only). A period control (7 / 30 / 90 days, default 30) sits at the top of the Rams analytics and persists in `sessionStorage`.

Removed: the "Your org" card, org slug and name block, `LiveClicks` panel on the dashboard (the component stays for the Links page if it is used there; otherwise delete it with its endpoint test only if nothing else imports it).

### Rams section
> Update 2026-10-31: items 2 (clicks per day), 3 (top links) and 4 (who clicks) were removed from the dashboard at the owner's request after review. The trends API still returns that data; only the panels are gone.

1. **KPI strip** (`StatTile`, each with delta against the previous equal period): Clicks, Unique visitors (sum of per-day uniques, labelled "daily uniques"), QR scans, Active links (links with at least one click in the period). A second row: Links total, Next ticket (event name and date, or "No upcoming tickets").
2. **Clicks per day** `LineChart`: clicks and uniques, with the previous period as a second series when the period fits.
3. **Top links** `BarList`: top 5 by clicks in the period, each row links to `/links` with that link opened if the Links page supports a query param, otherwise to `/links`.
4. **Who clicks**: `BarList`s for device, country, referrer and, when present, in-app browser (`app`). Top 5 each, empty dimensions hidden. QR scans are a KPI tile, not a list.
5. **Best hours** `HeatGrid` (168 cells, Manila time, Monday 00:00 = 0), captioned with the peak hour in words.
6. **Upcoming tickets**: up to 3 tickets from the read-only tickets endpoint, with a link to `/tickets`.
7. **Across APC**: one muted strip with platform totals from `GET /api/stats` (students, orgs, links, clicks, events). Uses the existing 30 s edge cache.
8. **Feature cards (Rams)**: Links, My tickets, Wallpaper, Invites, Orgs, each with a one-line description. A pending-invite count appears on Invites.

### Orgs section (members only; the active org)
1. Header: org name and slug label (one line), not a detail card.
2. **KPI strip** from `GET /api/orgs/:org_id/insights?days=N` (already exists): Profile views, Registrations, Check-ins (and check-in rate = checkIns / registrations, hidden when registrations is 0), Frames views, Frames downloads, Members.
3. **Profile views per day** `LineChart` and **Members over time** `SparkLine` from the same response.
4. **Feature cards (Orgs)**: Tix, Frames, Forms, My org.
5. Link to the full page `/orgs/:slug/insights`.

### States
Every panel has a skeleton (existing `Skeleton`), an empty state with a one-line prompt and a single action, and an error state ("couldn't load, retry"). One panel failing never blanks the page. Zero data shows zeros with an explanation, never a broken chart.

### Charts and accessibility
Reuse `src/components/charts/*` (`LineChart`, `BarList`, `HeatGrid`, `SparkLine`, `StatTile`). Colours are tokens only (`var(--chart-1..5)`). Every chart has a text equivalent: an `aria-label` that states the totals and the peak, or a visually hidden table. Delta is never colour-only (arrow and signed text, as `StatTile` already does). Read `DESIGN_SYSTEM.md` sections 2, 5, 6, 7, 9 and 13 first, and the `dataviz` guidance if the implementing tool has it.

## Backend

No migration. No schema change.

| Route | Auth | Purpose | Source |
|---|---|---|---|
| `GET /api/links/summary/trends?range=7\|30\|90&compare=1` | session | Totals, daily timeline, top links, dimension tops, hour-of-week heat across **all** the user's links, plus the previous period when `compare=1` | `analytics_daily`, `analytics_daily_dim` for past Manila days; raw `analytics` for today (same rule as `loadLinkPeriod`) |
| `GET /api/tickets/upcoming` | session | Up to 3 upcoming confirmed or pending tickets for the dashboard. **Read-only**: must not touch `users.tickets_seen_at` (unlike `GET /api/tickets`) | `attendees` + `events` |
| `GET /api/orgs/:org_id/insights?days=N` | member | Already built. Reused as is | `module_daily`, events, attendees |
| `GET /api/stats` | public | Already built. Reused as is | counts |

Rules for `trends`:
- Manila days throughout (`backend/src/lib/manilaTime.ts`). `range` is validated against `{7, 30, 90}` and anything else is a 422 `invalid_range`.
- Response is `private, no-store`.
- Shape reuses `AnalyticsPeriod` fields where possible: `{ totals: { clicks, uniques, qr, activeLinks, links }, timeline: [{ day, clicks, uniques }], top: { links: [{ slug, clicks }], device, country, source, app }, heat: number[168], previous?: { totals, timeline } }`. Days with no rows are present with zeros so the chart has no gaps.
- `uniques` is the sum of per-day uniques and is labelled as such. It is never deduplicated across days (visitor hashes rotate daily; see `CONTEXT.md` "per-day unique").
- A user with no links gets zeros and empty arrays, not an error.
- Query shape: a single `WHERE link_id IN (SELECT id FROM links WHERE user_id = ?)` range scan per table. Rolled-up tables only for past days. Add a test that asserts no query reads raw `analytics` for days before today.

Privacy: no emails, IPs or visitor hashes leave the server. Country and device are aggregate counts only.

## Out of scope

- Forecasts, scores, "insights" text generated by a model, anomaly detection.
- Per-link drill-down changes (the Links page keeps its own analytics panel).
- New roles or permissions. The flat org model stands.
- Server-side hiding of org routes beyond the existing guards.
- A database migration.

## Constraints that carry over

Entry bundle budgets (JS ≤ 70,000 B gzip, CSS ≤ 22,000 B) from `npm run release:check`: the dashboard stays a lazy chunk and the new components must not enter the entry chunk. Tokens only, no `dark:` utilities, no mica, no Geist. The product is "Eypi" in the UI. Never log emails or IPs. Local development uses the production Turso database: the new endpoints are read-only, and tests run against the in-memory test client, not production.

## Open assumption to confirm after Phase 1

"Same size as the org dropdown" was read as "same bottom-sheet form and width as `OrgSwitcher`". If the owner meant only the trigger button size, the sheet change is reverted and only the trigger gets `min-h-11` and the same width class.
