# eypi.cc full audit findings — 2026-10-25

**Status:** Reference. Every finding has a stable ID (`F-<area>-<n>`). The overhaul design (`2026-10-25-eypi-overhaul-design.md`) and plan (`../plans/2026-10-25-eypi-overhaul.md`) cite these IDs.

**Method:** Read-only audit of every module, a production `sqlite_master` dump (`docs/db/schema-baseline.md`), aggregate-only production counts, live HTTP header checks, `npm run build`, `npm test` (71/71 pass), `npm run typecheck` (clean), and `npm audit` in both packages. The audit also compared eypi.cc against the sibling repo wantap.cc. No code was changed.

**Line numbers** are from commit `ffa2e8a` (main, 2026-10-25). They drift as work lands, so search for the quoted symbol if a line no longer matches.

**Severity:** `CRIT` exploitable or core feature broken · `HIGH` real user harm or data risk · `MED` correctness or UX defect with a workaround · `LOW` polish, hygiene, or defense in depth.

---

## 0. Production facts (2026-10-25)

| Fact | Value | Why it matters |
|---|---|---|
| Users | 17 (2 unverified, owning nothing; 0 mixed-case emails) | Hard auth cutover is low risk |
| Links | 79 across 11 users; 0 mixed-case slugs; 4 with logo QR (largest `qr_config` 288 KB) | Links are the main product |
| Clicks | 3,177 total, 477 in the last 30 days; `SUM(links.clicks)` = analytics rows (no drift yet) | Analytics fixes are cheap now |
| Orgs | 2 orgs, 5 memberships, **2 pending invites that can never be accepted** | See F-ORG-1 |
| Tix | 0 events, 0 attendees | Tix is unused in production. Fix its defects before promoting it |
| Frames | 1 campaign, 6 frames (largest 47 KB) | R2 migration is small |
| Org images | 2 stored as `data:` URLs | R2 migration is small |
| FK enforcement | `PRAGMA foreign_keys = 1` | Affects F-DB-3 and F-ORG-13 |
| Live edge | `/robots.txt`, `/sitemap.xml`, unknown paths all return SPA HTML with 200; `/assets/*` sent with `max-age=0` | See the SEO and PERF findings |
| Public templates | `GET https://api.eypi.cc/forms/templates/waiver_form.docx` → 200, no auth | See F-FORM-1 |
| APC Entra tenant | `apc.edu.ph` and `student.apc.edu.ph` share tenant `aeb745e6-8166-4f8f-9233-179e8109c49e` (public OIDC metadata) | Sign-in can be tenant-pinned |

---

## 1. Security and auth (`SEC`, `AUTH`)

| ID | Sev | Location | Finding | Fix |
|---|---|---|---|---|
| F-SEC-1 | CRIT | `backend/src/lib/db.ts:74-86`, `routes/events.ts:965-971`, `middleware/requireAuth.ts:9-14` | **Tix pass tokens are accepted as session tokens.** `getUser` verifies any HS256 JWT signed with `JWT_SECRET` and never checks `typ`. `POST /api/events/:slug/lookup` gives a `typ:'pass'` JWT to anyone who knows an attendee's name and email, and attendees can be non-APC. That token gets through `requireAuth`, so `POST /api/links` creates eypi.cc short links owned by an attendee id. This bypasses the APC-only rule and enables phishing. | Reject tokens with `typ` in session verification, sign pass tokens with a separate `PASS_TOKEN_SECRET`, and add a regression test. |
| F-SEC-2 | HIGH | `routes/auth.ts:84-93` | **Pre-registration account takeover.** Re-registering an unverified email overwrites `password_hash`. An attacker registers a student's email first; the real student clicks the genuine verification email and verifies the attacker's password. Pending org memberships attach on verify (`lib/onboarding.ts:30-37`). | Removed entirely by the Microsoft cutover. Do not ship further password work. |
| F-SEC-3 | MED | `routes/auth.ts:59,96` vs `:197,219` | Register stores email as typed; login lowercases it. Mixed-case registrants can never log in. Production currently has 0 mixed-case rows. | Lowercase every email at the identity boundary (Microsoft sign-in, invites, middleware). |
| F-SEC-4 | MED | `routes/auth.ts:84,222,228` | Email enumeration through 409/403/401 differences and the bcrypt timing skip. | Removed by the cutover. |
| F-SEC-5 | MED | `routes/auth.ts:249`, `components/TheHeader.vue:162-170` | No session revocation: 24-hour JWTs with no `jti`. Password change and logout don't invalidate tokens. | Server-side sessions (design §3). |
| F-SEC-6 | MED | `public/_headers:7`, 8 files read `localStorage.eypi_token` | Token sits in localStorage while CSP allows `script-src 'unsafe-inline'` (not needed; built `index.html` has no inline script). One `v-html` exists (`views/orgs/OrgProfileView.vue:111`, DOMPurify-sanitized). | httpOnly cookie session; drop `'unsafe-inline'` from `script-src`; add `base-uri 'self'; form-action 'self'; object-src 'none'`. |
| F-SEC-7 | MED | `lib/rateLimit.ts:7-23`, `routes/auth.ts:43` | KV rate limiter is a non-atomic read-then-write, keyed by IP only. Campus NAT shares one IP, so 3 registrations/hour can lock out a lab. | Keep KV for coarse limits but key by IP plus subject; consider the Workers Rate Limiting binding for hot paths. |
| F-SEC-8 | LOW | `backend/src/index.ts:17-30` | Production CORS allows `localhost:5173/5174` with credentials (confirmed live). Becomes exploitable once cookies are used. | Allow localhost only when `ENVIRONMENT !== 'production'`. |
| F-SEC-9 | LOW | `routes/auth.ts:278,331` | Invalid JWT on the password route returns 500, not 401. Error JSON shapes vary (`{status,message}`, `{success:false}`, `{error}`). | Global `onError` with one error shape (F-PLAT-1). |
| F-SEC-10 | LOW | `src/router/index.ts:262` | Route guard checks that a token exists, not its expiry. `/login` can redirect an expired user to `/dashboard`. | Guard calls the session store (`GET /api/me`). |
| F-SEC-11 | LOW | `shared/admin.ts:4`, `routes/orgs.ts:32-34`, `router/index.ts:295` | Super admin is a hardcoded email literal on both sides of the API. | `users.role` column (design §3.5). |
| F-SEC-12 | LOW | `routes/auth.ts:19` | `ALLOWED_EMAIL_DOMAINS` includes `@gelolaus.com` and `@alias.gelolaus.com`, but the DB trigger `enforce_apc_email_insert` already rejects them (dead allowance). | Delete with the auth system. |
| F-AUTH-1 | INFO | inventory | Current auth surface to remove: `POST /api/auth/{register,verify,login}`, `PUT /api/auth/password`; `bcryptjs`; Resend verification (`lib/emails/verifyAccountEmail.*`); `VerifyView`, `ResetPasswordView` (placeholder), the password form in `SettingsView`, the login/register form in `LoginView`; KV keys `rl:register`, `rl:verify`, `rl:login`; columns `users.password_hash` (NOT NULL CHECK ≥ 60), `verification_token`, `is_verified`; env `FRONTEND_URL` (verification only). **Keep:** `users.id` (FK target), `org_members.email` matching, `handleUserOnboarding`. | Design §3. |

