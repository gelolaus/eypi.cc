# Auth Decode Dedup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the router's third, independent JWT decode (inline `atob`/`JSON.parse`, no expiry check) onto the existing `useAuth().getUser()` composable, and move the duplicated `SUPER_ADMIN_EMAIL` constant (currently hardcoded in both `backend/src/routes/orgs.ts` and `src/config/admin.ts`) into `shared/` as the single source of truth.

**Architecture:** `shared/admin.ts` joins `shared/reservedSlugs.ts` and `shared/linksKv.ts` as a cross-boundary constant/utility module imported by both the backend (relative path) and the frontend (`@shared` alias). `src/router/index.ts` stops decoding tokens itself and depends on `useAuth()`, matching how every other authenticated surface in the frontend already gets the current user.

**Tech Stack:** Vue Router navigation guards, the `useAuth` composable, Vitest (`environment: 'node'` — this plan uses `vi.stubGlobal` for `localStorage` rather than switching to jsdom, since `useAuth.getUser()` needs nothing else from the DOM).

## Global Constraints

- Do not change JWT issuance, the token format, or the token's `exp` semantics.
- Do not change who counts as a super admin, or move to a role-based system — `SUPER_ADMIN_EMAIL` stays a single hardcoded address, just de-duplicated.
- `src/config/admin.ts` keeps its existing exports (`SUPER_ADMIN_EMAIL`, `AdminOrgListItem`) and its existing import path (`@/config/admin`) for every other frontend file that already imports from it — only the constant's *origin* changes.
- This plan intentionally introduces one behavior change, flagged in Task 3: the router's super-admin check gains the expiry check it was previously missing. This is correct and desired (a super admin with an expired token should not pass), not an accident to work around.
- Source RFC: [docs/superpowers/plans/2026-07-12-auth-decode-dedup-rfc.md](docs/superpowers/plans/2026-07-12-auth-decode-dedup-rfc.md).

---

### Task 1: Lock in `useAuth().getUser()`'s current behavior with a test

**Files:**
- Test: `src/composables/useAuth.test.ts`

**Interfaces:**
- Exercises the existing, unchanged `useAuth()` composable (`src/composables/useAuth.ts`) — no production code changes in this task.

- [ ] **Step 1: Write the test**

Create `src/composables/useAuth.test.ts`:

```ts
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useAuth } from './useAuth'

function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  return `${header}.${body}.fake-signature`
}

function stubToken(token: string | null) {
  const store: Record<string, string> = {}
  if (token) store.eypi_token = token
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useAuth().getUser', () => {
  it('returns the decoded payload for a valid, non-expired token', () => {
    stubToken(makeToken({ sub: 'user-1', email: 'user@student.apc.edu.ph', exp: Math.floor(Date.now() / 1000) + 3600 }))

    expect(useAuth().getUser()).toEqual({
      sub: 'user-1',
      email: 'user@student.apc.edu.ph',
      exp: expect.any(Number),
    })
  })

  it('returns null for an expired token', () => {
    stubToken(makeToken({ sub: 'user-1', email: 'user@student.apc.edu.ph', exp: Math.floor(Date.now() / 1000) - 10 }))

    expect(useAuth().getUser()).toBeNull()
  })

  it('returns null for a malformed token (wrong number of segments)', () => {
    stubToken('not-a-jwt')

    expect(useAuth().getUser()).toBeNull()
  })

  it('returns null for a token whose payload segment is not valid base64/JSON', () => {
    stubToken('aGVhZGVy.not-valid-base64!!.signature')

    expect(useAuth().getUser()).toBeNull()
  })

  it('returns null when there is no token', () => {
    stubToken(null)

    expect(useAuth().getUser()).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it passes against the existing implementation**

Run: `npm test`

Expected: PASS — this is a characterization test (RFC commit 1+2 combined), not TDD; `useAuth.ts` is not modified in this task. 5 new tests, 25 total.

- [ ] **Step 3: Commit**

```bash
git add src/composables/useAuth.test.ts
git commit -m "test(frontend): lock in useAuth().getUser() behavior"
```

---

### Task 2: Move `SUPER_ADMIN_EMAIL` into `shared/`

**Files:**
- Create: `shared/admin.ts`
- Modify: `backend/src/routes/orgs.ts`
- Modify: `src/config/admin.ts`

**Interfaces:**
- Produces: `shared/admin.ts` exporting `export const SUPER_ADMIN_EMAIL: string`.
- Consumed by: `backend/src/routes/orgs.ts` (relative import) and `src/config/admin.ts` (`@shared` alias re-export).

- [ ] **Step 1: Create `shared/admin.ts`**

```ts
// Single source of truth for the eypi.cc super-admin email — shared by the
// backend org-management guard (backend/src/routes/orgs.ts) and the
// frontend admin config (src/config/admin.ts) so the two can't drift.
export const SUPER_ADMIN_EMAIL = 'arlaus@student.apc.edu.ph'
```

- [ ] **Step 2: Update `backend/src/routes/orgs.ts`**

Change:

```ts
import { Hono } from 'hono'
import { z } from 'zod'
import { db, getUser } from '../lib/db'
import type { Bindings } from '../lib/db'
import type { Client } from '@libsql/client/web'

