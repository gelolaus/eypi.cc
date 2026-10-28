# Phase 3 and 4 handoff

Continues `handoff-phase-1-2.md`. All four phase branches are finished, reviewed and pushed (stacked: `phase-1-speed` → `phase-2-tix` → `phase-3-analytics` → `phase-4-ux`). Nothing was merged to `main` or deployed.

## Merge and deploy order (owner)

1. Apply `0010_perf_media`, merge `phase-1-speed`, deploy (owner guide Part 2 and Part 3 Phase 1).
2. Check slugs `t`/`tickets`, apply `0011_tix_registration`, merge `phase-2-tix`, deploy the backend right after the migration (Part 3 Phase 2).
3. Approve the privacy text (owner guide 3.3.1), apply `0012_analytics` (additive), merge `phase-3-analytics`, deploy (Part 3 Phase 3).
4. Review the UX audit outcomes, merge `phase-4-ux`, deploy (Part 3 Phase 4).

## Sizes at the end of Phase 4 (gzip -9 bytes)

- Entry JS 69,416 of 70,000 (about 580 B headroom). Entry CSS 18,229 of 22,000.
- `npm run release:check` passes 7/7. Public-route totals were last measured at the end of Phase 2 (limit 110,000) and Phases 3 and 4 only added lazy chunks; the bundle step of `release:check` passes.

## Phase 3 notes

- Privacy text changes are committed with the version bump, pending owner approval (owner guide 3.3.1).
- Rollups are by Manila day; the backfill runs 14 days per cron run; module events older than 400 days are purged.
- The links "Unique visitors" tile is "Avg daily uniques" because daily uniques cannot be summed.

## Phase 4 notes

- Audit: `docs/superpowers/specs/2026-10-27-ux-audit.md` (Outcomes section). Public pages were screenshotted; signed-in views were audited from source. Before/after screenshots were NOT re-captured.
- Partial or open: UX-7 orphan tile at odd counts, UX-46 skeleton tiles, UX-29, UX-4. In Links and Events the header "New" button and the empty-state button both show when the list is empty.
- Tasks 5 and 6 were written by a different model (DeepSeek) and independently reviewed; hardening and fixes are in `6a39174` and `3ffdde0`.
- Install offer: `main.ts` stashes an early `beforeinstallprompt` on `window.__bip`; the manifest has `id: "/"`, `start_url: "/dashboard"` and Links / My tickets shortcuts. Installed copies from before this change may be treated as a new app.
- Undo commits on `pagehide` and when the tab becomes hidden, so locking a phone within 5 s commits the action.

## Deferred minors

- Palette "Create a link" goes to `/links` and does not open the create dialog.
- `src/lib/lazyHost.ts` duplicates reload logic in `chunkReload.ts` and `App.vue`.
- `LOADING...` capital copy in admin lists should be checked against the copy rules.
- Focus after route change is still the live region plus skip link only.
