# Public frame download count: design

Date: 2026-10-29. Short design (small change). Owner chose approach A.

## Intent

Visitors and org members should see how many times a frame was downloaded. Today `dp_campaigns.download_count` exists but counts at most one download per connection per 24 hours, and only org members see it (the "Your frames" list). The owner wants every save counted and the number shown to everyone, on every frame, existing and new.

## Goals

- Every save adds 1 to `download_count` (the once-per-day limit goes away).
- The public frame page (`/frames/:slug`) shows "N downloads"; the org-side list keeps showing the same number.
- The same behavior applies to all frames, existing and new. Existing totals are kept as they are.

## Non-goals

- No per-image counters and no schema change (that was approach B, deferred).
- No backfill: past saves that the old limit swallowed cannot be recovered.
- The org analytics screen keeps its own time-windowed figure (from analytics events). Only its wording changes so it does not read as the lifetime counter.

## Anti-goals

- A public number that one script can inflate. A loose guard stays.
- Showing a discouraging "0 downloads" on a brand-new frame.

## Constraints

- No database migration, so nothing touches the production database. Local dev uses it, so tests mock the DB.
- DESIGN_SYSTEM.md (light only, readable text size, sentence-case copy). Entry JS stays at or under 70,000 B gzip (now 67,955 B) and CSS at or under 22,000 B. The public frame view is a lazy route.
- Conventional Commits, small commits, no trailers, commit on `main`, never push.

## Approaches considered

- **A. One counter per frame page, every save counts, loose guard (chosen).** Smallest change; both sides read the same column.
- B. A plus `dp_frames.download_count` per image. Needs a migration, starts at zero. Deferred.
- C. No guard at all. Rejected: anyone can inflate a public number with one request.

## Decisions

- Guard (my call): replace the 1-per-24h rate limit in `POST /api/dp/:id/download` with a limit of 30 per connection per campaign per hour (`checkRateLimit`, bucket `dp-download-hour`). A person saving repeatedly never hits it. Over the limit the endpoint answers 429 as today and the client ignores it.
- Public payload (my call): `GET /api/dp/:slug` adds `downloadCount: number` to `campaign`. The payload is edge-cached for 30 s, so the visible number can lag by up to 30 s.
- Public display (my call): the frame page shows "N downloads" (singular for 1, thousands separators) under the title block once `downloadCount >= 1`; hidden at 0. Org-side list always shows the number, including 0.
- Org analytics wording (my call): the downloads label in the insights screens becomes "Downloads and shares in this period" (they count both), so it is not confused with the lifetime count.
- Privacy text: `src/legal/privacy.ts` already says download actions are stored; counting more saves changes nothing there, so no policy edit.

## Left to the builder

Exact placement and markup of the public count, test layout, the 429 message wording, and the insights label text.

## Outcome

Commits of this feature:

- docs(frames): add design for the public download count
- docs(frames): add the download count implementation plan
- feat(frames): count every save with an hourly guard
- feat(frames): return the download count in the public payload
- feat(frames): show the download count on the public page
- fix(frames): drop the unused count from the editor payload
- fix(insights): label the windowed figures as downloads and shares
- test(frames): cover the lifetime count on the org list
- fix(insights): keep views in the daily chart heading
- plus the docs commits that ticked the plan tasks

What changed:

- Every save now counts, with a guard of 30 per hour per connection per frame (the old once-per-day rule is gone).
- The public frame page shows "N downloads" from 1 upward (singular for 1, hidden at 0).
- The org list is unchanged; it already showed the lifetime count.
- Analytics figures are relabelled "Downloads and shares", and the daily chart heading reads "Views, downloads and shares per day (Manila time)".

Checks (2026-10-29): typecheck clean; 2200 tests in 257 files pass; lint has 0 errors and 7 warnings (all in untouched files); build and `release:check -- --allow-dirty` pass. Entry JS is 68,034 B gzip (budget 70,000) and entry CSS is 18,698 B gzip (budget 22,000), measured with Node's default gzip as the release check does.

Limits:

- Old frames keep their old totals. The earlier once-per-day rule swallowed repeat saves and that history cannot be recovered; nothing was backfilled.
- The visible number can lag by up to about 5.5 minutes in a browser, because the public payload is sent with `max-age=30, stale-while-revalidate=300` (see `backend/src/lib/edgeCache.ts`). The edge cache itself holds it for 30 s.
- The count is client-reported. The guard limits one connection to 30 per hour, but someone rotating IP addresses (easy over IPv6) can still inflate it, so treat the number as a popularity signal, not an audit figure.
- Rate-limit KV keys use the raw IP as before (retention is now 1 hour instead of 24 hours); hashing it like the rum/guests limiters is an optional follow-up.
- The KV guard is not atomic, so concurrent requests can slip a few extra counts past the limit.
- Nothing was viewed in a browser: the public count and the org screens have had no visual check.