## 2. Organizations and membership (`ORG`)

| ID | Sev | Location | Finding | Fix |
|---|---|---|---|---|
| F-ORG-1 | CRIT | `routes/orgs.ts:402-474` (no caller in `src/`) | **Invitees can never join an org.** `GET /api/orgs/invites`, `POST …/accept` and `POST …/decline` exist, but their UI was dropped in commit `8bd177d` (2026-06-27 dashboard refresh). Production has 2 stranded invites. | Invite inbox (design §5). |
| F-ORG-2 | HIGH | `components/OrgLockout.vue:22-23`, `views/orgs/OrgModifyView.vue:14-16,331` | Lockout screen says "accept it in the Orgs module" and links to `/orgs/modify`, which shows the same lockout. Dead-end loop. | Lockout shows pending invites inline with Accept/Decline. |
| F-ORG-3 | HIGH | `views/settings/OrgManagementEditView.vue:302` → `routes/orgs.ts:1066-1078` | Super admin "Transfer ownership" calls an owner-only endpoint and always gets 403. | Remove the form; the admin owner change already exists via `PATCH` (`orgs.ts:580-597`). |
| F-ORG-4 | MED | `lib/db.ts:10-35` | Invalid or stale `X-Active-Org-Id` silently falls back to the first org with no `ORDER BY`. A user removed from org A but with A still in localStorage creates events in org B. | Return 403 `org_not_accessible` when the header is invalid; `ORDER BY` everywhere orgs are listed (`orgs.ts:295-309`). |
| F-ORG-5 | MED | `OrgModifyView.vue:565-592`, `composables/useActiveOrg.ts:9` | After leaving, `active_org_id` isn't cleared and the org list isn't refetched; the view may not reload. | Clear active org, `fetchOrgs()`, then navigate. |
| F-ORG-6 | MED | `composables/useOrgMembership.ts:53` | `clearOrgMembershipCache` has no callers; the 60s cache survives logout, accept and leave. | Clear on logout, accept, leave and org switch. |
| F-ORG-7 | MED | `routes/orgs.ts:961-974`, `OrgModifyView.vue:500-502` | API says "Invitation sent", but no email exists and duplicate invites (`changes=0`) report success. | Return 409 for duplicates; send the invite email (design §5). |
| F-ORG-8 | LOW | `orgs.ts:414,437,462` vs `:867` | Invite, accept and decline use the raw token email; leave lowercases it. | Lowercased email from the session (F-SEC-3). |
| F-ORG-9 | LOW | `orgs.ts:358-389`, `1080-1121` | Check-then-write races on org create and transfer. | Partial unique index on `organizations(owner_id)` plus batched writes. |
| F-ORG-10 | LOW | `orgs.ts:458-461` | Decline deletes the row, so an owner can re-invite without limit. | Keep `declined_at`; block re-invite for 7 days unless the owner cancels. |
| F-ORG-11 | LOW | `backend/src/routes/orgMembers.ts` | Dead file, never mounted; duplicates `orgs.ts:923-979`. | Delete. |
| F-ORG-12 | LOW | `middleware/orgGuard.ts:33` | 403 body contains placeholder `forms.office.com/r/placeholder-registration-url`. | Replace with `/orgs` and pending-invite guidance. |
| F-ORG-13 | HIGH | `routes/orgs.ts:611-645` | **Org slug rename likely fails in production.** With FKs on, the batch updates `org_members.org_id` (and events, dp_campaigns) to the new id **before** `organizations.id` changes. `org_members` always holds the owner, so the FK fails. | Insert the new org row, repoint children, then delete the old row in one batch, or forbid slug rename. Verify on a Turso branch first. |
| F-ORG-14 | LOW | `OrgModifyView.vue:209-240,391` | Transfer takes free-typed email instead of a member pick-list; members table shows no names or empty state; list fetch fails silently. | UI polish in WS3. |
| F-ORG-15 | INFO | `orgs.ts:146-173`, `events.ts:19-28`, `dp.ts:84-92` | Every activated member has coordinator powers. **Owner decision (2026-10-25): keep the flat model.** eypi orgs contain officers only. | Document in `CONTEXT.md`; no role column for orgs. |

