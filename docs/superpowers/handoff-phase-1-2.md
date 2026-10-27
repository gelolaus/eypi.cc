# Phase 1 and 2 handoff

Written when the cloud run stopped after Phase 2. Phases 3 and 4 were not started.

## Branches

- `phase-1-speed` (from `main`): pushed, finished, reviewed.
- `phase-2-tix` (from `phase-1-speed`): finished, reviewed, whole-branch review fixes applied.
- Merge in order. Apply each migration before merging and deploying that phase (owner guide Part 2 and Part 3).

## Sizes at the end of Phase 2 (gzip bytes)

- Entry JS 68,868 of 70,000. Headroom is about 1.1 kB, so Phases 3 and 4 must stay in lazy chunks.
- Entry CSS 18,402 of 22,000.
- Public-route totals (limit 110,000): `DpPublicView` 85,603, `EventPageView` 86,009, `GuestTicketView` 75,147.

## Rulings that differ from the plans

Phase 1:
- Commits are on phase branches, not `main` (user instruction).
- Turso placement is `{ "mode": "smart" }` because no region was given.
- Budgets are decimal kB (1 kB = 1000 bytes), matching Vite output.
- RUM client samples 25% of page loads (`RUM_SAMPLE_RATE`); the server limit stays 60 per minute per IP.
- Edge media cache keeps a 24 h edge TTL while browsers keep `immutable`, so deleted media stops being served.
- Query-cache invalidation is centralised in `src/lib/api.ts` by path prefix.
- Short links and other Worker-handled paths bypass the service worker; `SPA_SEGMENTS` is tied to the router by a test.

Phase 2:
- Migration 0011 also backfills existing published events to `visibility = 'public'` (they were listed before), normalises legacy `removed` check-ins to `checked_out`, and adds two indexes for email linking.
- Import-mode events are published when saved. The old "CSV upload plus QR ZIP on create" shortcut is gone; import events go through the selection wizard.
- A student who cancelled themself can register again (back of the queue). Registrations cancelled by an organiser stay terminal.
- Door restore only works for registrations cancelled by an organiser or import rows, not self-cancelled ones.
- The CSV export is a GET that issues guest links, so it requires the `X-Active-Org-Id` header.
- Wallet pass for My tickets comes from `POST /api/tickets/:id/pass`, not from the cached ticket list.
- On explicit sign-out the door roster (names and QR tokens) is wiped and only unsent check-ins stay on the device.
- On mobile, "My tickets" is the 4th bottom tab and Frames moved to More. Revert in `src/config/nav.ts` if unwanted.

## Owner actions still open

1. Check existing links with slugs `t` or `tickets` (owner guide 3.2.1) before deploying Phase 2:
   `SELECT slug FROM links WHERE lower(slug) IN ('t','tickets')`, and check the KV link entries.
2. Apply `0010_perf_media` before Phase 1 and `0011_tix_registration` before Phase 2. Deploy the backend right after 0011 (see `docs/operations.md` Phase 2 deploy notes). Do not re-run the 0011 backfill after deploying.
3. Decide whether names and emails on retained past attendee rows should be scrubbed after account deletion (currently kept with `user_id` NULL).
4. Privacy policy text needs ticket registrations and the deletion behaviour (fold into Phase 3 Task 9).
5. No UI exists yet to create lottery cluster quotas for non-import events.
6. Wallet pass fields stay in the event detail page, not the builder (spec 5.6 deviation).
7. Commit author for the run is `Claude <noreply@anthropic.com>`. Reset the author if you want your own identity.
8. Cloudflare Web Analytics, edge purge and the Turso region choice are owner steps.
9. Camera must be started once online before door mode can scan after an offline reload (the scanner chunk loads on first use).
