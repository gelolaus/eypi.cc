# Auth Middleware Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a `requireAuth` Hono middleware (sibling to the existing `isOrgFeature`) and migrate `backend/src/routes/links.ts`'s five hand-rolled JWT-verification blocks onto it, so `links.ts` stops being the one route file that never adopted the shared `getUser()` helper.

**Architecture:** `requireAuth` wraps the existing `getUser()` helper from `lib/db.ts` — no new JWT logic — and follows `orgGuard.ts::isOrgFeature`'s exact shape (same `Context`/`Variables` type parameters, `c.set('userId', ...)`, `c.set('userEmail', ...)`, `await next()`). `links.ts`'s protected routes stop parsing `Authorization` headers themselves and read `c.var.userId` instead.

**Tech Stack:** Hono middleware, `hono/jwt` (already a dependency), Vitest (established by the test-foundation plan).

## Global Constraints

- Do not change JWT issuance, expiry duration, or the JWT secret.
- Do not touch `isOrgFeature` itself.
- Do not touch `events.ts`, `dp.ts`, `forms.ts`, or `orgs.ts` — they already use `getUser()`; migrating their repeated inline guards is separate follow-up work.
- The public `GET /api/links/:slug` route (SPA-fallback redirect lookup) stays unauthenticated — do not add `requireAuth` to it.
- Source RFC: [docs/superpowers/plans/2026-07-12-auth-middleware-rfc.md](docs/superpowers/plans/2026-07-12-auth-middleware-rfc.md).

---

### Task 1: Write and test the `requireAuth` middleware

**Files:**
- Create: `backend/src/middleware/requireAuth.ts`
- Test: `backend/src/middleware/requireAuth.test.ts`

**Interfaces:**
- Consumes: `getUser` from `backend/src/lib/db.ts` (existing, unchanged):
  ```ts
  export async function getUser(c: { req: { header: (k: string) => string | undefined }; env: Bindings }): Promise<JWTPayload | null>
  ```
