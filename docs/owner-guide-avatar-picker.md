# Owner guide: avatar picker

Everything in this change that only you (the owner) can do. The design is in `docs/superpowers/specs/2026-10-29-avatar-picker-design.md`. Agents write the code and tell you when it is ready; they never run the steps below.

**How to use this guide**

- Do the steps in order. The order matters (see step 2).
- Run commands in **Git Bash** from the repo root (`C:\Users\gelo\Documents\GitHub\eypi.cc`).
- Tick each box as you go. If a check fails, stop and paste the output to the agent.

---

## Step 1: Apply the migration to production (do this first)

- [x] **1.1 Apply `backend/migrations/0013_user_avatar.sql` to the production Turso database.**
  The file has two additive statements:
  ```sql
  ALTER TABLE users ADD COLUMN avatar_icon TEXT;
  ALTER TABLE users ADD COLUMN avatar_color TEXT;
  ```
  It is safe to run once. Nothing is dropped, rebuilt or rewritten, and every existing user keeps their initials until they pick an avatar. Do not run it a second time: SQLite fails on a column that already exists.

  Use the normal migration runbook in `docs/RELEASE.md` (rehearse on a copy first if you want to):
  ```bash
  git checkout main
  git pull
  npm run migrate --prefix backend -- --status
  npm run migrate --prefix backend -- --dry-run
  npm run migrate --prefix backend -- --yes
  ```
  Check: `--status` shows `0013_user_avatar` as pending before, and applied after. Confirm the printed host is the production database before you run `--yes`.

  Send the agent: "0013 applied".

---

## Step 2: Deploy the backend and the frontend (only after step 1)

- [ ] **2.1 Deploy the backend, then the frontend,** the way `docs/RELEASE.md` describes.

  **Why the order matters.** The new member list and admin users queries, and `GET /api/me`, select `avatar_icon` and `avatar_color`. If the code goes out before the migration, those queries fail on a missing column and the member list, admin users list and sign-in session break. If the migration goes out first, the old code simply ignores the two new columns, so nothing breaks while you deploy. That is why the migration is step 1 and the deploy is step 2.

---

## Step 3: Check it on the live site (about 5 minutes)

- [ ] **3.1 Pick an avatar.** Sign in at <https://eypi.cc>, open the account menu, and choose **Change avatar**. Choose an icon and a colour, then **Save**.
  Check: the dialog closes, focus is back on the account menu button, and your avatar shows in the account menu without a reload.

- [ ] **3.2 Check all three themes.** Open the account menu, choose each of **Light**, **Dark** and **True black**, and look at your avatar in each.
  Check: the icon and its soft background are clearly visible in every theme.

- [ ] **3.3 Check the lists.** Open your org's member list and, as an admin, Admin, Users.
  Check: your avatar shows next to your name in both. Other people still show their initials.

- [ ] **3.4 Check Reset.** Open **Change avatar** again and choose **Reset**.
  Check: your initials come back everywhere.

Send the agent: "avatar picker checked", or what looked wrong, with the theme and screen size.
