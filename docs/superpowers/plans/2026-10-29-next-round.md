# Next round: loose ends after dark mode and avatar picker

Date: 2026-10-29. Written for a coding agent (Cursor Grok). Read `AGENTS.md` first and follow its safety rules and commit style (no trailers, one green commit per task, tick the boxes in this file in the same commit).

## Why this exists

Dark mode and the avatar picker are merged and `npm test` (269 files, 2339 tests) and `npm run typecheck` pass. A sweep of the repo on 2026-10-29 found what is still open. Nothing here is a feature request; it is cleanup, risk closure and verification. Tasks are ordered by value. Do them in order; each is independent unless it says otherwise.

## What the sweep found

| # | Finding | Evidence |
|---|---|---|
| 1 | **CI lint is red on `main`.** 3 errors, all `'e' is defined but never used` in `public/theme-init.js` (lines 25, 31, 41), added by the dark mode work. CI runs `npm run lint` (`.github/workflows/ci.yml:36`). | `npm run lint` → 15 problems (3 errors, 12 warnings) |
| 2 | Twelve items in `docs/operations.md` → "Accepted risks" are all "pending owner sign-off". Several are small to fix properly. | `docs/operations.md:168-185` |
| 3 | Stale plans: the July 2026 plans (`auth-decode-dedup`, `auth-middleware`, `notifications`, `test-foundation`, `dev-and-release-workflow`) and the overhaul plan show unticked boxes although the work shipped. Agents reading them may redo finished work. | unticked counts: 14, 15, 12, 19, 43, 11 |
| 4 | Frontend `npm audit --omit=dev` reports 2 moderate (`uuid < 11.1.1` via `exceljs`). Backend is clean. | audit output |
| 5 | Signed-in screens were never seen in a browser (UX-46 `/admin/speed` tiles and range buttons, and the other views listed in the UX audit Outcomes). | `2026-10-29-ux-open-items.md` Task 10 Step 2 |
| 6 | Owner-only steps remain unticked: avatar migration `0013_user_avatar.sql` and deploy, the speed/tix/analytics guide, the post-incident hardening list in `docs/RELEASE.md:257-267`. | owner guides, `RELEASE.md` |
| 7 | UX audit items still marked `later`: UX-6, 10, 28, 38, 45, 57. | `2026-10-27-ux-audit.md` |

Items 5 (signed-in checks) and 6 need the owner. The agent prepares and records them but never performs them.

---

## Task 1: Turn CI green (lint errors in `theme-init.js`)

**Files:** modify `public/theme-init.js`.

- [x] **Step 1:** Run `npm run lint`; confirm exactly the three errors above.
- [x] **Step 2:** Change the three `catch (e) {` to optional catch binding `catch {`. This file is plain JS served before the bundle, so confirm the target browsers support it (all current evergreen browsers do). If a theme test asserts the file's text, run it.
- [x] **Step 3:** `npm run lint` shows 0 errors. Do not "fix" the 12 warnings in this task.
- [x] **Step 4:** `npm test` and `npm run typecheck` pass. Commit `fix(theme): drop the unused catch bindings in the init script`.

## Task 2: Lint warnings triage

**Files:** whatever `npm run lint` names.

- [x] **Step 1:** List the 12 warnings. Fix the 6 auto-fixable ones with `npx eslint . --fix` and read the diff before committing; revert any change that alters behaviour.
- [x] **Step 2:** The `vue/no-v-html` warning on `src/views/orgs/OrgProfileView.vue:126` is a known DOMPurify-sanitised use. Add a one-line `eslint-disable-next-line` with the reason, only if the content really is sanitised on that path (verify; if not, that is a security bug, stop and report).
- [x] **Step 3:** Leave anything else that needs a judgment call and list it in the commit body. `npm run lint` ends with 0 errors; `npm test` passes. Commit `chore(lint): clear the auto-fixable warnings`.

## Task 3: Retire stale plans

**Files:** the plan files listed in finding 3; `AGENTS.md` (only if a table row is wrong).

- [x] **Step 1:** For each stale plan, verify the work exists in code (examples: `backend/src/middleware/requireAuth.ts`, `shared/admin.ts`, Vitest config and `*.test.ts` files, `scripts/doctor` and `scripts/release-check.mjs`, the toast and dialog host from the notifications plan). Use `git log --oneline -- <path>` as evidence.
- [x] **Step 2:** For each verified plan, add a first-line banner `> **Status: done.** Shipped in <commit>. Boxes below were not ticked at the time.` and do not rewrite the body. If a plan was only partly done, tick what is done and write what remains as a note, do not guess.
- [x] **Step 3:** In `docs/superpowers/plans/2026-10-25-eypi-overhaul.md` the unticked boxes at lines 127, 338-340, 391, 496, 594, 600 and 703-716 are verification steps. Do **not** tick the owner ones (curl against production, Turso rehearsal, manual regression). Tick only items you can prove from the repo (for example `grep -rn "AppCursor\|AppLoader\|useKeyboardNav" src` is empty; lint/typecheck/test/build green after Task 1).
- [x] **Step 4:** Line 704 requires every CRIT/HIGH/MED `F-*` finding to be fixed (cite the commit) or listed under Accepted risks. Produce a table in a new section at the end of the overhaul plan: finding ID, status (fixed with commit hash / accepted / **unresolved**). Any unresolved CRIT or HIGH is reported to the owner in the final message and not silently fixed in this task.
- [x] **Step 5:** Commit `docs(plan): mark shipped plans done and map findings to outcomes`.

