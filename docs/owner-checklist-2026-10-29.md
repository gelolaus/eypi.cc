# Owner checklist — 2026-10-29

Still-open owner steps, in the order to do them. Tick a box here when it is done, and send back only the line that step names.

Full commands stay in the source guides. Those guides keep their own boxes.

**Apply the avatar migration before any backend deploy.** `GET /api/me`, the member list, and Admin → Users select `avatar_icon` and `avatar_color`. If that code ships first, those queries fail and the member list, the admin users list, and sign-in break. If the migration ships first, the previous code ignores the two new columns.

Run commands in **Git Bash** from `C:\Users\gelo\Documents\GitHub\eypi.cc` unless a step says otherwise. If a check fails, stop and paste the output. Do not send a database URL, a token, a secret, an email address, or an IP address.

Accepted risks stay in `docs/operations.md`.

---

## 1. Avatar picker

Source: `docs/owner-guide-avatar-picker.md`. Part 1, then part 2, then part 3.

### Part 1 — Migration (do this first)

- [x] **1.1 Apply `backend/migrations/0013_user_avatar.sql` on the production Turso database.**
  The file only adds `avatar_icon` and `avatar_color` on `users`. Nothing is dropped, rebuilt, or rewritten. Existing users keep their initials until they pick an avatar. Run it once. A second run fails because the columns already exist. Rehearse on a copy first if you want to; the runbook is in `docs/RELEASE.md`.

  ```bash
  git checkout main
  git pull
  npm run migrate --prefix backend -- --status
  npm run migrate --prefix backend -- --dry-run
  npm run migrate --prefix backend -- --yes
  ```

  Check: `--status` shows `0013_user_avatar` pending before and applied after. The printed host is the production database before `--yes`.

  Send back: "0013 applied".

### Part 2 — Deploy (only after part 1)

- [x] **2.1 Deploy the backend, then the frontend,** the way `docs/RELEASE.md` describes.

  Send back: "backend and frontend deployed".

### Part 3 — Live check (about 5 minutes)

Sign in at <https://eypi.cc>.

- [x] **3.1 Pick an avatar.** Account menu → **Change avatar**. Choose an icon and a colour, then **Save**.
  Check: the dialog closes, focus is back on the account menu button, and the avatar shows in the account menu without a reload.
- [x] **3.2 Light, Dark, and True black.** Look at the avatar in each.
  Check: the icon and its soft background are clearly visible in every theme.
- [x] **3.3 Lists.** Your org's member list, and Admin → Users.
  Check: your avatar is next to your name in both. Other people still show their initials.
- [x] **3.4 Reset.** **Change avatar** → **Reset**.
  Check: your initials come back everywhere.

Send back: "avatar picker checked", or what looked wrong, with the theme and screen size.

---

## 2. Speed, Tix, and analytics

Source: `docs/owner-guide-speed-tix-analytics.md`. Every box in that guide is still open. Skip 2B and 2C only when that phase has no migration.

### Part 0 — One-time setup

- [ ] **0.1 Update your copy.** `git checkout main`, `git pull`, `npm run setup`. The commands finish without errors.

  Send back: "setup finished", or the output if a command fails.

- [ ] **0.2 Sign in to Cloudflare.** `npx wrangler login`, then `npx wrangler whoami`. `whoami` prints the account that owns `eypi.cc`.

  Send back: "whoami shows the eypi.cc account".

- [ ] **0.3 Sign in to Turso.** `turso auth login`, then `turso db list`. The list shows the production database. Write its name down. Later steps call it `<production-db-name>`.

  Send back: "production database is listed".

### Part 1 — Before Phase 1

- [ ] **1.1 Turn off Cloudflare Web Analytics automatic injection** for `eypi.cc`.
  Dashboard → Analytics & Logs → Web Analytics → the `eypi.cc` site → Manage site. Turn off automatic setup / JS snippet injection, or choose Disable, and save.
  Check, after 5 minutes: hard-reload <https://eypi.cc>. The console has no red error that mentions `static.cloudflareinsights.com`.

  Send back: "Web Analytics injection is off", or the console text if the error is still there.

- [ ] **1.2 Where the database lives.** `turso db show <production-db-name>`. Turso does not need a change. The output has a location or region line, for example `Locations: aws-ap-northeast-1`.

  Send back: the location/region line only. Do not send the URL or any token.

### Part 2 — Releasing a phase

Repeat for each phase that is ready to release. A backend deploy in 2D.1 still waits until avatar part 1 is applied.

