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
