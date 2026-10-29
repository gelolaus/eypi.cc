# Avatar picker design

Date: 2026-10-29. Status: awaiting owner review.

## Goal

Let each signed-in person choose an avatar from a curated list of icons and a preset colour, instead of showing the first two letters of their name. There are no photo uploads.

## What the owner decided

- Icons come from the icon pack already in the app (`lucide-vue-next`), as a curated set.
- Colours are **preset swatches**, not a free colour picker.
- The chosen avatar appears **everywhere a person appears**.
- This is a separate spec from [dark mode](2026-10-29-dark-mode-design.md). Build dark mode first, because the swatches are checked against its themes.

## Current state (read from the code)

- Only `src/components/layout/AccountMenu.vue` shows a person's avatar, using `Avatar` and `AvatarFallback` with `initials` (the first two letters of the display name). Everywhere else people appear as plain text.
- The `users` table (`docs/db/schema-baseline.md`) has `id`, `email`, `name`, `role`, `created_at`, `last_login_at`, `disabled_at`, `tickets_seen_at` and no avatar fields. Migrations so far run `0001` to `0012` in `backend/migrations/`, and earlier ones already use `ALTER TABLE users ADD COLUMN`.
- People appear in the org member list (`backend/src/routes/orgs.ts`, the query that joins `users` for `name`) and the admin users list and detail (`backend/src/routes/admin.ts`). `GET /api/me` and `account.ts` return the signed-in user.
- `AGENTS.md` forbids dropping or rebuilding `users`, because foreign keys are on and `links` cascades. This feature only adds columns.

## Design

### 1. Data

Migration `backend/migrations/0013_user_avatar.sql`:

```sql
ALTER TABLE users ADD COLUMN avatar_icon TEXT;
ALTER TABLE users ADD COLUMN avatar_color TEXT;
```

Both are nullable with no default. Null means "show the initials", so every existing row is unchanged. The columns store a **key** from the shared lists, never a URL, markup or free text. The owner applies the migration, per `AGENTS.md`; the work only adds the file and the doc steps.

### 2. Shared contract

A new file in `shared/`, `avatars.ts`, exports:

- `AVATAR_ICONS`: an ordered list of icon keys (kebab-case, matching the Lucide names).
- `AVATAR_COLORS`: an ordered list of colour keys (for example `blue`, `gold`, `rose`).
- `isAvatarIcon(value)` and `isAvatarColor(value)` type guards.

The frontend and the API both validate against these lists, so they cannot drift.

### 3. Icons

- A curated set of about 36 Lucide icons that suit a student community: animals, school and study, sports, music and games, nature, and a few abstract shapes. The final list is chosen in the implementation plan and committed as `AVATAR_ICONS`.
- The frontend maps each key to its component through one static map in `src/components/avatar/avatarIcons.ts`. Static imports keep the bundle to only the icons in the set and let tree-shaking work.
- A test asserts every key in `AVATAR_ICONS` has a component in the map and vice versa.

### 4. Colours

- About 12 preset swatches built on the Eypi palette (APC blue and APC gold, plus others).
- Each swatch has a light and a dark variant: the icon is drawn in the swatch colour on a soft wash of the same colour (the site's `bg-primary/15` look), and the dark variant is lighter so it reads on Dark and True black.
- The colours are tokens defined next to the theme tokens, not hard-coded in components. The contrast test from the dark mode spec runs for every swatch against the avatar wash and the page background in Light, Dark and True black.

### 5. API

- `GET /api/me` returns `avatarIcon` and `avatarColor` (each null when unset).
- `PATCH /api/account/avatar` in `backend/src/routes/account.ts`:
  - Body: `{ icon: string | null, color: string | null }`.
  - Both must be valid keys, or both null to reset. Anything else returns 400 with a stable error code. Unknown keys are never stored.
  - It updates only the signed-in user's row, uses the existing rate limiting, and returns the new values.
- The org member list (`orgs.ts`) and the admin users list and detail (`admin.ts`) include the two fields for each person. Visibility matches the audience that already sees that person's name: org members for their org, admins for the admin views.
- Public pages (for example public org profiles) do not include avatar fields.

### 6. UI

- `src/components/avatar/UserAvatar.vue` renders the chosen icon on its wash, or the initials when none is set. It takes a size and the user's fields. It replaces the avatar in `AccountMenu.vue` and is used in the org member list and the admin users view.
- `src/components/avatar/AvatarPicker.vue`, opened from the account menu with a "Change avatar" item, is a dialog in the site's existing dialog style:
  - A grid of icon buttons.
  - A row of colour swatches.
  - A live preview.
  - Save and Reset buttons. Reset clears both fields.
- Accessibility: every icon and swatch is a labelled button with a visible focus ring, at least 44px targets, selection is conveyed by more than colour, and the dialog closes on Escape and returns focus to the menu. UI copy follows section 13 of `DESIGN_SYSTEM.md`.
- Saving updates the signed-in user in the app store, so the account menu changes without a reload, and shows the site's toast on success and on failure.

### 7. Testing (written first)

- Migration: it only adds two nullable columns, and existing rows read back as null.
- API: valid keys are saved; unknown icon or colour keys return 400; one key without the other returns 400; null and null resets; a person can change only their own avatar; `/api/me` returns the fields; the member and admin lists include them; public pages do not.
- Shared contract: the type guards accept only listed keys, and the frontend icon map covers exactly `AVATAR_ICONS`.
- Components: `UserAvatar` shows the icon, or initials when null; `AvatarPicker` selection, live preview, save, reset, keyboard use and focus return.
- Contrast: every swatch passes in Light, Dark and True black.
- `npm run typecheck` and `npm test` pass, and the owner checks the picker in a browser at desktop and phone width.

### 8. Docs

- `docs/db/schema-baseline.md`: add the two columns.
- `DESIGN_SYSTEM.md`: add an avatar section (icon set, swatches, sizes).
- `docs/owner-guide-avatar-picker.md` (new): how to apply migration `0013` to the database and then deploy, in that order.
- `AGENTS.md`: add this spec to the index.

## Out of scope

Photo uploads, a free colour picker, animated icons, avatars on public pages, and changing the Microsoft sign-in profile data.

## Risks

- **Dark mode dependency:** the swatch variants rely on the dark mode tokens, so build order matters.
- **Admin query changes:** the member and admin queries gain two columns, so their tests and types must be updated together.
- **Migration timing:** the new queries select the two columns, so they fail if the code is deployed before the migration. The order is fixed: the owner applies `0013`, then deploys. The owner guide says so.