- Produces:
  ```ts
  export const requireAuth: (c: Context<{ Bindings: Bindings; Variables: { userId: string; userEmail: string } }>, next: Next) => Promise<Response | void>
  ```
  Sets `c.var.userId` and `c.var.userEmail` on success; later tasks in this plan (and the auth-middleware RFC's Task 2 in `links.ts`) read those.

- [ ] **Step 1: Write the failing test**

Create `backend/src/middleware/requireAuth.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { sign } from 'hono/jwt'
import { requireAuth } from './requireAuth'

const JWT_SECRET = 'test-secret'

function makeContext(headers: Record<string, string>) {
  const vars: Record<string, unknown> = {}
  return {
    req: { header: (k: string) => headers[k] },
    env: { JWT_SECRET },
    set: (key: string, value: unknown) => { vars[key] = value },
    var: vars,
    json: (body: unknown, status: number) => ({ body, status }),
  }
}

describe('requireAuth', () => {
  it('calls next and sets userId/userEmail for a valid token', async () => {
    const token = await sign(
      { sub: 'user-1', email: 'user@student.apc.edu.ph', exp: Math.floor(Date.now() / 1000) + 3600 },
      JWT_SECRET,
    )
    const c = makeContext({ Authorization: `Bearer ${token}` })
    const next = vi.fn(async () => {})

    await requireAuth(c as never, next)

    expect(next).toHaveBeenCalledOnce()
    expect(c.var.userId).toBe('user-1')
    expect(c.var.userEmail).toBe('user@student.apc.edu.ph')
  })

  it('returns 401 without calling next when the Authorization header is missing', async () => {
    const c = makeContext({})
    const next = vi.fn(async () => {})

    const result = await requireAuth(c as never, next)

    expect(next).not.toHaveBeenCalled()
    expect(result).toEqual({
      body: { error: 'Unauthorized', message: 'Missing or invalid token' },
      status: 401,
    })
  })

  it('returns 401 for a malformed token', async () => {
    const c = makeContext({ Authorization: 'Bearer not-a-real-jwt' })
    const next = vi.fn(async () => {})

    await requireAuth(c as never, next)

    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 for an expired token', async () => {
    const token = await sign(
      { sub: 'user-1', email: 'user@student.apc.edu.ph', exp: Math.floor(Date.now() / 1000) - 10 },
      JWT_SECRET,
    )
    const c = makeContext({ Authorization: `Bearer ${token}` })
    const next = vi.fn(async () => {})

    await requireAuth(c as never, next)

    expect(next).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`

Expected: FAIL — `backend/src/middleware/requireAuth.ts` doesn't exist yet (module not found).

- [ ] **Step 3: Implement `requireAuth`**

Create `backend/src/middleware/requireAuth.ts`:

```ts
import { Context, Next } from 'hono'
import { getUser } from '../lib/db'
import type { Bindings } from '../lib/db'

export const requireAuth = async (
  c: Context<{ Bindings: Bindings; Variables: { userId: string; userEmail: string } }>,
  next: Next,
) => {
  const user = await getUser(c as any)
  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'Missing or invalid token' }, 401)
  }
  c.set('userId', user.sub)
  c.set('userEmail', user.email)
  await next()
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`

Expected: PASS — 4 new tests green, plus the 16 tests from the test-foundation plan (20 total).

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/requireAuth.ts backend/src/middleware/requireAuth.test.ts
git commit -m "feat(backend): add requireAuth middleware"
```

---

### Task 2: Migrate `links.ts` onto `requireAuth`

**Files:**
- Modify: `backend/src/routes/links.ts`

**Interfaces:**
- Consumes: `requireAuth` from `backend/src/middleware/requireAuth.ts` (Task 1).
- No new exports — `links.ts`'s route signatures (paths, methods, response bodies) are unchanged; only how each route obtains the user id changes.

- [ ] **Step 1: Add the `Variables` type parameter and import**

At the top of `backend/src/routes/links.ts`, change:

```ts
import type { Bindings } from '../lib/db'
```

to:

```ts
import type { Bindings } from '../lib/db'
import { requireAuth } from '../middleware/requireAuth'
```

and change:

```ts
const app = new Hono<{ Bindings: Bindings }>()
```

to:

```ts
const app = new Hono<{ Bindings: Bindings; Variables: { userId: string; userEmail: string } }>()
```

- [ ] **Step 2: Migrate `GET /api/links`**

Replace:

```ts
app.get('/api/links', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing or malformed token' }, 401)
  }
  const token = authHeader.split(' ')[1]
  if (!token) return c.json({ error: 'Unauthorized', message: 'Missing or malformed token' }, 401)
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { sub: string }
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const result = await db.execute({
      sql: 'SELECT id, original_url, slug, clicks FROM links WHERE user_id = ? ORDER BY created_at DESC',
      args: [payload.sub],
    })
```

with:

```ts
app.get('/api/links', requireAuth, async (c) => {
  try {
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const result = await db.execute({
      sql: 'SELECT id, original_url, slug, clicks FROM links WHERE user_id = ? ORDER BY created_at DESC',
      args: [c.var.userId],
    })
```

(keep the rest of the handler body, the `catch` block, and its response unchanged).

- [ ] **Step 3: Migrate `GET /api/links/:id/analytics`**

Same pattern: add `requireAuth` as the second argument to `app.get('/api/links/:id/analytics', ...)`, delete the manual `authHeader`/`token`/`verify` block, replace `payload.sub` with `c.var.userId` in the `ownership` query's `args`.

- [ ] **Step 4: Migrate `PUT /api/links/:id`**

Same pattern: add `requireAuth`, delete the manual block, replace every `payload.sub` in this handler with `c.var.userId`.

- [ ] **Step 5: Migrate `DELETE /api/links/:id`**

Same pattern.

- [ ] **Step 6: Migrate `POST /api/links`**

Same pattern. Do **not** touch `GET /api/links/:slug` (the public redirect-lookup route) — it stays exactly as-is, unauthenticated.

- [ ] **Step 7: Remove the now-unused `verify` import if nothing else in the file uses it**

Check remaining usages of `verify` in `links.ts` after the migration; if none remain, remove `import { verify } from 'hono/jwt'`.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`

Expected: PASS — no test directly exercises `links.ts`'s routes (out of scope per the test-foundation RFC), but this confirms nothing else broke (imports resolve, no syntax errors caught by Vitest's transform step).

- [ ] **Step 9: Type-check the backend**

Run: `npx tsc --noEmit -p backend/tsconfig.json`

Expected: no new type errors from the migration (e.g. `c.var.userId` typed as `string`, matching the `Variables` type parameter added in Step 1).

- [ ] **Step 10: Commit**

```bash
git add backend/src/routes/links.ts
git commit -m "refactor(backend): migrate links.ts onto requireAuth"
```

## Self-Review Notes

- **Spec coverage:** every migration target named in the RFC (`GET /api/links`, `GET /api/links/:id/analytics`, `PUT /api/links/:id`, `DELETE /api/links/:id`, `POST /api/links`) has an explicit step in Task 2. The public `GET /api/links/:slug` route is explicitly called out as unchanged in three places (Global Constraints, Task 2 Step 6, and here) to avoid an accidental regression.
- **Type consistency:** `requireAuth`'s `Variables` type (`{ userId: string; userEmail: string }`) matches the type parameter added to `links.ts`'s `Hono` instance in Task 2 Step 1, and matches `isOrgFeature`'s existing `Variables` shape in `orgGuard.ts` — no new naming introduced.
- **No placeholders:** every step names the exact before/after code for `links.ts`'s migration, not "repeat the pattern" without showing it at least once per route.
