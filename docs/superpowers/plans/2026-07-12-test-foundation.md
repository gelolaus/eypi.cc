# Test Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a root-level Vitest test runner and write the first automated tests in the eypi.cc repo, covering the pure helpers in `shared/` (`reservedSlugs.ts`, `linksKv.ts`, `linkAnalytics.ts`), plus a CI workflow that runs the suite on every push and pull request.

**Architecture:** One Vitest config at the repo root (`vitest.config.ts`, kept separate from `vite.config.ts` so the Cloudflare/Vue Vite plugins never load during test runs) with `test.include` covering `shared/`, `src/`, and `backend/src/`. Tests for pure functions need no fakes; the one stateful function (`logLinkClick`) gets a hand-rolled fake `Client` object — no mocking library.

**Tech Stack:** Vitest (added as a root devDependency), TypeScript (already configured), GitHub Actions for CI.

## Global Constraints

- Do not modify `backend/.dev.vars`, `.env.local`, or any secret-bearing file.
- Do not add a mocking library (e.g. `vitest-mock-extended`, `sinon`) — use plain object literals for fakes, per the RFC's Testing Decisions.
- Do not touch any Hono route handler (`backend/src/routes/*.ts`) — out of scope per the RFC.
- Do not touch `backend/src/lib/rateLimit.ts`, `backend/src/lib/validateDestinationUrl.ts`, or `backend/src/lib/passes/context.ts` — deferred to a later pass.
- CI workflow must not be made a required/blocking check — just add the workflow file.
- Source RFC: [docs/superpowers/plans/2026-07-12-test-foundation-rfc.md](docs/superpowers/plans/2026-07-12-test-foundation-rfc.md).

---

