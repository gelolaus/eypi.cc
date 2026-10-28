# UX audit open items: design

Date: 2026-10-29. Source: `2026-10-27-ux-audit.md` (Outcomes section). Owner chose every open item.

## Intent

Phases 1 to 4 are merged. This round closes the audit findings still marked `later` or `partial`, so public pages load without a blank flash, phone layouts stop scrolling sideways or crowding controls, and the frame editor works from a keyboard.

## Goals

- Fix UX-4, 6, 7, 10, 14, 17, 28, 29, 38, 45, 46, 48, 57.
- Resolve the Create-button decision: on Links and Events the empty state owns the button, and the page header button is hidden while the list is empty.
- Update the audit doc's Outcomes table as each item lands.

## Non-goals and anti-goals

- No new features beyond the audit fixes. No visual redesign.
- Do not touch the database (local dev uses production; read only).
- Do not push, deploy, or change Cloudflare, Worker secrets, Entra, R2 or Resend.
- Anti-goal: breaking the budgets, entry JS at or under 70,000 B and CSS at or under 22,000 B gzip.

## Constraints

- `DESIGN_SYSTEM.md`: touch targets at least 44 px, visible focus, reduced motion respected, light theme only.
- TDD. `npm run typecheck`, `npm test`, `npm run lint` pass per commit; `npm run release:check` when bundle size can change.
- Conventional Commits in the owner's style, no trailers, one commit per task, committed on `main` locally, never pushed.
- Signed-in views can only be checked visually if the owner is logged in to the built-in browser; otherwise they are reported as unseen.

## Tasks and approaches

1. **Public pages (UX-4, 6, 10, 14, 57)**
   - UX-4 options: (a) Suspense fallback around the router view using a tiny inline skeleton (recommended; about 200 B); (b) reuse `PageSkeleton` in the entry chunk, which costs more than the 584 B of headroom; (c) static skeleton markup in `index.html`, which flashes on every route. Go with (a); if it still exceeds the cap, trim elsewhere in the entry chunk.
   - UX-6: keep the header logo, drop the hero wordmark (owner confirmed).
   - UX-10: "On this page" anchor list generated from the legal section headings, shown above the first heading; headings get stable ids.
   - UX-14: aspect-ratio box matching the stored banner ratio instead of fixed height with `object-cover`.
   - UX-57: add `/orgs`, `/contact`, `/acceptable-use`, `/login` to the worker sitemap.
2. **Links and Events (UX-28, header Create)**
   - Phones: Copy and Analytics stay visible; Pause and Delete move to an overflow menu (owner confirmed). Menu items and trigger are at least 44 px with keyboard support. Desktop layout unchanged.
   - Header Create hides when the list is empty; the empty-state button remains.
3. **Phone layouts (UX-29, 45, 38)**
   - Members table (UX-29) and the forms guest and signer tables (UX-45) become stacked cards below `md`, as `AdminUsersView` does. Attendee names and emails go to `text-base` and meta stays `text-sm` (UX-38).
4. **Frame editor keyboard (UX-17)**
   - Canvas gets `role="img"` with a label, `tabindex=0`, arrow-key nudge, `+`/`-` zoom, and visible zoom buttons (44 px). Reduced-motion has no effect here (no animation).
5. **Admin (UX-48, UX-46)**
   - Disable account and disable link use `useUndoToast`; delete account keeps the confirm. UX-46 is verified in the browser only; code changes only if a defect shows.
6. **Landing stats (UX-7)**
   - Show the largest even number of tiles that pass the threshold, so no tile orphans (owner confirmed).

## Left to the builder

Exact component names, test layout, copy for the overflow menu and canvas label (sentence case, per `DESIGN_SYSTEM.md`), and the order of tasks. After the six tasks: build, run the browser pass at 375 and 1280, and record what was seen and what was not.
