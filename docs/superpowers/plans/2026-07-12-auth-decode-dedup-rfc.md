# RFC: Auth decode dedup (JWT payload + SUPER_ADMIN_EMAIL)

Source: architecture candidate C2 from [2026-07-12-eypi-architecture-audit.md](2026-07-12-eypi-architecture-audit.md). Depends on the test-foundation RFC ([2026-07-12-test-foundation-rfc.md](2026-07-12-test-foundation-rfc.md)) landing first. Independent of the auth-middleware RFC — can land before or after it.

## Problem Statement

The same JWT payload gets decoded three separate ways in this codebase: a verified decode on the backend (`lib/db.ts`), a manual decode with an expiry check in the frontend's `useAuth` composable, and a *third*, manual decode — no expiry check, and it doesn't call `useAuth` — inline in the router, just to check whether the current user is the super admin before allowing access to org-management settings. On top of that, the super-admin email itself is a hardcoded string duplicated in two places (backend `orgs.ts` and frontend `config/admin.ts`) with nothing keeping them in sync if it ever needs to change.

## Solution

Make the router's super-admin check call `useAuth().getUser()` instead of re-decoding the token inline. Move `SUPER_ADMIN_EMAIL` into `shared/` so both the backend org-management guard and the frontend admin config re-export from one source instead of each hardcoding it.

## Commits

1. Write a failing (or, if behavior already matches, a locking-in) unit test for `useAuth().getUser()`: a valid, non-expired token returns the decoded payload; an expired token returns `null`; a malformed token (wrong number of JWT segments, or unparseable base64/JSON) returns `null`; a missing token returns `null`.
2. Run the test, confirm it passes against the existing implementation — this commit locks in current behavior before anything downstream is changed to depend on it.
3. Add `shared/admin.ts` exporting `SUPER_ADMIN_EMAIL`.
4. Update `backend/src/routes/orgs.ts` to import `SUPER_ADMIN_EMAIL` from `shared/admin.ts` instead of declaring its own local constant.
5. Update `src/config/admin.ts` to re-export `SUPER_ADMIN_EMAIL` from `shared/admin.ts` instead of declaring it locally, keeping its existing export name so nothing importing `@/config/admin` elsewhere in the frontend needs to change.
6. Run the full test suite, confirm nothing broke, commit the constant move as one commit.
7. Update `src/router/index.ts`'s `requiresSuperAdmin` navigation guard to call `useAuth().getUser()` and check the returned payload's `email`, removing the inline `atob`/`JSON.parse` token decode and manual token-splitting.
8. Manually smoke-test: log in as a non-super-admin account and confirm `/settings/org-management` redirects away; log in as the super admin and confirm it loads normally; if feasible, test with a deliberately expired token to confirm the tightened expiry check now correctly denies access (see Decision Document — this is a real, intentional behavior change).
9. Commit the router guard change.

## Decision Document

- `shared/admin.ts` becomes the single source of truth for `SUPER_ADMIN_EMAIL`. `src/config/admin.ts` keeps its other existing exports (e.g. `AdminOrgListItem`) but re-exports the email constant rather than owning it, so no other frontend file importing from `@/config/admin` needs to change.
- The router's super-admin check gains the expiry check it was previously missing, as a direct side effect of reusing `useAuth().getUser()` (which already checks `exp`). This is called out explicitly as a behavior change, not just a refactor: an expired token can no longer appear to satisfy the super-admin check the way it silently could before.
- No change to what counts as "super admin" — it's still a single hardcoded email address. Moving to a role-based or database-backed admin check is explicitly not part of this RFC.

## Testing Decisions

- `useAuth().getUser()` is tested directly since it's effectively a pure function once a token string is available to it — whether the test supplies that via a fake `localStorage` entry or a small refactor to accept a token argument is an implementation detail to settle while writing the test, not a decision needed up front.
- No test is added for `shared/admin.ts` itself — a one-line re-exported constant has no behavior worth asserting.
- The router guard change is verified manually (commit 8), not with an automated test. Vue Router navigation guards need a router-plus-component test harness that isn't set up anywhere in this codebase yet; consistent with the test-foundation and auth-middleware RFCs treating integration-level surfaces (routes, navigation guards) as a separate, later effort rather than blocking this change on building that harness now.

## Out of Scope

- Changing who counts as a super admin, or moving to a role-based permissions system.
- Auditing for other constants duplicated across the SPA/API seam beyond `SUPER_ADMIN_EMAIL` — this RFC fixes the one found during the Phase 1 audit; a broader duplicate-constant sweep is separate work.
- Any change to JWT issuance or the token format itself.

## Further Notes

- Land after the test-foundation RFC so the `useAuth().getUser()` test has a runner to execute under.
- Independent of the auth-middleware RFC (`requireAuth`) — the two touch different files (`links.ts`/middleware vs. `router/index.ts`/`useAuth`/`config/admin.ts`) and can land in either order relative to each other, as long as both land after the test foundation.
