# eypi.cc — Domain context

Product and architecture vocabulary for agents and humans. UI/visual rules live in `DESIGN_SYSTEM.md` — do not duplicate them here.

---

## Product

**eypi.cc** is a URL shortener and org-tool suite for the **Asia Pacific College (APC)** student community.

| Audience | What they use |
|---|---|
| Verified APC users | **Links** (personal short links) |
| Activated org members | **Forms**, **Frames**, **Tix** |
| Org owners / coordinators | Org profile, members, events, frames |
| Super admin | Create orgs; platform admin UI |

APC email domains only (`@apc.edu.ph`, `@student.apc.edu.ph`, plus a small admin whitelist). Not a public SaaS.

**Suite modules (product names):** Links · Forms · Frames · Tix · Orgs

---

## Domain glossary

Use these terms. Prefer them over invented synonyms.

| Term | Meaning |
|---|---|
| **link** / **short link** | User-owned mapping `eypi.cc/{slug}` → destination URL. Stored in `links`. Personal — **not** org-scoped. |
| **slug** | First path segment. Formats differ by context: link (random), event (`[a-z0-9]+`), DP campaign (`[a-z0-9-]+`). Org slug = `organizations.id`. |
| **reserved slug** | First-segment path blocked from link slugs so suite routes win. Source: `shared/reservedSlugs.ts`. |
| **redirect** | HTTP 301 (edge via `LINKS_KV`) or SPA fallback (`RedirectView` → API) from slug → destination. |
| **analytics** | Per-click rows for a link (`analytics` table) plus denormalized `links.clicks`. |
| **organization** / **org** | Student-org tenant. Primary key / public handle is the **org slug** (`organizations.id`). |
| **membership** | `org_members` row linking email → org. |
| **activated membership** | Membership with `activated_at` set (invite accepted). Required for org-gated features. |
| **owner** | `organizations.owner_id` — full org control. |
| **coordinator** | Owner or activated member who can edit org profile / manage suite content. |
| **active org** | Org context for a multi-org user. Client: `localStorage.active_org_id`. API: `X-Active-Org-Id`. |
| **event** | Org-scoped ticketed event (`events`). |
| **attendee** | Person with a ticket; has `qr_token`. |
| **ticket** | Attendee-facing QR + event info. |
| **pass token** | Short-lived JWT (`typ: 'pass'`) for Apple/Google wallet endpoints. |
| **pass** / **wallet pass** | Apple `.pkpass` or Google Wallet save URL. |
| **check-in** | Scan/log entry for an attendee (`check_ins`). |
| **selection mode** | Event not yet finalized (`selection_locked = 0`): CSV upload → column map → clusters → row select. |
| **finalize** | Lock selection; create attendees from selected CSV rows. |
| **cluster** | Quota/filter group used during selection/raffle. |
| **DP campaign** / **campaign** | Profile-frame campaign (API/DB: `dp_*`). |
| **Frames** | Product UI name for DP campaigns (`/manage/frames`, `/frames/:slug`). Prefer **Frames** in UI talk; **DP** in API/DB talk. |
| **frame** | PNG overlay image row (`dp_frames`). Max 10 per campaign. |
| **form** | Client-side document generator catalog item (DOCX fill). Not an HTML form builder. |
| **super admin** | Platform admin who can create orgs (hardcoded email check in API). |

---

## Module map

| Module | Path | Owns |
|---|---|---|
| **Frontend SPA** | `src/` | UI, routing, auth token storage, client form generation, DP canvas, QR display |
| **Frontend Worker** | `worker/index.ts` | Serves SPA assets at `eypi.cc`; **edge short-link redirects** via `LINKS_KV`; async click logging |
| **Backend API** | `backend/` | All `/api/*` on `api.eypi.cc` (Hono Worker): auth, links, orgs, events, DP, forms catalog/templates, stats |
| **Shared contracts** | `shared/` | `LINKS_KV` encode/decode, click analytics helpers, reserved slug list |
| **Legacy redirects** | `redirects/` | Only `tix.eypi.cc` / `forms.eypi.cc` → unified `eypi.cc` — **not** general short links |
| **Design system** | `DESIGN_SYSTEM.md` | Visual/UI language (APC colors + Wantap patterns) |
| **Plans / specs** | `docs/superpowers/` | Agent plans and design specs |

### Backend route ownership

| Area | Primary files |
|---|---|
| Auth | `backend/src/routes/auth.ts` |
| Links + link analytics | `backend/src/routes/links.ts` |
| Orgs, members, invites, public catalog | `backend/src/routes/orgs.ts` |
| Org feature gate | `backend/src/middleware/orgGuard.ts` (`isOrgFeature`) |
| Events / Tix | `backend/src/routes/events.ts` |
| Frames / DP | `backend/src/routes/dp.ts` |
| Forms catalog + templates | `backend/src/routes/forms.ts` |
| Platform stats | `backend/src/routes/stats.ts` |
| Wallet passes | `backend/src/lib/passes/` |
| Onboarding (membership attach on verify) | `backend/src/lib/onboarding.ts` |

