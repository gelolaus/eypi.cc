# Owner guide: speed, Tix and analytics

Everything in this round of work that only you (the owner) can do, in the order you do it. The design is in `docs/superpowers/specs/2026-10-27-eypi-speed-tix-analytics-design.md`. Agents write the code and tell you when a phase is ready; they never run the steps below.

**How to use this guide**

- Do the sections in order. Each step says what to do, how to check it worked, and what to send back to the agent.
- Run commands in **Git Bash** from the repo root (`C:\Users\gelo\Documents\GitHub\eypi.cc`) unless a step says otherwise.
- Tick each box as you go. If a check fails, stop and paste the output to the agent.

---

## Part 0 — One-time setup (about 10 minutes)

- [ ] **0.1 Update your copy of the repo.**
  ```bash
  git checkout main
  git pull
  npm run setup
  ```
  Check: the commands finish without errors.

- [ ] **0.2 Sign in to Cloudflare from the terminal.**
  ```bash
  npx wrangler login
  npx wrangler whoami
  ```
  Check: `whoami` prints the account that owns `eypi.cc`.

- [ ] **0.3 Sign in to Turso from the terminal.**
  ```bash
  turso auth login
  turso db list
  ```
  Check: the list shows the production database. Write its name down; this guide calls it `<production-db-name>`.

---

## Part 1 — Before Phase 1 starts (do these now)

