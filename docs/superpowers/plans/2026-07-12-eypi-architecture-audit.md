# eypi.cc Architecture Audit — 2026-07-12

Phase 1 output of the `improve-codebase-architecture` skill. Explored the monorepo against `CONTEXT.md`'s module map, seam list, and domain glossary. Vocabulary: module, interface, implementation, depth, seam, adapter, leverage, locality (from `codebase-design`).

Coverage: links+redirects+KV, auth, orgs/membership/active-org, events/Tix, Forms, Frames/DP, analytics, reserved slugs, rate limiting, wallet passes, local/prod operability.

No code changes were made producing this document. No ADRs currently exist under `docs/adr/`.

---

## Headline findings

- **Zero automated tests anywhere in the repo.** No `.test.ts`/`.spec.ts` files, no test runner configured, across `backend/`, `shared/`, `worker/`, `src/`.
- **The Auth seam (named in `CONTEXT.md`'s "Important seams" table) is shallow in two independent ways**: `backend/src/routes/links.ts` reimplements JWT parsing from scratch 5 times instead of the `getUser()` helper `orgs.ts`/`dp.ts`/`events.ts` already share; and `events.ts` repeats the `getUser()` → 401 guard inline at ~20 routes instead of using a middleware, even though `orgGuard.ts`'s `isOrgFeature` already proves the middleware pattern works (and `orgs.ts` already uses `app.use('*', ...)` for exactly this).
- **JWT-payload decoding exists in three independent places**: `backend/src/lib/db.ts::getUser` (verified), `src/composables/useAuth.ts::getUser` (manual decode, checks `exp`), `src/router/index.ts` (inline manual decode for the super-admin route guard — doesn't call `useAuth().getUser()`, doesn't check `exp`).
- `events.ts` is 1,276 lines / 20 routes spanning four concerns that `CONTEXT.md`'s own glossary already names separately (event, selection mode/finalize/cluster, check-in, pass token).

---

## Candidates

### C1 — Strong — Deepen auth into a Hono middleware

**Files:** `backend/src/routes/links.ts` (5 inline `verify()` calls), `backend/src/routes/events.ts` (~20 repeated `getUser()` + 401 guards), `backend/src/routes/dp.ts` (7 repeats), `backend/src/middleware/orgGuard.ts` (`isOrgFeature` — the existing pattern to generalize), `backend/src/routes/orgs.ts` (already does `app.use('*', ...)` once — proof this works)

**Problem:** `links.ts` never adopted the shared `getUser()` helper in `lib/db.ts` — it reimplements `Authorization` header parsing + `hono/jwt` verify from scratch 5 times, with its own slightly different error shapes each time. Meanwhile `events.ts` *does* use the shared `getUser()`, but repeats the "if (!user) return 401" guard as literal boilerplate at every one of its ~20 routes instead of hoisting it into middleware.

**Solution:** Add a `requireAuth` middleware (sibling to `isOrgFeature`) that sets `c.var.userId` / `userEmail` once; mount it per-router the way `orgs.ts` already does. Migrate `links.ts` off its manual `verify()` calls.

**Wins:** locality (one seam owns identity extraction) · leverage (one interface change fixes every route) · interface shrinks · tests hit one interface instead of N re-derivations.

**Severity:** Strong. Highest-duplication, most-named seam, real bug risk (a route that forgets its 401 guard, or diverges in JWT error handling as `links.ts` already has).

### C2 — Strong, quick win — Collapse triplicated JWT-decode + duplicated SUPER_ADMIN_EMAIL

**Files:** `backend/src/lib/db.ts` (`getUser`), `src/composables/useAuth.ts` (`getUser`), `src/router/index.ts` (inline decode, no `exp` check, doesn't call `useAuth`), `backend/src/routes/orgs.ts` (`SUPER_ADMIN_EMAIL` hardcoded), `src/config/admin.ts` (same constant duplicated verbatim)

**Problem:** Three independent JWT-payload decoders across the SPA/API seam. The router's inline decode duplicates logic already in `useAuth` but without the expiry check — it can drift silently. `SUPER_ADMIN_EMAIL` is duplicated as a literal string on both sides of the seam despite `shared/` existing for exactly this kind of contract.

**Solution:** `router/index.ts` calls `useAuth().getUser()` instead of re-decoding. Move `SUPER_ADMIN_EMAIL` into `shared/` (e.g. `shared/admin.ts`), imported by both `orgs.ts` and `config/admin.ts`.

**Wins:** locality (one place decode logic lives) · one constant instead of two to keep in sync · interface is the test surface.

**Severity:** Strong, small, safe — natural companion to C1.

### C3 — Worth exploring — Split events.ts along CONTEXT.md's own seams

**Files:** `backend/src/routes/events.ts` (entire 1,276-line file, 20 routes). Domain terms already exist in `CONTEXT.md`: event, selection mode, finalize, cluster, check-in, attendee, pass token.

**Problem:** One module's interface (20 routes) is nearly as complex as its implementation. Four distinct concerns share one file: event CRUD; CSV/selection wizard (`upload-csv`, `column-mapping`, `csv-data`, `clusters`, `raffle`, `finalize`); check-in (`checkin`, `checkin-manual`, `checkout`, `remove`, `add-guest`); public ticket/wallet-pass issuance (`lookup`, `passes/apple`, `passes/google`). `requireEventLead` is called at the top of ~15 handlers but defined once in the same file.

**Solution:** Split into `events.ts` (core CRUD), `eventsSelection.ts` (CSV/cluster/finalize wizard), `eventsCheckin.ts` (checkin/checkout/remove/add-guest), `eventsPasses.ts` (lookup + wallet-pass issuance). Hono's `app.route()` composition (already used in `index.ts`) makes this mechanical.

**Wins:** locality (a check-in bug search stays inside ~250 lines, not 1,276) · interface per file shrinks · leverage (`requireEventLead` becomes one reusable import).

**Severity:** Worth exploring, not Strong — biggest, most product-critical file in the repo (Tix/ticketing). Low mechanical risk, but scope discipline matters.

**Status:** Not selected for Phase 2 in this pass.

### C4 — Worth exploring — Give the org-feature-gate seam its own adapter

**Files:** `src/composables/useOrgMembership.ts` (calls `/api/forms`, treats `403` as "no org," falls back to `/api/orgs`), `backend/src/middleware/orgGuard.ts` (`isOrgFeature`), `src/router/index.ts` (`requiresOrg` meta)

**Problem:** `CONTEXT.md` already names this seam ("org feature gate: backend `isOrgFeature` + frontend `requiresOrg` / `useOrgMembership`"), but the frontend adapter piggybacks on the Forms catalog endpoint's `403` instead of calling the gate directly, with an accidental second adapter (`/api/orgs` fallback) for when Forms 404s.

**Solution:** Expose `isOrgFeature`'s check as its own minimal endpoint (e.g. `GET /api/orgs/active`); point `useOrgMembership` at it directly.

**Wins:** leverage (`isOrgFeature` already exists) · locality (Forms' tests no longer implicitly gate an unrelated router guard).

**Open question for the maintainer:** was piggybacking on `/api/forms` deliberate (e.g. avoiding a round-trip), or organic accretion? If deliberate, this may warrant an ADR instead of a fix.

**Status:** Not selected for Phase 2 in this pass.

### C5 — Strong — Add tests behind the already-deep pure modules

**Files:** `shared/reservedSlugs.ts`, `shared/linksKv.ts`, `shared/linkAnalytics.ts`, `backend/src/lib/validateDestinationUrl.ts`, `backend/src/lib/rateLimit.ts`, `backend/src/lib/passes/context.ts` — zero test files anywhere in the repo today.

**Problem:** These modules are already deep (narrow interface, real logic behind it) and completely untested. `validateDestinationUrl` encodes security-relevant SSRF logic (private-IP/hostname blocking, IPv4/IPv6/hex/octal host-format parsing) with zero regression protection.

**Solution:** Add Vitest (fits the existing Vite toolchain). Start with the pure modules — no mocking needed for `reservedSlugs`/`linksKv`/`linkAnalytics`/`validateDestinationUrl`. `rateLimit` needs one in-memory KV fake — the second adapter (alongside the real Cloudflare `KVNamespace`) that justifies the seam already implicit in `checkRateLimit(kv: KVNamespace, ...)`.

**Wins:** interface is the test surface (these modules already expose the right interface, just no tests exercise it) · locality (a future regression is caught at the function boundary, not in production).

**Non-goal:** not "add integration tests for every route" — route handlers are tightly coupled to a live Turso client, and local dev intentionally runs against production Turso (`.cursor/rules/local-dev.mdc`). A full route-testing strategy is a separate, bigger conversation.

**Severity:** Strong — highest safety return for the lowest architectural risk of the six candidates.

### C6 — Speculative — Consolidate duplicated redirect-time protocol check

**Files:** `worker/index.ts` (edge redirect protocol check), `src/views/RedirectView.vue` (`isSafeRedirect`, near-identical check), `backend/src/lib/validateDestinationUrl.ts` (the real, thorough creation-time check)

**Problem:** Two call sites reimplement the same 6-line "protocol must be http/https" predicate for two genuinely different adapters (edge KV redirect vs. SPA fallback redirect) — a real seam, but the trivial predicate itself is duplicated rather than shared.

**Solution:** Move the predicate into `shared/` (e.g. `shared/urlSafety.ts`), imported by both.

**Wins:** leverage — one guard, two adapters (edge + SPA), the "two adapters justify a seam" case, just currently unshared.

**Severity:** Speculative — 6 lines, low risk, low urgency since destinations are already validated at creation time.

**Status:** Not selected for Phase 2 in this pass.

---

## Top recommendation

**C1 — deepen auth into a Hono middleware.** Highest leverage, sits on the most-explicitly-named seam in `CONTEXT.md` ("Auth"), and duplicated JWT-guard logic is the candidate most likely to cause a real bug. C2 is a natural, very low-risk companion in the same pass.

## Roadmap (P0 → P2)

- **P0 (selected for Phase 2, 2026-07-12):** C1, C2, C5.
- **P1 (deferred, revisit after P0 lands):** C3 (events.ts split) — mechanically low-risk but touches the biggest, most product-critical file; better attempted once C1's middleware pattern is proven in production.
- **P2 (deferred, needs a product/maintainer decision first):** C4 (org-gate adapter) — needs the open question above answered before scoping. C6 (redirect protocol check) — speculative, opportunistic only.

## Non-goals for this audit

- No separate dev database was proposed (per `.cursor/rules/local-dev.mdc` and `CONTEXT.md`).
- No rewrites proposed — every candidate is a deepening of an existing module or seam.
- No renaming of DP ↔ Frames vocabulary — `CONTEXT.md` already documents the intentional UI/API split.
- Rate limiting (`checkRateLimit`) and wallet-pass building (`applePass.ts`/`googleWallet.ts` sharing `context.ts`) were reviewed and found already deep/well-adapted — no candidate raised against them.