## 3. Links, redirects, analytics (`LINK`)

| ID | Sev | Location | Finding | Fix |
|---|---|---|---|---|
| F-LINK-1 | HIGH | `routes/links.ts:34,50`, `shared/linkQrConfig.ts:1` | `GET /api/links` returns every link's full `qr_config`, including logo data URLs (up to 2.8 MB allowed; 288 KB in production), with no pagination. | List returns `hasLogo`; logo moves to R2 (WS6) and is fetched per link; cursor pagination plus server search. |
| F-LINK-2 | HIGH | `links.ts:54-56,117-118,298-299`, `views/links/LinksView.vue:574-577,678` | Every DB error returns 401 "Invalid session"; the client logs the user out. A Turso blip logs everyone out; a slug conflict shows "Session expired". | 401 only from auth middleware; 409 for conflicts; 500 via `onError`. |
| F-LINK-3 | HIGH | `worker/index.ts:58` | Redirect is 301. Browsers cache it indefinitely, so edits and deletes don't reach returning visitors and their repeat clicks are never counted. | 302 with `Cache-Control: private, max-age=0`. |
| F-LINK-4 | HIGH | `links.ts:166-176,193-210` | Edit checks only "non-empty and not reserved". The `^[a-zA-Z0-9]` rule is client-only. `a/b`, `x.png` or 800-character slugs pass; an oversized slug exceeds KV's 512-byte key limit after the DB update, so DB and KV diverge. | Shared server rule `^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$`; write KV before the DB commit or compensate. |
| F-LINK-5 | MED | `links.ts:184-207,277-285` | Slug conflicts surface as a vague "Update failed"; create uses check-then-insert, and after 10 retries the last slug is used unchecked. (`links.slug` is UNIQUE in production, so no cross-user hijack.) | Catch `SQLITE_CONSTRAINT_UNIQUE` → 409 `slug_taken`. |
| F-LINK-6 | MED | `links.ts:76-84`, `components/AnalyticsPanel.vue:411-430` | "Top 5" OS/country/referrer queries have no `ORDER BY count DESC`. | Order and limit in SQL. |
| F-LINK-7 | MED | `shared/linkAnalytics.ts:117-128`, `worker/index.ts:29,50` | Counter increments `WHERE slug = ?` in a separate statement from the analytics insert. A stale KV entry after a rename counts rows without incrementing. | Increment `WHERE id = ?` in the same batch. |
| F-LINK-8 | MED | `worker/index.ts:16,45`, `links.ts:123-141` | HEAD requests and link-preview bots (facebookexternalhit, Discordbot, WhatsApp, Slackbot, Twitterbot, TelegramBot…) count as clicks. The public `GET /api/links/:slug` counts every call, isn't rate-limited, and trusts `X-Client-Referrer`. | Skip HEAD and a bot user-agent list; rate-limit the SPA lookup. |
| F-LINK-9 | MED | `links.ts:260`, `lib/validateDestinationUrl.ts:1-2,102-119` | No per-user quota or create rate limit; no malware/phishing check; eypi.cc self-links and other shorteners allowed (redirect chains); `https://apc.edu.ph@evil.tld` userinfo passes; the protocol blocklist is unreachable because `normalizeUrl` prepends `https://` first. | Quota, rate limit, reject userinfo and self-domain, shortener denylist, optional Google Safe Browsing lookup, report and takedown (design §6). |
| F-LINK-10 | MED | `links.ts:18,123` | 6-character lowercase base36 slugs plus an unthrottled lookup make unlisted destinations enumerable. | Rate-limit lookup; generated slugs become 7 characters. |
| F-LINK-11 | MED | `links.ts:240-252`, `backend/scripts/backfill-links-kv.mjs:87-101` | KV delete failures are swallowed; the backfill only adds keys and never removes stale ones. (Analytics cascade on delete, verified in schema.) | Retry the delete; add a reconcile mode to the backfill. |
| F-LINK-12 | LOW | `LinksView.vue:387,390,589,615,709-711` | Client URL regex rejects ports, IPs, IDNs and `example.com?q=1`; the client allows uppercase that the server lowercases silently; clearing the slug falls back to a destination hash that collides across users. | Use the shared validator; generate random slugs only. |
| F-LINK-13 | LOW | `LinksView.vue:826-836` | `/links?url=…` auto-creates a link for a logged-in user (drive-by creation). | Prefill the form; require a click. |
| F-LINK-14 | LOW | `links.ts:88` vs `:92` | Timeline groups by UTC day while peak hour uses UTC+8. | One Manila-time helper. |
| F-LINK-15 | LOW | `redirects/src/index.ts:15-22` | Legacy redirects worker drops query strings and deep paths. | Preserve path and query. |
| F-LINK-16 | LOW | `shared/reservedSlugs.ts` | Covers all current routes, but no test enforces route ⇄ reserved parity. Missing defensive entries: `admin`, `account`, `api`, `assets`, `auth`, `logout`, `signup`, `help`, `about`, `qr`, `static`, `invites`, `report`, `p`. | Parity test that parses `src/router/index.ts`; add entries (check production slugs first). |
| F-LINK-17 | LOW | `LinksView.vue:476,639-644,692,705-708`, `components/LinkVisualization.vue`, `AnalyticsPanel.vue:253-334` | Dead code: unreachable new-link sidebar branches, unused `LinkVisualization.vue`, duplicate `readFileAsDataUrl` and `REFERRER_LABELS`; after create the new link is found by URL because the API doesn't return its id. | Return the created link; delete the dead code. |
| F-LINK-18 | MED | `LinksView.vue` (862 lines), `AnalyticsPanel.vue` (489) | God component; chart.js is bundled into `LinksView` because `AnalyticsPanel` is imported statically (`LinksView.vue:359`). | Split it (design §6.4); lazy-load the analytics panel. |
| F-LINK-19 | INFO | — | Not verified: whether browsers hit the edge worker redirect or get `index.html` first under SPA asset handling (`wrangler.jsonc` `not_found_handling`). If assets win, every click takes the slower `RedirectView` path. | WS4 task 1: `curl -I https://eypi.cc/<real-slug>` must return 302 from the worker. |