- [ ] **2A.1 Pre-flight.** `git checkout main`, `git pull`, `npm run release:check`. Exit code 0, and every step prints `ok`.

  Send back: "release:check ok", or the output if it fails.

- [ ] **2B.1 Rehearsal copy** (skip if this phase has no migration). `turso db create eypi-rehearsal --from-db <production-db-name>`, then show its URL and create a token. Keep the URL and token in that terminal only.

  Send back: "rehearsal copy created". Do not send the URL or the token.

- [ ] **2B.2 Migrate the copy.** Point `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` at the copy. `--status` must print a host that contains `eypi-rehearsal`. If it shows the production host, stop. Then `--dry-run`, `--yes`, and `--status`. `--dry-run` lists only the files named for this phase. The last `--status` shows nothing pending. Do not pass `--allow-destructive`. If the runner asks for it, stop.

  Send back: "rehearsal migration applied", or stop and tell the agent if the runner asks for `--allow-destructive`.

- [ ] **2B.3 Destroy the copy.** `unset TURSO_DATABASE_URL TURSO_AUTH_TOKEN`, then `turso db destroy eypi-rehearsal`.

  Send back: "rehearsal copy destroyed".

- [ ] **2C.1 Note the UTC time** (skip if this phase has no migration). `date -u +%Y-%m-%dT%H:%M:%SZ`. Write it down for point-in-time restore.

  Send back: that timestamp.

- [ ] **2C.2 Apply on production.** Use a new terminal, so no rehearsal variables are left. `--status` shows the production host and the pending files named for this phase. Then `--dry-run`, `--yes`, and `--status`. Nothing is pending at the end.

  Send back: "production migration applied".

- [ ] **2D.1 Backend.** From `backend/`, `npm run deploy`. Wrangler prints `Deployed backend` with a version id.

  Send back: "backend deployed" and the version id.

- [ ] **2D.2 Frontend.** From the repo root, `npm run deploy`. Wrangler prints a deployed version id.

  Send back: "frontend deployed" and the version id.

- [ ] **2D.3 Smoke test.** `npm run smoke`. Every line says `PASS`.

  Send back: "smoke PASS", or the failing line.

- [ ] **2D.4 Tell the agent.**

  Send back: "Phase N is deployed" plus the date and time.

If a deploy breaks, follow **Emergency** at the end of `docs/owner-guide-speed-tix-analytics.md`. That section is not a step to start now.

### Part 3 — Extra steps per phase

- [ ] **3.1.1 API placement** (Phase 1). Cloudflare → Workers & Pages → the backend Worker → Settings → General (or Runtime) → Placement. It shows **Smart** or a region, not Default. Cloudflare can take up to 15 minutes after a deploy.

  Send back: "placement is Smart" or "placement is <region>".

- [ ] **3.1.2 Optimize images** (Phase 1). Sign in at <https://eypi.cc> → Admin → Maintenance → Optimize images → **Optimize**, until the page says **0 images left to optimize**. Another click skips finished images. If the same image keeps failing, send its name from the list.

  Send back: "0 images left", or the image name that keeps failing.

- [ ] **3.1.3 Speed page after 7 days** (Phase 1). Admin → Speed, a week after deploying. The page shows data for the main routes.

  Send back: a screenshot. The spec targets are LCP ≤ 2.0 s on public pages, INP ≤ 200 ms, and CLS ≤ 0.05.

- [ ] **3.2.1 Reserved paths** (Phase 2). For each existing short link whose slug is `t` or `tickets`, choose **rename** (the agent names the new slug, and you tell the link owner) or **keep** (the agent picks a different path).

  Send back: the decision for each one, or "the list is empty, go ahead".

- [ ] **3.2.2 Tix on your phone** (Phase 2, about 15 minutes). Use a test event in your own org, set to **Unlisted**. This step publishes that event and deletes it at the end.
  1. Manage → Tix → New event. Admission **First come, first served**, capacity **2**, waitlist **on**. Publish.
  2. Open the event link on your phone and **Register**. The ticket appears under **My tickets** with a QR.
  3. One other APC student registers, then a third. The third person is **waitlisted**.
  4. Cancel your own registration. The waitlisted person becomes **confirmed** within a few seconds.
  5. Attendees → Add guest with a non-APC email. Open their guest link in a private window. The ticket shows without signing in.
  6. **Door mode** on a second phone, airplane mode on, scan one ticket. It shows checked in with "waiting to sync". Airplane mode off. The counter updates on both phones.
  7. Delete the test event.

  Send back: "Tix flow OK", or the step number and what you saw.