### Task 1: Install Vitest and wire the root config

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `shared/reservedSlugs.test.ts`
- Test: `shared/reservedSlugs.test.ts` (this task's test *is* the deliverable — it also proves the runner is wired correctly)

**Interfaces:**
- Consumes: `isReservedSlug` from `shared/reservedSlugs.ts` (existing, unchanged):
  ```ts
  export function isReservedSlug(slug: string): boolean
  ```
- Produces: `npm test` and `npm run test:watch` scripts, usable by every later task in this plan and by the auth-middleware and auth-decode-dedup RFCs.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`

Expected: `vitest` added to `devDependencies` in `package.json`; `package-lock.json` updated.

- [ ] **Step 2: Add the root Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    include: [
      'shared/**/*.test.ts',
      'src/**/*.test.ts',
      'backend/src/**/*.test.ts',
    ],
    environment: 'node',
  },
})
```

- [ ] **Step 3: Add test scripts to `package.json`**

In the `"scripts"` block of the root `package.json`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write the first test — `shared/reservedSlugs.test.ts`**

Create `shared/reservedSlugs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isReservedSlug } from './reservedSlugs'

describe('isReservedSlug', () => {
  it('blocks known reserved slugs', () => {
    expect(isReservedSlug('links')).toBe(true)
    expect(isReservedSlug('orgs')).toBe(true)
    expect(isReservedSlug('dp')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isReservedSlug('LINKS')).toBe(true)
    expect(isReservedSlug('Orgs')).toBe(true)
  })

  it('allows slugs that are not reserved', () => {
    expect(isReservedSlug('my-cool-link')).toBe(false)
    expect(isReservedSlug('abc123')).toBe(false)
  })
})
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm test`

Expected: Vitest reports 1 test file, 3 passed tests, exit code 0. If the config is broken (wrong `include` glob, bad alias), this is where it surfaces — fix the config, not the test, if so.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts shared/reservedSlugs.test.ts
git commit -m "test: add Vitest and the first shared/ test (reservedSlugs)"
```

---

### Task 2: Test `shared/linksKv.ts`

**Files:**
- Create: `shared/linksKv.test.ts`

**Interfaces:**
- Consumes: `encodeLinkKvEntry`, `decodeLinkKvEntry` from `shared/linksKv.ts` (existing, unchanged):
  ```ts
  export type LinkKvEntry = { id: string; url: string }
  export function encodeLinkKvEntry(entry: LinkKvEntry): string
  export function decodeLinkKvEntry(raw: string | null): LinkKvEntry | null
  ```

- [ ] **Step 1: Write the test**

Create `shared/linksKv.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { encodeLinkKvEntry, decodeLinkKvEntry } from './linksKv'

describe('linksKv', () => {
  it('round-trips an entry through encode and decode', () => {
    const entry = { id: 'abc-123', url: 'https://example.com' }
    expect(decodeLinkKvEntry(encodeLinkKvEntry(entry))).toEqual(entry)
  })

  it('returns null for a null value', () => {
    expect(decodeLinkKvEntry(null)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(decodeLinkKvEntry('{not json')).toBeNull()
  })

  it('returns null when required fields are missing', () => {
    expect(decodeLinkKvEntry(JSON.stringify({ id: 'abc-123' }))).toBeNull()
    expect(decodeLinkKvEntry(JSON.stringify({ url: 'https://example.com' }))).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests and confirm they pass**

Run: `npm test`

Expected: 2 test files, 7 tests total, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add shared/linksKv.test.ts
git commit -m "test: add shared/linksKv encode/decode tests"
```

---

### Task 3: Test `shared/linkAnalytics.ts` — `sanitizeReferrer` and `getOS`

**Files:**
- Create: `shared/linkAnalytics.test.ts`

**Interfaces:**
- Consumes: `sanitizeReferrer`, `getOS` from `shared/linkAnalytics.ts` (existing, unchanged):
  ```ts
  export function sanitizeReferrer(raw: string | undefined): string
  export function getOS(userAgent: string | null): string
  ```

- [ ] **Step 1: Write the test**

Create `shared/linkAnalytics.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sanitizeReferrer, getOS } from './linkAnalytics'

describe('sanitizeReferrer', () => {
  it('classifies a known platform host', () => {
    expect(sanitizeReferrer('https://m.facebook.com/x')).toBe('Facebook')
  })

  it('strips a leading www. before checking the map', () => {
    expect(sanitizeReferrer('https://www.facebook.com/somepage')).toBe('Facebook')
  })

  it('falls back to the bare hostname for an unlisted site', () => {
    expect(sanitizeReferrer('https://www.some-unlisted-site.com')).toBe('some-unlisted-site.com')
  })

  it('classifies localhost', () => {
    expect(sanitizeReferrer('http://localhost:5173/')).toBe('Localhost')
  })

  it('returns Direct for an empty or undefined referrer', () => {
    expect(sanitizeReferrer(undefined)).toBe('Direct')
    expect(sanitizeReferrer('')).toBe('Direct')
  })

  it('returns Direct for an unparseable referrer', () => {
    expect(sanitizeReferrer('not a url at all::::')).toBe('Direct')
  })
})

describe('getOS', () => {
  it('detects each known platform', () => {
    expect(getOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows')
    expect(getOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('iOS')
    expect(getOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')).toBe('macOS')
    expect(getOS('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('Android')
    expect(getOS('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux')
  })

  it('returns Unknown for null or unrecognized user agents', () => {
    expect(getOS(null)).toBe('Unknown')
    expect(getOS('SomeBot/1.0')).toBe('Unknown')
  })
})
```

- [ ] **Step 2: Run the tests and confirm they pass**

Run: `npm test`

Expected: 3 test files, 15 tests total, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add shared/linkAnalytics.test.ts
git commit -m "test: add sanitizeReferrer and getOS tests"
```

---

### Task 4: Test `shared/linkAnalytics.ts` — `logLinkClick` with a fake Client

**Files:**
- Modify: `shared/linkAnalytics.test.ts`

**Interfaces:**
- Consumes: `logLinkClick` from `shared/linkAnalytics.ts` (existing, unchanged):
  ```ts
  export type LinkClickMetadata = {
    linkId: string
    slug: string
    userAgent: string | null
    referrer: string
    country: string
  }
  export async function logLinkClick(db: Client, meta: LinkClickMetadata): Promise<void>
  ```
- Produces: the fake-`Client` pattern (`{ execute: (query) => ... }`) that later tests of DB-touching helpers can copy.

- [ ] **Step 1: Add the test**

In `shared/linkAnalytics.test.ts`, add a new `describe` block (append to the existing file, keep the two `describe` blocks from Task 3 above):

```ts
import { logLinkClick } from './linkAnalytics'

describe('logLinkClick', () => {
  it('inserts an analytics row and increments the link click count', async () => {
    const calls: { sql: string; args: unknown[] }[] = []
    const fakeClient = {
      execute: async (query: { sql: string; args: unknown[] }) => {
        calls.push(query)
        return {} as unknown
      },
    }

    await logLinkClick(fakeClient as never, {
      linkId: 'link-1',
      slug: 'abc123',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      referrer: 'Facebook',
      country: 'PH',
    })

    expect(calls).toHaveLength(2)
    expect(calls[0].sql).toContain('INSERT INTO analytics')
    expect(calls[0].args).toEqual(['link-1', 'Windows', 'PH', 'Facebook'])
    expect(calls[1].sql).toContain('UPDATE links SET clicks')
    expect(calls[1].args).toEqual(['abc123'])
  })
})
```

Note: `logLinkClick` already imports `Client`'s type only (`import type { Client } from '@libsql/client/web'`), so the fake only needs to satisfy the two methods actually called (`execute`) — casting with `as never` sidesteps the full `Client` interface without pulling in a mocking library.

- [ ] **Step 2: Run the tests and confirm they pass**

Run: `npm test`

Expected: 3 test files, 16 tests total, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add shared/linkAnalytics.test.ts
git commit -m "test: add logLinkClick test with a fake Client"
```

---

### Task 5: Add CI workflow

**Files:**
- Create: `.github/workflows/test.yml`

**Interfaces:**
- Consumes: `npm test` (produced by Task 1).
- Produces: a GitHub Actions check named `test` visible on pushes and pull requests.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/test.yml`:

```yaml
name: Test

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
```

- [ ] **Step 2: Verify the workflow file is valid YAML**

Run: `npx js-yaml .github/workflows/test.yml` (or open the file and visually confirm indentation — `js-yaml` isn't an installed dependency; skip this step if it's not available and rely on GitHub's own validation after push)

Expected: no YAML parse error printed. If `js-yaml` isn't available, proceed to Step 3 and let GitHub Actions itself validate on push.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml
git commit -m "ci: run the Vitest suite on push and pull_request"
```

- [ ] **Step 4: Push and confirm the Action run succeeds**

Run: `git push`

Expected: this cannot be verified locally. After pushing, check the repository's Actions tab and confirm the "Test" workflow run is green. Flag this explicitly when reporting completion, since it's the one step in this plan that needs the maintainer to check GitHub's UI.

---

## Self-Review Notes

- **Spec coverage:** every commit from the source RFC ([2026-07-12-test-foundation-rfc.md](docs/superpowers/plans/2026-07-12-test-foundation-rfc.md)) maps to a task above: Vitest setup → Task 1; `reservedSlugs` test → Task 1; `linksKv` test → Task 2; `linkAnalytics` (`sanitizeReferrer`/`getOS`) → Task 3; `linkAnalytics` (`logLinkClick`) → Task 4; CI workflow → Task 5.
- **Type consistency:** `logLinkClick`'s fake `Client` in Task 4 matches the real function signature (`db: Client, meta: LinkClickMetadata`) and the real SQL/arg shapes read directly from `shared/linkAnalytics.ts`'s current implementation (`INSERT INTO analytics (link_id, os, country, referrer)` and `UPDATE links SET clicks = COALESCE(clicks, 0) + 1 WHERE slug = ?`).
- **No placeholders:** every step has exact file paths, exact code, and exact commands with expected output.