## 4. Tix (`TIX`). Unused in production (0 events)

| ID | Sev | Location | Finding | Fix |
|---|---|---|---|---|
| F-TIX-1 | HIGH | `views/tix/AttendeeSelectionView.vue:280,696-757,1055-1057` | Cluster criteria are never saved (only saved at the clusters step), and they aren't rebuilt on resume. Re-raffle and post-reload finalize ignore criteria. | Save on leaving the criteria step; hydrate on mount. |
| F-TIX-2 | HIGH | `routes/events.ts:494-606` | Finalize isn't atomic; a double submit or retry creates duplicate attendees with different QR tokens. | Lock-first guarded `UPDATE … WHERE selection_locked=0`, then a single write batch; unique `(event_id, lower(email))`. |
| F-TIX-3 | HIGH | `events.ts:16-18,929-934,992,1039` | One per-IP bucket (10/15 min) shared by lookup and both pass endpoints. Campus Wi-Fi NAT locks out the door queue, and the 429 says "No ticket found". | Key by IP + event + email hash; separate pass bucket; distinct 429 copy. |
| F-TIX-4 | HIGH | `AttendeeSelectionView.vue:977-1001`, `NewEventView.vue` | Tickets exist only in the finalize ZIP; there's no per-attendee re-download, and ZIP names `First_Last.png` collide and overwrite. | Per-attendee QR download; regenerate ZIP; name by attendee id. |
| F-TIX-5 | MED | `events.ts:1097-1155` | Check-in reads then inserts (two scanners both succeed); `actioned_at` ties at 1-second resolution. | Guarded insert; `ORDER BY actioned_at DESC, rowid DESC`. |
| F-TIX-6 | MED | `events.ts:1180`, `EventDetailView.vue:347-364,1316` | Checkout doesn't check state, so a removed attendee can be revived; Remove has no confirm and no restore. | State machine checks; confirm dialog; restore action. |
| F-TIX-7 | MED | `events.ts:636-695,439-449` | Re-raffle counts removed attendees while GET clusters doesn't; dedup after slicing under-fills; ignores `max_attendees`. | One shared count query; dedup before slicing. |
| F-TIX-8 | MED | `AttendeeSelectionView.vue:872-876` | Duplicate-email rows give applicants better raffle odds. | Dedupe the pool by lowercased email. |
| F-TIX-9 | MED | `events.ts:832` | Add-guest checks `lead_user_id` instead of org membership. | Use `requireEventLead`. |
| F-TIX-10 | MED | `lib/passes/context.ts:97-121`, `applePass.ts:33`, `googleWallet.ts:53` | Wallet passes include every non-empty CSV column (phone, student number, payment reference), and that data is stored on Google's servers. Each pass request also parses every CSV row. | Opt-in column allowlist stored on the event; store `csv_row_id` on attendees. |
| F-TIX-11 | MED | `AttendeeSelectionView.vue:566-600` | `xlsx@0.18.5` (unfixed CVE-2023-30533 and CVE-2024-22363) parses user uploads; `filter(Boolean)` on headers shifts columns; duplicate headers collapse; `.xlsx` check is case-sensitive. | Replace with `exceljs` or the SheetJS CDN build 0.20.3; keep header indices. |
| F-TIX-12 | MED | `NewEventView.vue:248-266`, `events.ts:104` | Legacy CSV parser: BOM, quotes, escaped quotes and newlines unsupported; missing `firstName` returns 500. | `papaparse`; validate per row. |
| F-TIX-13 | MED | `events.ts:257-294` | Upload deletes, then inserts 100-row batches sequentially with no row cap; partial data on failure. | Single transactional batch; 5,000-row cap. |
| F-TIX-14 | MED | `lib/passes/googleWallet.ts:20-46,93-98` | Google Wallet class is created once (`UNDER_REVIEW`) and never updated; `validTimeInterval` has no offset or end. | Upsert class; Manila offset; end time. |
| F-TIX-15 | MED | `events.ts:453-487` | N+1: one COUNT per cluster. | Single `GROUP BY` over a latest-action CTE. |
| F-TIX-16 | LOW | `EventDetailView.vue:1171-1174` | `new Date("YYYY-MM-DD HH:MM:SS")` parses UTC as local, so times show 8 hours off. | Parse as UTC (`Z`). |
| F-TIX-17 | LOW | `events.ts:954,164-194,803-804,75,771-779` | Lookup issues passes to removed attendees; any logged-in user reads any event's details; LIKE doesn't escape `%`/`_`; no validation on `maxAttendees`, date, time. | Tighten each. |
| F-TIX-18 | LOW | `events.ts:56-62,228-229`, Apple pass endpoint, `EventDetailView.vue:1335-1338` | Dead code: post-finalize CSV append; Apple pass endpoint with no UI caller and no certificates configured; hardcoded "asia pacific college"/"jpcs" in `isApcAttendee`. | Delete; remove Apple Wallet entirely (owner decision). |
| F-TIX-19 | LOW | `utils/tix-scanner.ts:19,103-122`, `EventDetailView.vue:902-940` | The same QR still in frame after cooldown shows red "already checked in"; vibrates before the result; no offline queue; status column hidden on mobile. | Remember the last token for 5s; result-specific feedback; queue in IndexedDB. |
| F-TIX-20 | MED | `EventDetailView.vue` (1409 lines), `AttendeeSelectionView.vue` (1066) | God components; raffle logic is untestable inside the view. | Split (design §7). |