- [ ] **1.1 Turn off Cloudflare Web Analytics automatic injection.**
  Why: Cloudflare injects its analytics script into every page, but our security policy blocks it, so it records nothing and adds console errors. Eypi's own speed monitoring (Phase 1) replaces it.
  1. Open <https://dash.cloudflare.com> and pick the account that owns `eypi.cc`.
  2. In the left menu, open **Analytics & Logs → Web Analytics**.
  3. Find the `eypi.cc` site in the list and open **Manage site** (or the site's settings).
  4. Turn off the **automatic setup / JS snippet injection** option, or choose **Disable**, and save. (Cloudflare sometimes renames these labels. You want the setting that stops the script being added to pages.)

  Check (wait 5 minutes for the change to spread):
  1. Open <https://eypi.cc> in Chrome, press `F12`, and open the **Console** tab.
  2. Reload with `Ctrl+Shift+R`.
  3. There should be **no** red error that mentions `static.cloudflareinsights.com`.

  Send the agent: "Web Analytics injection is off" (or the console text if the error is still there).

- [ ] **1.2 Tell the agent where the database lives.**
  Why: the API runs faster when it runs close to the database. The agent sets the API Worker's placement from this.
  ```bash
  turso db show <production-db-name>
  ```
  Check: the output has a line for the location or region, for example `Locations: aws-ap-northeast-1`. Turso doesn't need to change.

  Send the agent: the **location/region line only**. Don't send the URL or any token.

---

## Part 2 — Releasing a phase (repeat for every phase)

The agent tells you "Phase N is ready to release" and which migration files it adds (if any). Then do these steps in order. This is the normal release runbook (`docs/RELEASE.md`) written out for this round of work.

### 2A. Pre-flight

- [ ] **2A.1 Get the latest code and check it.**
  ```bash
  git checkout main
  git pull
  npm run release:check
  ```
  Check: it ends with exit code 0 and every step prints `ok`. If anything fails, stop and send the output to the agent.

### 2B. Rehearse the migration on a copy (skip if the phase has no migration)

- [ ] **2B.1 Make a throwaway copy of production.**
  ```bash
  turso db create eypi-rehearsal --from-db <production-db-name>
  turso db show eypi-rehearsal --url
  turso db tokens create eypi-rehearsal
  ```
  Keep the URL and token in this terminal only. Don't paste them anywhere else.

- [ ] **2B.2 Point this terminal at the copy and run the migration there.**
  ```bash
  export TURSO_DATABASE_URL=<branch url>
  export TURSO_AUTH_TOKEN=<branch token>
  npm run migrate --prefix backend -- --status
  ```
  Check: the printed **host contains `eypi-rehearsal`**. If it shows the production host, stop.
  ```bash
  npm run migrate --prefix backend -- --dry-run
  npm run migrate --prefix backend -- --yes
  npm run migrate --prefix backend -- --status
  ```
  Check: `--dry-run` lists only the files the agent named, and the last `--status` shows nothing pending. None of this round's migrations should need `--allow-destructive`. If the runner asks for it, stop and tell the agent.

- [ ] **2B.3 Clean up the copy.**
  ```bash
  unset TURSO_DATABASE_URL TURSO_AUTH_TOKEN
  turso db destroy eypi-rehearsal
  ```

### 2C. Migrate production (skip if no migration)

- [ ] **2C.1 Note the time** (for point-in-time restore if something goes wrong):
  ```bash
  date -u +%Y-%m-%dT%H:%M:%SZ
  ```
  Write the output down.

- [ ] **2C.2 Apply to production.** Open a **new** terminal (so no rehearsal variables are left), then:
  ```bash
  npm run migrate --prefix backend -- --status
  ```
  Check: the host is **production** and the pending files are the ones the agent named.
  ```bash
  npm run migrate --prefix backend -- --dry-run
  npm run migrate --prefix backend -- --yes
  npm run migrate --prefix backend -- --status
  ```
  Check: nothing pending at the end.

### 2D. Deploy (backend first, then frontend)

- [ ] **2D.1 Backend.**
  ```bash
  cd backend
  npm run deploy
  cd ..
  ```
  Check: wrangler prints `Deployed backend` with a version id.

- [ ] **2D.2 Frontend.**
  ```bash
  npm run deploy
  ```
  Check: wrangler prints a deployed version id.

- [ ] **2D.3 Smoke test.**
  ```bash
  npm run smoke
  ```
  Check: every line says `PASS`.

- [ ] **2D.4 Tell the agent** "Phase N is deployed" plus the date and time. The agent uses it to compare speed before and after.

If anything breaks after deploying, see **Emergency** at the end.

---

## Part 3 — Extra steps per phase

Do these right after Part 2 for the matching phase.

### Phase 1 — Speed

- [ ] **3.1.1 Check the API placement setting.**
  1. Cloudflare dashboard → **Workers & Pages** → the **backend** Worker → **Settings** → **General** (or **Runtime**).
  2. Under **Placement**, you should see **Smart** or a region (whichever the agent set from step 1.2).

  Check: it isn't "Default". Cloudflare can take up to 15 minutes to analyze traffic after a deploy.

- [ ] **3.1.2 Optimize the existing images (one click, about 5 minutes).**
  1. Sign in at <https://eypi.cc> with your admin account.
  2. Open **Admin → Maintenance → Optimize images**.
  3. Click **Optimize** and keep the tab open until it says it's done. It processes one image at a time.

  Check: the page says **0 images left to optimize**. If some fail, click **Optimize** again; it skips finished ones. If the same image keeps failing, send the agent its name from the list.

- [ ] **3.1.3 Check the speed page after 7 days.**
  Open **Admin → Speed** a week after deploying.
  Check: the page shows data for your main routes. Send the agent a screenshot; they compare it with the targets in the spec (LCP ≤ 2.0 s on public pages, INP ≤ 200 ms, CLS ≤ 0.05).

### Phase 2 — Tix

- [ ] **3.2.1 Approve the new reserved paths.** Before this phase, the agent sends you a list of any existing short links that use `t` or `tickets` as their slug (it's usually empty). For each one, choose:
  - **Rename it** (the agent tells you the new slug, and you let the link owner know), or
  - **Keep it**, in which case the agent picks a different path for the feature.

  Send the agent your decision for each one, or "the list is empty, go ahead".

- [ ] **3.2.2 Try the flow end to end on your phone** (about 15 minutes). Use a test event in your own org, set to **Unlisted**.
  1. **Manage → Tix → New event.** Set admission to **First come, first served**, capacity **2**, waitlist **on**. Publish.
  2. Open the event link on your phone and **Register**. Check: the ticket appears under **My tickets** with a QR.
  3. Ask one other APC student to register, then a third. Check: the third person is **waitlisted**.
  4. Cancel your own registration. Check: the waitlisted person becomes **confirmed** within a few seconds.
  5. **Attendees → Add guest** with a non-APC email. Copy their **guest link** and open it in a private window. Check: the ticket shows without signing in.
  6. Open **Door mode** on a second phone, turn on **airplane mode**, and scan one ticket. Check: it shows as checked in with "waiting to sync". Turn airplane mode off. Check: the counter updates on both phones.
  7. Delete the test event.

  Send the agent: "Tix flow OK", or the step number and what you saw.

### Phase 3 — Analytics

- [ ] **3.3.1 Review and approve the privacy policy update.**
  Why: this phase records more click details (device type, browser, in-app source such as Messenger), keeps speed samples and Frames/org page views, and sets retention (raw clicks 400 days, speed samples 30 days). RA 10173 needs the policy to say so.
  1. The agent opens a change to `src/legal/privacy.ts` with a new version date.
  2. Read the changed sections. Check: they match what the app actually collects, as listed above.
  3. Send the agent "privacy update approved", or your edits.

  Signed-in users are asked to accept the new version on their next visit. That's expected.

- [ ] **3.3.2 Check the new hourly job.**
  Cloudflare dashboard → **Workers & Pages** → **backend** → **Settings** → **Triggers** (or **Cron Triggers**).
  Check: two schedules are listed, the existing daily `0 19 * * *` and the new hourly `15 * * * *`. A day later, open any link's analytics and check that yesterday's numbers show.

### Phase 4 — UX polish

- [ ] **3.4.1 Review the audit list.** The agent sends a list of UX issues found by screenshotting every page. Mark each one **fix**, **skip** or **later**, and send it back. Nothing in this phase needs Cloudflare, Turso or secrets.

---

## Emergency

**The site shows an old version, or keeps breaking after a deploy (service worker problem).**
1. Ask the agent for the **service worker kill switch** commit (the spec defines it; it replaces `public/sw.js` with a version that unregisters itself).
2. Deploy the frontend only (step 2D.2), then smoke test (2D.3).
3. Each visitor's browser removes the broken worker on their next page load.

**A deploy broke something.**
1. Workers keep previous versions. Check the command first:
   ```bash
   npx wrangler rollback --help
   ```
2. Roll back the Worker that broke (run inside `backend/` for the API, or from the repo root for the frontend).
3. A rollback doesn't undo database migrations. All migrations in this round only add columns and tables, so old code keeps working with them.

**A migration damaged data.**
Follow "Point-in-time restore" in `docs/operations.md`, using the time you wrote down in step 2C.1.