- [ ] **3.3.1 Privacy policy** (Phase 3). Read the change to `src/legal/privacy.ts` (new version date). It should match what the app collects: device type, browser, in-app source such as Messenger, speed samples, Frames and org page views, and retention (raw clicks 400 days, speed samples 30 days). Signed-in users are asked to accept the new version on their next visit.

  Send back: "privacy update approved", or your edits.

- [ ] **3.3.2 Hourly job** (Phase 3). Cloudflare → Workers & Pages → backend → Settings → Triggers (or Cron Triggers). Two schedules: the daily `0 19 * * *` and the hourly `15 * * * *`. A day later, any link's analytics shows yesterday's numbers.

  Send back: "both crons are listed". The next day: "yesterday's numbers show", or what is missing.

- [ ] **3.4.1 UX audit marks** (Phase 4). The screenshot list is `docs/superpowers/specs/2026-10-27-ux-audit.md`. Mark each issue **fix**, **skip**, or **later**. This step needs no Cloudflare, Turso, or secrets.

  Send back: that marked list.

---

## 3. October 2026 security review

Source: `docs/RELEASE.md`, "October 2026 security review: owner checklist". Every box in that list is still open. Do these in the dashboards.

- [ ] **No PHP anywhere.** This repo is Hono on Workers plus a static SPA, so PHP2Shell (CVE-2026-109618 and CVE-2026-109619) does not apply. Confirm nothing else answers on `api.eypi.cc` or `*.eypi.cc`. The Laravel Forge mail records are Resend/Forge DNS only.

  Send back: "nothing else answers on eypi.cc".

- [ ] **Email auth (DMARC and SPF).** Add a DMARC record (`_dmarc.eypi.cc`, start with `v=DMARC1; p=quarantine; rua=mailto:<inbox>`) and an apex SPF record that matches the sending provider, then check DKIM passes for `send.eypi.cc`.

  Send back: "DMARC, SPF, and DKIM are in place".

- [ ] **Cloudflare (WAF and HSTS).** Keep the managed WAF ruleset on, HSTS preload on, and Always Use HTTPS on for `eypi.cc`.

  Send back: "WAF, HSTS preload, and Always Use HTTPS are on".

- [ ] **Node.** CI and Workers build on Node 22. Keep it on 22.23.4 or later (Brotli and TLS fixes of 21 Oct 2026).

  Send back: "Node is 22.23.4 or later".

- [ ] **Lockfiles.** `npm ls tensorlake @subql/common` in both packages returns nothing. Last checked 27 Oct 2026: clean.

  Send back: "lockfile check is clean", or whatever the command prints.

- [ ] **CAA records.** Restrict issuance to `pki.goog` (the current Cloudflare certificate issuer) and add `letsencrypt.org` if you want a fallback. Check Cloudflare's Universal SSL CA list first so renewals are not blocked.

  Send back: "CAA records set".

- [ ] **Domain renewal.** Turn on auto-renew at Spaceship. `eypi.cc` expires 2027-02-28.

  Send back: "auto-renew is on".

- [ ] **Passkeys.** Use passkeys or security keys on Google Workspace, GitHub, and Cloudflare.

  Send back: "passkeys are on for Workspace, GitHub, and Cloudflare".

- [ ] **Secrets.** Rotate any Worker or Cloudflare value that was ever stored as plain text instead of a secret.

  Send back: "plain-text values rotated". Do not send the values.

- [ ] **Local Node.** Update dev machines to Node 22.23.4, 24.22.1, or 26.12.1 or later.

  Send back: "dev machines updated".

- [ ] **security.txt.** `public/.well-known/security.txt` expires 2027-10-27. Renew it before then.

  Send back: "security.txt renewed".

---

## 4. Signed-in browser pass

Look only. For every route below, look on a phone and on a desktop, in **Light**, **Dark**, and **True black**. On `/admin/speed`, press **7 days** and **28 days**. Those buttons only change the range on screen. Do not click anything that writes.

- [ ] `/admin/speed` (tiles, and the **7 days** and **28 days** buttons)
- [ ] `/links`
- [ ] `/manage/tix`
- [ ] an event's attendees
- [ ] `/forms/visitors-pass`
- [ ] `/forms/letter-of-intent`
- [ ] an org's members
- [ ] `/admin/users`
- [ ] `/admin/links`

Send back: "signed-in pass ok", or the route, the theme, phone or desktop, and what looked wrong. If a route will not open, send "unseen" and the route.