## 5. Frames and Forms (`FRAME`, `FORM`)

| ID | Sev | Location | Finding | Fix |
|---|---|---|---|---|
| F-FORM-1 | HIGH | `backend/wrangler.jsonc:16-19`, `routes/forms.ts:42-60` | **Templates are public.** Workers Static Assets serve before the Worker, so `api.eypi.cc/forms/templates/*.docx` skips `isOrgFeature` (confirmed 200 live). | Hotfix: `assets.run_worker_first: true` (or remove the `assets` block and serve from R2). |
| F-FORM-2 | HIGH | `.gitignore:41`, `backend/assets/forms/templates/.gitkeep` | Templates aren't in git (commit `55a1c78`); a deploy from a clean checkout ships none. | Move templates to R2 (private); keep a copy in a private backup location recorded in `docs/operations.md`. |
| F-FORM-3 | MED | `views/forms/generators/LetterOfIntentView.vue:175-178`, `VisitorsPassView.vue:228-231` | CSV split on `;` only; header becomes a name; BOM and quotes unhandled. | `papaparse` with preview. |
| F-FORM-4 | MED | `LetterOfIntentView.vue:183-184,217` | ZIP filenames unsanitized (`/` makes folders) and same-name students overwrite each other. | Reuse `ConcessionaireView.vue:242-248` sanitizer; suffix duplicates. |
| F-FORM-5 | LOW | all generators | No `required` validation; unbounded `walkInCount` (`VisitorsPassView.vue:269-272`); inconsistent reset; one generic error toast; hardcoded `i < 4` (`ConcessionaireView.vue:267`). | Shared `useDocxGenerator` composable (design §8). |
| F-FORM-6 | LOW | `views/forms/FormsHomeView.vue:59-78` vs `routes/forms.ts:7-26` | Duplicate form catalog has already drifted. | Single source in `shared/formsCatalog.ts`. |
| F-FRAME-1 | HIGH | `routes/dp.ts:16-24,392-418` | Frames stored as base64 in Turso; each public visit returns every frame inline (up to ~28 MB) with no caching. | R2 plus a cached same-origin image route (design §8). |
| F-FRAME-2 | MED | `dp.ts:378-386`, `views/dp/DpPublicView.vue:275` | Download counter is unauthenticated, unthrottled and fires even when the save failed. | Rate limit per IP + campaign per day. |
| F-FRAME-3 | MED | `dp.ts:137-146` | Campaign and frames inserted in separate calls; a failure leaves an empty campaign holding the slug. | One batch. |
| F-FRAME-4 | MED | `components/dp/DpFrameUploader.vue:126`, `DpEditCampaignView.vue:60-70`, `dp.ts:227-236` | Concurrent adds break the 10-frame cap and positions. | Serial client adds; conditional insert on the server. |
| F-FRAME-5 | MED | `DpPublicView.vue:250-261` | Visitor photo: no size cap or downscale (iOS tab crash on 48 MP), no `onerror` (HEIC silently fails), input not cleared. | `createImageBitmap` downscale to ≤ 2160 px; error toast; reset input. |
| F-FRAME-6 | MED | `DpPublicView.vue:244,319-321` | Non-square frames are stretched to 1080×1080; the spec says native resolution. | Validate aspect and minimum size at upload; size the canvas from the frame. |
| F-FRAME-7 | MED | `dp.ts:338-345`, `DpEditCampaignView.vue:51` | Slug change breaks the editor URL and every shared link. | `router.replace`; slug history redirect. |
| F-FRAME-8 | MED | `index.html`, `worker/index.ts` | No OG/Twitter tags for `/frames/:slug`, a feature built for sharing. | `HTMLRewriter` meta injection (F-SEO-1). |
| F-FRAME-9 | LOW | `dp.ts:31-34,132-139`, `DpPublicView.vue:201-202,273`, `DpFrameUploader.vue:14-19` | Prefix-only PNG validation; vestigial `frame_image_url NOT NULL`; duplicated scale constants; iOS saves to Files instead of Photos; drag reorder doesn't work on touch. | Magic-byte check; `navigator.share({files})`; up/down buttons. |
| F-FRAME-10 | LOW | DP views (`res.json()` unguarded) | A 413 or HTML error page shows "Unexpected token <". | Shared API client (F-PLAT-2). |

