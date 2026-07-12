# RFC: Test foundation (shared/ pure modules)

Source: architecture candidate C5 from [2026-07-12-eypi-architecture-audit.md](2026-07-12-eypi-architecture-audit.md). Land before the auth-middleware and auth-decode-dedup RFCs — both reuse the Vitest setup this RFC introduces.

## Problem Statement

There isn't a single automated test anywhere in eypi.cc — no test runner, no `.test.ts` files, nothing. I want to start somewhere safe and cheap: the pure helpers in `shared/` that already have narrow, well-defined interfaces (encode/decode a KV entry, classify a referrer, check a reserved slug), without inventing a testing strategy for the whole app. The Hono routes stay untested for now — they're tied to a live Turso client, and I intentionally run local dev against the production database, so route-level testing is a separate, bigger conversation. I also want CI to run whatever tests exist, so regressions get caught on a PR rather than after a deploy.

## Solution

Add Vitest as a root devDependency. Wire a single root Vitest config that picks up test files across `shared/`, `src/`, and `backend/src/` — one runner for all three source trees, since none of the modules in scope need the actual Cloudflare Workers runtime to execute correctly. Write unit tests for `shared/reservedSlugs.ts`, `shared/linksKv.ts`, and `shared/linkAnalytics.ts`. Add a GitHub Actions workflow that runs the suite on every push and pull request.

## Commits

1. Add `vitest` as a root devDependency.
2. Add a root Vitest config (either a standalone `vitest.config.ts`, or a `test` block added to the existing `vite.config.ts`) with `test.include` covering `shared/**/*.test.ts`, `src/**/*.test.ts`, and `backend/src/**/*.test.ts`. Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to the root `package.json`.
3. Write `shared/reservedSlugs.test.ts`: known reserved slugs (e.g. `links`, `orgs`, `dp`) are blocked; matching is case-insensitive; an arbitrary unreserved slug is allowed.
4. Run the suite, confirm it passes, commit the config + first test file together (a config with no tests proves nothing).
5. Write `shared/linksKv.test.ts`: `encodeLinkKvEntry` → `decodeLinkKvEntry` round-trips an entry; `decodeLinkKvEntry(null)` returns `null`; malformed JSON returns `null`; valid JSON missing the required `id`/`url` shape returns `null`.
6. Write `shared/linkAnalytics.test.ts`: `sanitizeReferrer` correctly classifies a known platform host, a `www.`-prefixed known host, a `localhost` referrer, an empty/undefined referrer (`'Direct'`), and a malformed URL string (falls back to `'Direct'`); `getOS` returns the right label for each branch (`Windows`, `iOS`, `macOS`, `Android`, `Linux`, `Unknown`) plus a `null` user agent; `logLinkClick` issues exactly the two expected statements (insert + update) against a hand-rolled fake `Client`.
7. Add `.github/workflows/test.yml` running `npm ci` then `npm test` on `push` and `pull_request`.
8. Push and confirm the Action run succeeds (this can't be verified locally — flag it in the PR description so the maintainer checks the Actions tab once it's up).

## Decision Document

- One root-level Vitest instance covers all three source trees (`shared/`, `src/`, `backend/src/`) instead of a per-package runner. `backend/` is a separate npm package (own `package.json`, deployed independently via Wrangler), but its pure helpers don't need the Workers runtime to be tested correctly — Vitest's plain Node execution is enough for functions that only take/return plain values or a hand-rolled fake.
- Route handlers (`links.ts`, `events.ts`, `orgs.ts`, `dp.ts`, `forms.ts`, `auth.ts`, `stats.ts`) are explicitly out of scope for this pass — they call a live Turso client directly, and the maintainer's local-dev workflow intentionally points at the production database, so a route-testing strategy needs its own decision (mocking the client vs. a disposable test DB vs. something else) that isn't being made here.
- `backend/src/lib/rateLimit.ts`, `backend/src/lib/validateDestinationUrl.ts`, and `backend/src/lib/passes/context.ts` are deliberately deferred — they're also pure/near-pure and good future candidates, but were not part of the scope picked for this pass, and `rateLimit` in particular needs a fake `KVNamespace`, a slightly bigger lift than the zero-dependency functions in `shared/`.
- CI runs on every push and pull request. It does not gate deploys or become a required check in branch protection — that's a separate repo-settings decision for the maintainer.

## Testing Decisions

- Good tests here assert observable behavior — given this input, this output or this side effect — not implementation details. `sanitizeReferrer('https://m.facebook.com/x')` returning `'Facebook'` is a good assertion; asserting that the function looked up a specific map key is not.
- `linkAnalytics.logLinkClick` needs a fake `Client`: a plain object literal with an `execute` method that records its calls (e.g. push each `{ sql, args }` into an array and resolve). No mocking library — the codebase has none installed, and a hand-rolled fake is enough for two `execute()` calls.
- There's no prior art for tests in this codebase (zero exist today). The style established here — plain input/output assertions, hand-rolled fakes over mocking frameworks, no snapshot testing — is the pattern later test-writing (including the auth-middleware and auth-decode-dedup RFCs) should follow.

## Out of Scope

- Any Hono route handler in `backend/src/routes/`.
- `backend/src/lib/validateDestinationUrl.ts`, `backend/src/lib/rateLimit.ts`, `backend/src/lib/passes/context.ts` — good next candidates, not this pass.
- Vue component tests (no Vue Test Utils setup added here).
- End-to-end or browser-based testing.
- Making the new CI workflow a required/blocking check.

## Further Notes

- The auth-middleware RFC ([2026-07-12-auth-middleware-rfc.md](2026-07-12-auth-middleware-rfc.md)) and the auth-decode-dedup RFC ([2026-07-12-auth-decode-dedup-rfc.md](2026-07-12-auth-decode-dedup-rfc.md)) both add tests for the new code they introduce, using this same Vitest setup. Land this RFC first.
