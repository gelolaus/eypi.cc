# RFC: Auth middleware for links.ts

Source: architecture candidate C1 from [2026-07-12-eypi-architecture-audit.md](2026-07-12-eypi-architecture-audit.md), scoped to `links.ts` only per maintainer decision (2026-07-12). Depends on the test-foundation RFC ([2026-07-12-test-foundation-rfc.md](2026-07-12-test-foundation-rfc.md)) landing first.

## Problem Statement

`links.ts` is the one route file that never adopted the shared `getUser()` helper already used by `orgs.ts`, `dp.ts`, and `events.ts` — it hand-rolls `Authorization` header parsing and `hono/jwt` `verify()` five separate times (once per route), with its own error handling copy-pasted each time. If I ever need to change how auth failures are reported, or add a check to the Auth seam (e.g. token revocation), I have to remember `links.ts`'s five copies exist separately from every other route file that already goes through the shared helper.

## Solution

Extract a `requireAuth` Hono middleware, mirroring the existing `isOrgFeature` middleware's shape (`backend/src/middleware/orgGuard.ts`), that wraps the existing `getUser()` helper from `lib/db.ts`, returns `401` when there's no valid authenticated user, and sets `userId`/`userEmail` on the request context otherwise. Mount it on `links.ts`'s protected routes and replace their manual `verify()` blocks with reads from the context.

## Commits

1. Write a failing unit test for a new `requireAuth` middleware: given a request with a valid Bearer token, it calls `next()` and sets `userId`/`userEmail` on the context; given a missing `Authorization` header, a malformed token, or an expired token, it returns `401` without calling `next()`.
2. Run the test, confirm it fails (the middleware doesn't exist yet).
3. Implement `requireAuth` in `backend/src/middleware/`, following `orgGuard.ts`'s existing shape (same `Context`/`Variables` type parameters, `c.set(...)`, `await next()`), built on top of the existing `getUser()` helper — no new JWT-verification logic, just a new wrapper around the one that exists.
4. Run the test, confirm it passes. Commit the middleware + its test together.
5. Migrate `links.ts`'s `GET /api/links` route: replace its manual `Authorization`/`verify()` block with `requireAuth` + reading the user id off the context.
6. Migrate `links.ts`'s `GET /api/links/:id/analytics` route the same way.
7. Migrate `links.ts`'s `PUT /api/links/:id` route the same way.
8. Migrate `links.ts`'s `DELETE /api/links/:id` route the same way.
9. Migrate `links.ts`'s `POST /api/links` route the same way. (`GET /api/links/:slug` — the public SPA-fallback redirect lookup — stays unauthenticated; it must not require a token and is not touched by this RFC.)
10. Manually smoke-test against `dev:local`: log in, list links, create a link, edit its slug/destination, delete it, and confirm an expired/missing/garbage token is rejected the same way it was before. Route-level automated tests are out of scope (see Testing Decisions).
11. Commit the full migration as one commit (five call sites, one mechanical change — no reason to split further).

## Decision Document

- The new middleware lives alongside `isOrgFeature` in the same middleware directory and follows the same shape — it's a second, general-purpose gate, not a replacement for the org-specific one. `isOrgFeature` continues to layer org-membership checking on top of authenticated identity for org-gated routes; `requireAuth` only asserts "there is a valid logged-in user."
- Error response shape for the migrated routes: confirm during implementation whether the frontend depends on today's exact shape (`{ error: 'Unauthorized', message: '...' }` on some `links.ts` routes vs. `{ error: 'Unauthorized' }` on others) before picking one canonical shape for `requireAuth` to return. This is a small implementation-time check (grep the frontend's link-management error handling), not a decision to make ahead of time.
- Only `links.ts` is migrated in this pass. `events.ts`'s ~20 routes also repeat an inline `getUser()` + `401` guard (part of C1's original problem statement in the Phase 1 audit), but collapsing those onto `requireAuth` is explicitly deferred to a follow-up RFC — scoping this one to the single file with zero shared-helper adoption keeps the change small and independently reviewable.
- No behavior change intended for the public, unauthenticated `GET /api/links/:slug` route.

## Testing Decisions

- `requireAuth` is tested directly with a hand-constructed fake context — an object satisfying the minimal shape the function actually touches (`req.header()`, `env.JWT_SECRET`, plus `set()` and a `next()` stub) — no live Turso, no real deployed JWT secret, just a fixture value. This follows the pattern established in the test-foundation RFC: plain input/output assertions, hand-rolled fakes, no mocking library.
- Route-level tests for the migrated `links.ts` endpoints are out of scope, for the same reason routes are out of scope in the test-foundation RFC: they call a live Turso client, and mocking or standing up a test database is a bigger, separate decision. This RFC relies on the middleware's unit test plus the manual `dev:local` smoke test in commit 10.
- Prior art: none yet beyond what the test-foundation RFC establishes; this RFC is the first consumer of that setup outside `shared/`.

## Out of Scope

- Migrating `events.ts`, `dp.ts`, `forms.ts`, or `orgs.ts` onto `requireAuth`. They already use the shared `getUser()` helper; collapsing their repeated inline guards into middleware is real follow-up work, just not this RFC.
- Any change to JWT issuance, token expiry duration, or the JWT secret itself.
- Any change to `isOrgFeature`.
- Rate-limiting behavior on any `links.ts` route (none currently exists there, and adding it isn't part of this RFC).

## Further Notes

- Land after the test-foundation RFC so `requireAuth`'s test has a runner to execute under.
- A natural follow-up RFC (not filed yet) would migrate `events.ts`'s ~20 routes onto `requireAuth` once this lands cleanly and the error-shape decision above has been made — that follow-up was flagged as "Worth exploring," not "Strong," in the Phase 1 audit (candidate C3 territory, but for auth specifically rather than the full file split).