## 6. Data layer (`DB`)

| ID | Sev | Location | Finding | Fix |
|---|---|---|---|---|
| F-DB-1 | HIGH | repo-wide, `.gitignore` (`*.sql`), `backend/run-migration.mjs` | Schema wasn't versioned (baseline now in `docs/db/schema-baseline.md`); the migration runner has no ledger, no transaction, no confirmation; referenced files `0002`/`0003`/`0005` are missing. | Versioned migrations (design §4). |
| F-DB-2 | HIGH | `events.ts:77/113,257-294,406-416,581-606,713-725`, `dp.ts:137-146` | Multi-step writes aren't atomic. | `client.batch([...], 'write')` per operation. |
| F-DB-3 | MED | schema | No cascades from `users` to `org_members`, `organizations`, `events`, `dp_campaigns`; from `events` to `attendees`/`check_ins`/`event_*`; from `dp_campaigns` to `dp_frames`. Account deletion and event deletion must delete children explicitly in order. | Explicit ordered batches (account deletion, design §9). |
| F-DB-4 | MED | `context.ts:72-77` | Wallet pass reads every CSV row of the event per request (public endpoint). | F-TIX-10. |
| F-DB-5 | MED | `orgs.ts:186-192,245-253`, `events.ts:209-222,355,653`, `links.ts:34` | Unbounded SELECTs, some returning data-URL images. | Pagination plus R2. |
| F-DB-6 | MED | `events.ts:539-541` | Unbounded `IN (…)` can exceed SQLite's variable limit. | Chunk. |
| F-DB-7 | LOW | `auth.ts:70,157,211,300`, `links.ts:29-273` | Inline `createClient` instead of `db()`. | One `db(c)` helper per request. |
| F-DB-8 | LOW | mixed | Timestamps: `CURRENT_TIMESTAMP` UTC text, client strings for `event_date`/`event_time`, UTC vs +8 in analytics. | Store UTC; one `manilaTime` helper. |
| F-DB-9 | LOW | schema | Unused `board_*` tables (9 tables, 0 rows, no code). Missing indexes: `links(user_id, created_at)`, `analytics(link_id, created_at)`, `org_members(user_id)`, `org_members(email)`, `events(org_id)`, `dp_campaigns(org_id)`, `dp_frames(campaign_id, position)`, `check_ins(attendee_id, actioned_at)`, unique `attendees(event_id, lower(email))`. | Migration 0002 drops `board_*` (owner approved removing dead things) and adds indexes. |
| F-DB-10 | MED | `backend/wrangler.jsonc:48-51` | Workers `observability` is commented out; 32 `console.*` calls are only visible live through `wrangler tail`. | Enable observability; structured `reportError`. |
| F-DB-11 | MED | `.dev.vars.example:11`, `run-migration.mjs` | Local dev uses a full-write production token; the runner applies SQL without confirmation. | Read-only token by default; runner prints target and needs `--yes`; destructive-statement guard. |
| F-DB-12 | MED | `events.ts:257,290`, `onboarding.ts:39,43` | Uploaded CSV rows (arbitrary personal data) kept forever; emails written to logs. | Purge `event_csv_rows` 30 days after event date (cron); no PII in logs. |

## 7. Frontend platform, UX, accessibility, performance, SEO (`PLAT`, `UX`, `A11Y`, `PERF`, `SEO`)

Build (`vite build`): main `index` 163 kB raw / 59 kB gzip; CSS 75 kB / 13 kB; lazy chunks: xlsx 430 kB, docxtemplater 276 kB, LinksView (+chart.js) 203 kB, jszip 98 kB, OrgProfileView (+marked, DOMPurify) 76 kB, qr-code-styling 49 kB, qr-scanner worker emitted twice (44 kB ×2). Route-level splitting is otherwise good.