### Frontend route ownership

| Area | Routes |
|---|---|
| Links | `/links` |
| Forms | `/forms` (org-gated) |
| Frames admin | `/manage/frames` |
| Frames public | `/frames/:slug` |
| Tix admin | `/manage/tix` |
| Tix public ticket | `/tix/:eventId` (param is **event slug**) |
| Orgs | `/orgs`, `/orgs/:slug`, `/orgs/modify` |
| Short-link catch-all | `/:slug` (must stay late in router) |

---

## Tenancy model

| Feature | Scope |
|---|---|
| Links | **User** (`user_id`) |
| Events, DP/Frames, Forms | **Org** (via activated membership + `X-Active-Org-Id`) |
| Public Frames / Tix lookup / org catalog / link redirect | **Unauthenticated** where noted |

Org gate: backend `isOrgFeature` + frontend `requiresOrg` / `useOrgMembership`.

---

## Important seams

| Seam | How it works | Watch out |
|---|---|---|
| SPA ↔ API | `API_BASE_URL` + `Authorization: Bearer` + optional `X-Active-Org-Id` | Default API is `https://api.eypi.cc`; local uses `http://localhost:8787` via `dev:local` |
| Edge redirect ↔ DB | `LINKS_KV` write-through on link CRUD; Turso is source of truth | Stale KV possible on delete; create/update fail if KV sync fails |
| Edge miss ↔ SPA | Reserved slug or KV miss → SPA `/:slug` → `GET /api/links/:slug` | Two analytics paths (worker `Referer` vs SPA `X-Client-Referrer`) |
| Auth | HS256 JWT in `localStorage` (`eypi_token`) | Pass tokens reuse JWT secret with `typ: 'pass'` |
| Forms | Backend serves template bytes; **generation is client-only** | No server-side document storage |
| Frames / DP | Frame PNGs as base64 in Turso; **merge is client canvas** | No server-side image processing |
| Rate limits | `RATE_LIMIT_KV` on auth + public tix/pass endpoints | IP-keyed |

Good deepening targets (seams that already exist): link resolve (KV vs API), org scoping header, org feature gate, pass-token boundary, reserved-slug contract in `shared/`.

---

## Key workflows (short)

1. **Link** — create → Turso + KV → edge 301 (or SPA fallback) → analytics.
2. **Auth** — APC register → Resend verify → login JWT → onboarding maps pre-provisioned memberships (does not auto-activate).
3. **Org** — super admin creates org → owner invites email → user accepts → activated membership → active org context.
4. **Tix** — create event → (optional) CSV selection → finalize → public lookup → QR / wallet pass → check-in.
5. **Frames** — create campaign + frames → public `/frames/:slug` → canvas merge → download count.
6. **Forms** — org-gated catalog → fetch template → client DOCX fill → download.

---

## Deploy & local reality

| Piece | Production | Local |
|---|---|---|
| Frontend | Worker @ `eypi.cc` | Vite `:5173` |
| API | Worker @ `api.eypi.cc` | Wrangler `:8787` |
| DB | Turso (libSQL) | **Same production Turso** (intentional) |
| Combined | — | `npm run dev:local` |

Do **not** insist on a separate dev database unless asked. Never propose destructive DB ops without explicit approval. Never commit or log secrets (`.dev.vars`, `.env.local`, JWT, Turso, Resend, wallet keys).

SQL migrations are applied via `backend/run-migration.mjs`; migration files may not all be versioned in-repo — verify schema from live queries / Turso when unsure.

---

## Constraints & non-goals

- APC-only registration/login; org creation is super-admin-only.
- Self-service password reset is **not** implemented (placeholder UI).
- Suite merge is done: legacy `tix.eypi.cc` / `forms.eypi.cc` are redirect-only.
- Prefer deepening existing modules over rewrites.
- Prefer **Frames** (UI) / **DP** (API) consistency over renaming the whole domain in one pass.
- Stale docs may say `/dp/:slug` — live public route is `/frames/:slug`.
- `backend/src/routes/orgMembers.ts` is not the live membership API (members live under `orgs.ts`).

---

## Related docs

| Doc | Role |
|---|---|
| `DESIGN_SYSTEM.md` | Visual system, UI copy, a11y, z-index |
| `docs/superpowers/specs/` | Feature design specs |
| `docs/superpowers/plans/` | Implementation plans (preferred output for planning skills) |
| `.cursor/rules/local-dev.mdc` | Local prod-DB workflow + safety rules |