type Variables = {
  userId: string
  userEmail: string
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const TAGLINE_MAX = 160
const ABOUT_MAX = 8000
const URL_MAX = 2048
const IMAGE_DATA_URL_MAX = 2_800_000
const SUPER_ADMIN_EMAIL = 'arlaus@student.apc.edu.ph'
```

to:

```ts
import { Hono } from 'hono'
import { z } from 'zod'
import { db, getUser } from '../lib/db'
import type { Bindings } from '../lib/db'
import type { Client } from '@libsql/client/web'
import { SUPER_ADMIN_EMAIL } from '../../../shared/admin'

type Variables = {
  userId: string
  userEmail: string
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const TAGLINE_MAX = 160
const ABOUT_MAX = 8000
const URL_MAX = 2048
const IMAGE_DATA_URL_MAX = 2_800_000
```

- [ ] **Step 3: Update `src/config/admin.ts`**

Change:

```ts
export const SUPER_ADMIN_EMAIL = 'arlaus@student.apc.edu.ph'

export interface AdminOrgListItem {
```

to:

```ts
export { SUPER_ADMIN_EMAIL } from '@shared/admin'

export interface AdminOrgListItem {
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`

Expected: PASS, 25 tests (no test targets `shared/admin.ts` directly per the RFC's testing decision — a one-line re-exported constant has no behavior worth asserting).

- [ ] **Step 5: Type-check the backend**

Run: `npx tsc --noEmit -p backend/tsconfig.json`

Expected: same 3 pre-existing, unrelated errors in `forms.ts`/`orgs.ts` as the baseline recorded in the auth-middleware plan — no new errors from this change (`isSuperAdmin()` in `orgs.ts` still compares against a `string`, just imported instead of declared locally).

- [ ] **Step 6: Commit**

```bash
git add shared/admin.ts backend/src/routes/orgs.ts src/config/admin.ts
git commit -m "refactor: move SUPER_ADMIN_EMAIL into shared/"
```

---

### Task 3: Migrate the router's super-admin check onto `useAuth().getUser()`

**Files:**
- Modify: `src/router/index.ts`

**Interfaces:**
- Consumes: `useAuth` from `src/composables/useAuth.ts` (existing, tested in Task 1).

- [ ] **Step 1: Add the `useAuth` import and call it alongside the existing `useOrgMembership` call**

Change:

```ts
import { useOrgMembership } from '@/composables/useOrgMembership'
import { SUPER_ADMIN_EMAIL } from '@/config/admin'

const { checkOrgMembership } = useOrgMembership()
```

to:

```ts
import { useOrgMembership } from '@/composables/useOrgMembership'
import { useAuth } from '@/composables/useAuth'
import { SUPER_ADMIN_EMAIL } from '@/config/admin'

const { checkOrgMembership } = useOrgMembership()
const { getUser } = useAuth()
```

- [ ] **Step 2: Replace the inline decode in the `requiresSuperAdmin` guard**

Change:

```ts
  const requiresSuperAdmin = to.matched.some((record) => record.meta.requiresSuperAdmin)
  if (requiresSuperAdmin) {
    try {
      const token = localStorage.getItem('eypi_token')
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1] ?? ''))
        if (payload.email !== SUPER_ADMIN_EMAIL) {
          next({ name: 'settings-security', replace: true })
          return
        }
      } else {
        next({ name: 'login' })
        return
      }
    } catch {
      next({ name: 'settings-security', replace: true })
      return
    }
  }
```

to:

```ts
  const requiresSuperAdmin = to.matched.some((record) => record.meta.requiresSuperAdmin)
  if (requiresSuperAdmin) {
    const user = getUser()
    if (!user) {
      next({ name: 'login' })
      return
    }
    if (user.email !== SUPER_ADMIN_EMAIL) {
      next({ name: 'settings-security', replace: true })
      return
    }
  }
```

- [ ] **Step 3: Run the full test suite and the frontend build**

Run: `npm test`

Expected: PASS, 25 tests (no automated test exercises this navigation guard directly, per the RFC's testing decision — Vue Router integration testing isn't set up in this codebase yet; this is out of scope here).

Run: `npm run build`

Expected: builds cleanly — confirms the `router/index.ts` change type-checks and bundles (this file isn't covered by `backend/tsconfig.json`, so the frontend build is the type-safety net for it).

- [ ] **Step 4: Manual smoke test**

- Log in as a non-super-admin account, navigate to `/settings/org-management` → expect redirect to `/settings/security`.
- Log in as the super admin (`arlaus@student.apc.edu.ph`) → expect `/settings/org-management` to load normally.
- If feasible: manually expire or corrupt a super-admin token (e.g. edit `eypi_token` in `localStorage` via devtools) and confirm `/settings/org-management` now correctly redirects away instead of silently admitting an expired session — this is the intentional behavior fix called out in the RFC and in this plan's Global Constraints.

- [ ] **Step 5: Commit**

```bash
git add src/router/index.ts
git commit -m "refactor(frontend): router super-admin check uses useAuth().getUser()"
```

## Self-Review Notes

- **Spec coverage:** all 9 RFC commits map onto this plan's tasks — Task 1 = RFC commits 1–2, Task 2 = RFC commits 3–6, Task 3 = RFC commits 7–9.
- **Behavior-change transparency:** the expiry-check tightening is called out three times (Global Constraints, Task 3 intro comment implicit in the before/after diff, and the manual smoke-test step) so it's never silently absorbed into "just a refactor."
- **No placeholders:** every step shows the literal before/after diff for the three touched files, not a description of the change.