| ID | Sev | Location | Finding | Fix |
|---|---|---|---|---|
| F-PLAT-1 | HIGH | `backend/src/index.ts` | No `app.onError` or `notFound`; inconsistent error shapes; health check doesn't touch the DB. | Global handler, `{ error: { code, message } }`, `/api/health` with a DB ping. |
| F-PLAT-2 | HIGH | 75 raw `fetch` calls, 3 handle 401 | No shared API client. | `src/lib/api.ts` (`credentials: 'include'`, active-org header, 401 → session reset, typed errors). |
| F-PLAT-3 | HIGH | `src/main.ts:12`, router | No `app.config.errorHandler` or `router.onError`; after each deploy, open tabs fail to load lazy chunks silently. | Reload once into the target route on chunk-load errors. |
| F-PERF-1 | HIGH | `public/_headers` | `/assets/*` sent with `max-age=0, must-revalidate` (confirmed live). | `/assets/*` → `public, max-age=31536000, immutable`. |
| F-PERF-2 | HIGH | `components/AppLoader.vue:14-17`, `HeroSection.vue:7`, `composables/useReveal.ts` | Forced 1.4s splash on every full load (including shared public pages); hero heading hidden until an observer fires. | Delete the splash; render the hero visible. |
| F-PERF-3 | MED | `index.html:10-13` | Render-blocking Google Fonts, 9 font files; sends visitor IPs to Google. | Self-host Geist and Geist Mono (woff2 subset). |
| F-PERF-4 | MED | `components/AppCursor.vue:27-36,99`, `styles/main.css:49-52` | Custom cursor runs an endless rAF loop and hides the system cursor everywhere. | Delete the custom cursor (owner approved removals). |
| F-PERF-5 | LOW | `EventDetailView.vue:1029` | qr-scanner worker emitted twice by an extra `?url` import. | Drop the duplicate import. |
| F-PERF-6 | LOW | `views/RedirectView.vue:31` | Custom `X-Client-Referrer` header forces a CORS preflight on the fallback redirect. | Send the referrer as a query param or in a POST body. |
| F-A11Y-1 | HIGH | `composables/useKeyboardNav.ts:9-24`, `App.vue:72`, `TheFooter.vue:28` | Global Space handler hijacks scrolling and jumps to the footer on every page. | Delete. |
| F-A11Y-2 | HIGH | ~31 sites (e.g. `HeroSection.vue:21`, `DialogHost.vue:50`, `NotFoundView.vue:42`) | White on APC Gold is 2.08:1 (needs 4.5:1). | Dark text (`#1a1a2e`-class navy) on gold; update `DESIGN_SYSTEM.md`. |
| F-A11Y-3 | HIGH | `styles/main.css:54-58` | Gold focus ring on light grey is 1.91:1 (needs 3:1). | Navy focus ring in light mode, gold in dark. |
| F-A11Y-4 | MED | `NotFoundView.vue:16` and others | APC blue text in dark mode is 2.30:1. | Dark-mode token. |
| F-A11Y-5 | MED | `NavSidebar.vue:14-21`, `TheHeader.vue:203-211`, `DialogHost.vue:137-149`, `ToastContainer.vue:86-90` | Sidebar isn't a modal dialog (no role, no trap); dialogs don't restore focus; Esc closes a dialog and a toast together. | Shared focus-trap utility; scoped Esc. |
| F-A11Y-6 | MED | `App.vue:34-36` | No `document.title` per route; route changes not announced. | Router `afterEach` title plus live region. |
| F-A11Y-7 | LOW | `FeaturesCarousel.vue:69,94-102`, `TheFooter.vue:12-20`, `TheHeader.vue:36-41`, `ContactView.vue:13-26`, `router/index.ts:13-15`, `ScrollTop.vue:25` | Focusable links inside `aria-hidden` slides; autoplay has no pause; "↗" glyphs read aloud; no `aria-pressed` on the theme toggle; heading skip; JS smooth scroll ignores reduced motion. | Fix each. |
| F-UX-1 | MED | `TheHeader.vue:126`, `useAuth.ts:19` | `atob` + `JSON.parse` garbles non-ASCII names ("Peña" → "PeÃ±a"). | Removed with JWT-in-localStorage; `/api/me` returns JSON. |
| F-UX-2 | MED | `router/index.ts:13-15` | Back button doesn't restore scroll position. | Return `savedPosition`. |
| F-UX-3 | MED | `composables/useDarkMode.ts:10,24`, `main.ts:6-10` | Ignores the system setting; per-call state (chart colors don't update); flash of light theme. | Singleton store; `prefers-color-scheme` default; inline pre-paint class via a hashed script or `<meta name="color-scheme">`. |
| F-UX-4 | LOW | `ToastContainer.vue:3`, `ScrollTop.vue:34-36` | Toast and back-to-top button overlap. | Offset. |
| F-SEO-1 | HIGH | `index.html:7`, `worker/index.ts` | One static, stale title; no description or OG tags; public org, frame and ticket pages show no previews. | Worker `HTMLRewriter` injects per-route meta for `/`, `/orgs/:slug`, `/frames/:slug`; router sets titles. |
| F-SEO-2 | MED | live | `/robots.txt`, `/sitemap.xml` and unknown paths return SPA HTML with 200 (soft 404s). | Static `robots.txt`; worker-generated `sitemap.xml` (public orgs and frames); worker returns 404 status for unknown non-slug paths. |
| F-SEO-3 | LOW | `index.html:5` | No manifest, apple-touch-icon or theme-color. | Add. |

## 8. Tooling, dependencies, CI, hygiene, legal (`OPS`, `DEP`, `HYG`, `LEGAL`)

| ID | Sev | Location | Finding | Fix |
|---|---|---|---|---|
| F-DEP-1 | HIGH | root `npm audit --omit=dev` | 1 critical (dompurify 3.4.11) and 8 high, fixable with `npm audit fix`; `xlsx` has no fix. | `npm audit fix`; replace `xlsx` (F-TIX-11). |
| F-DEP-2 | HIGH | backend `npm audit` | hono 4.12.8 (multiple advisories → 4.13.14+), zod (high), uuid via resend/svix (moderate), node-forge (no fix; only used by Apple passes). | Upgrade; removing Apple Wallet removes node-forge. |
| F-DEP-3 | LOW | `npm outdated` | wrangler 4.74 → 4.152, @cloudflare/vite-plugin 1.29 → 1.65, vue 3.5.29 → 3.5.44, marked 15 → 18, vite 6 → 8; stale Browserslist; unused `@tursodatabase/database` in backend. | Upgrade in WS1 (vite 8 only if the build stays green). |
| F-OPS-1 | MED | `.github/workflows/test.yml:15` | CI runs on Node 20 (EOL April 2026); no build, lint, audit or e2e step. | Node 22; build both workers; ESLint (`eslint-plugin-vue`, `eslint-plugin-vuejs-accessibility`, typescript-eslint); `npm audit --audit-level=high`; Playwright smoke. |
| F-OPS-2 | LOW | `backend/package.json:6`, `package.json:14`, `tsconfig.node.json` | Backend deploy has no predeploy gate; `vite.config.ts` is never typechecked. | Gate and reference. |
| F-OPS-3 | MED | — | No operations runbook (Turso PITR restore, KV re-sync, R2, Entra secret rotation). | `docs/operations.md`. |
| F-HYG-1 | LOW | repo | Remove: `vercel.json` (Cloudflare deploys), `.cursor/plans/` (18 stale plans), `components/LinkVisualization.vue`, `src/assets/icons/*.svg` (unused) plus `vite-svg-loader` and its `vite-env.d.ts` declaration, `apc-bg` Tailwind color, `routes/orgMembers.ts`, `AppCursor.vue`, `AppLoader.vue`, `useKeyboardNav.ts`, the Apple Wallet code and assets, the `VerifyView`/`ResetPasswordView` routes. Keep `.cursor/rules/` (referenced by `CONTEXT.md`) but update `local-dev.mdc`. | WS7 and WS2. |
| F-HYG-2 | LOW | 6 files | Duplicated "corner screws" markup; Contact/Privacy/Terms share one layout. | `<PageShell>` and `<LegalLayout>`. |
| F-HYG-3 | LOW | — | No `AGENTS.md`; `CONTEXT.md` says the schema isn't in the repo and that coordinators manage members (both now wrong). | WS9. |
| F-LEGAL-1 | HIGH | `views/PrivacyView.vue` | Privacy policy falls short of RA 10173 (Data Privacy Act). It leaves out analytics fields, IPs in rate-limit keys, attendee CSV data, frames, logos, wallet passes, processors (Cloudflare, Turso, Resend, Microsoft, Google Wallet), cross-border transfer, retention, legal basis, DPO contact and the NPC complaint right. It claims "bcrypt/Argon2", and its effective date predates Tix. | Versioned legal documents plus consent records (design §9). |
| F-LEGAL-2 | MED | — | No data export or account deletion. | `/account` (design §9). |

## 9. wantap.cc comparison (what to port, adapted to Vue/Hono/Workers)

| Area | wantap.cc | eypi.cc today | Port? |
|---|---|---|---|
| Sign-in | Auth.js Entra (`common`), env-gated buttons, signed pre-auth consent cookie | Email/password plus Resend | **Port the pattern, not the code.** Do **not** port `common` + `allowDangerousEmailAccountLinking`: trusting the `email` claim across tenants is the "nOAuth" takeover class. eypi pins `tid`. |
| Session gate | `evaluateSessionGate` (disabled / revoked / issued-at), fail-closed user load | None | Port as Hono middleware over a `sessions` table. |
| Account | `/account`: identity, connected accounts, export JSON, delete with blob cleanup | Password change only | Port (export JSON plus links CSV, delete, sign out everywhere). |
| Legal | Typed legal catalog, version constants, `legal_consent` with hashed IP and user agent, cookie notice | Hardcoded Privacy/Terms | Port. |
| Security | Tested `securityHeaders()`, SSRF guard, HMAC IP hashing, staff capabilities plus audit log | Inline headers, SSRF validator (good), no audit | Port headers test, IP hashing for unique visitors, audit log. |
| Observability | `reportError()` JSON lines; `docs/operations.md` with PITR | `console.*`, observability off | Port. |
| Tests/CI | 150 test files, Testing Library, Playwright, ESLint, build in CI | 16 test files, no lint, no build, no e2e | Port incrementally. |
| SEO | robots, sitemap, llms.txt, JSON-LD, Markdown negotiation | None | Port robots, sitemap, OG, JSON-LD for org pages; skip llms.txt and Markdown negotiation (YAGNI). |
| Admin | Users list, disable, force-logout, audit | Org management only | Port users, abuse queue, audit. |
| Docs | `AGENTS.md` → `CLAUDE.md`; spec + plan pairs with locked decisions | `CONTEXT.md`, no `AGENTS.md` | Port. |

**Note for wantap.cc (out of scope here):** its Microsoft provider combines the `common` issuer with `allowDangerousEmailAccountLinking: true` (`src/lib/auth/config.ts`). Review it separately.