## Task 4: Close the cheap accepted risks (one commit each, test first)

Read the full rows in `docs/operations.md:168-185`. Do only the ones below; the rest stay accepted.

- [x] **4a. Last-admin guard (atomic).** Make the "cannot remove the last admin" check a single guarded statement (`UPDATE ... WHERE (SELECT COUNT(*) ...) > 1`) or a batch with a rollback condition. Test: two concurrent demotions of the only two admins leave one admin. Commit `fix(admin): make the last-admin guard atomic`.
- [x] **4b. Consent writes.** Insert all consent rows in one `batch` so a failure leaves no partial record. Failing test first with a mocked second-row failure. Commit `fix(consent): write consent rows in one batch`.
- [x] **4c. Media cleanup.** Deleting a link deletes its R2 object (best effort, log the key not the user); a PATCH with an oversized data URL returns 4xx and leaves the stored logo unchanged. Commit `fix(links): remove the logo object on delete and keep it on a rejected patch`.
- [ ] **4d. Privacy copy.** The privacy page says the session cookie is the only cookie; sign-in also sets the short-lived `eypi_oauth` cookie. Fix the copy (see `DESIGN_SYSTEM.md` for copy rules) and its test if present. Commit `docs(privacy): mention the short-lived sign-in cookie`.
- [ ] **4e. F-TIX-14 residual.** Remove or make configurable the `reviewStatus: UNDER_REVIEW` in the Google Wallet save token **only if** the owner's Google Wallet issuer is approved. Ask the owner first; if unanswered, leave it.
- [ ] **Step Z:** Update the status column in `docs/operations.md` for each item closed (`fixed in <hash>`). Items not touched stay "pending owner sign-off". Commit `docs(ops): record the closed accepted risks`.

Not in this task (need an owner decision or infrastructure): F-SEC-7 atomic rate limiter, `IP_HASH_SECRET`, F-TIX-2 residual lock recovery, F-TIX-12 residual CSV parsing, account deletion scope, Safe Browsing fail-open, F-SEO-1 residual.

## Task 5: Frontend dependency audit

- [ ] **Step 1:** `npm audit --omit=dev` and `npm ls uuid`. The moderate advisory is `uuid < 11.1.1` pulled in by `exceljs`.
- [ ] **Step 2:** If an `exceljs` release or an `overrides` entry fixes it without a breaking change to Tix upload, apply it, run the Tix import tests and `npm run build`, and compare bundle sizes with `npm run release:check` output. If the only fix is `npm audit fix --force`, do not run it; record the finding in Accepted risks with the reason.
- [ ] **Step 3:** Commit `chore(deps): patch the uuid advisory` or `docs(ops): accept the uuid advisory`.

## Task 6: Owner checklist handoff (no code)

**Files:** create `docs/owner-checklist-2026-10-29.md`.

- [ ] **Step 1:** Collect every still-open owner step into one short list, in order, each with a check and what to send back: avatar guide parts 1 to 3 (`docs/owner-guide-avatar-picker.md`; the migration must be applied **before** the backend deploy), the unticked parts of `docs/owner-guide-speed-tix-analytics.md`, and `docs/RELEASE.md:257-267` (DMARC/SPF, WAF/HSTS, CAA, domain auto-renew 2027-02-28, passkeys, secrets, `security.txt` expiry 2027-10-27).
- [ ] **Step 2:** Add the signed-in browser pass from finding 5 as a short list of routes (`/admin/speed` with the 7 and 28 day buttons, `/links`, `/manage/tix`, an event's attendees, `/forms/visitors-pass`, `/forms/letter-of-intent`, an org's members, `/admin/users`, `/admin/links`) to look at in light, dark and true black on a phone and a desktop, **without clicking anything that writes**.
- [ ] **Step 3:** Do not run any owner step. Commit `docs(owner): add the open owner checklist`.

## Task 7 (optional, only if the owner says go): UX audit "later" items

UX-6, 10, 28, 38, 45, 57 are each a design decision (see the reasons at `2026-10-27-ux-audit.md:174-225`). Do not start them without a spec per item. Ask the owner which, if any, they want.

---

## Definition of done for this round

1. `npm run lint` has 0 errors; `npm run typecheck`, `npm test` and `npm run build` pass.
2. Tasks 1 to 6 are ticked and committed; CI is green on `main`.
3. The final message to the owner lists: any unresolved CRIT/HIGH finding from Task 3, the accepted risks still open, and the owner checklist path. It states plainly what was not verified (everything signed-in).
4. Nothing was pushed, deployed, migrated or configured.
