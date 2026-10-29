# Avatar Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each signed-in person pick an icon and a preset colour as their avatar, shown everywhere a person appears, in place of initials.

**Architecture:** Two nullable `users` columns store keys from a shared list (`shared/avatars.ts`), validated identically by the API and the SPA. A `PATCH /api/account/avatar` route saves them, and `/api/me`, the org member list and the admin users list return them. A `UserAvatar` component renders the icon on a colour wash (colours are theme tokens), and an `AvatarPicker` dialog opened from the account menu edits it.

**Tech Stack:** Vue 3, reka-ui dialog, `lucide-vue-next`, Hono + libSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-29-avatar-picker-design.md` (dark mode, which this builds on, is merged: `docs/superpowers/specs/2026-10-29-dark-mode-design.md`).

## Global Constraints

- Migration `0013_user_avatar.sql` only adds two nullable columns with no default. Never drop or rebuild `users` (`AGENTS.md`). The owner applies the migration; no task runs it against the production database.
- The columns store a key from `AVATAR_ICONS` / `AVATAR_COLORS`, never a URL, markup or free text. Unknown keys are never stored.
- Null in both columns means "show initials". Existing rows stay unchanged.
- `PATCH /api/account/avatar` body is `{ icon: string | null, color: string | null }`: both valid keys, or both null (reset). Anything else is HTTP 400 with `{ error: { code: 'invalid_avatar', message } }`. It updates only the signed-in user's own row.
- Avatar fields appear only where that person's name already appears: the signed-in user (`/api/me`), org members for the owner's member list, admins for the admin users list. Public org pages never include them.
- Colours are tokens in `src/styles/tokens.css`, never hex in `.vue` files. `dark:` utilities stay banned. UI copy follows `DESIGN_SYSTEM.md` section 13 (sentence case, no em dashes).
- Accessibility: every icon and swatch is a labelled button with the visible focus ring, 44px minimum targets, selection shown by more than colour, dialog closes on Escape and returns focus to the menu.
- Commits: Conventional Commits, no trailers (`AGENTS.md`). Tick each task's plan checkboxes in the same commit.

## Review Focus

- **Stale or tampered stored keys** (a key later removed from the list, or a row edited by hand): `UserAvatar` and the session parser fall back to initials instead of rendering nothing or throwing. Tested in Tasks 4 and 5.
- **Only one of icon/color sent**, wrong types (`5`, `{}`, `''`), extra fields: 400, nothing stored. Tested in Task 2.
- **Another user's avatar**: a body cannot target a different user; the route reads the id from the session only. Tested in Task 2.
- **Names with emoji, one letter, or empty**: initials fallback never throws or renders blank. Tested in Task 4.
- **Save fails (offline, 500)**: the picker stays open, shows the failure toast, and the account menu keeps the old avatar. Tested in Task 6.

---

### Task 1: Shared contract and migration

**Files:**
- Create: `shared/avatars.ts`, `shared/avatars.test.ts`
- Create: `backend/migrations/0013_user_avatar.sql`
- Create: `backend/src/migrations.avatar.test.ts` (or add to the existing migrations test if one already loads every file; follow `createTestApp` in `backend/src/test/createTestApp.ts`)

**Interfaces:**
- Produces from `shared/avatars.ts`:
  - `export const AVATAR_ICONS: readonly string[]` as a `const` tuple of kebab-case Lucide names, exactly: `cat dog bird fish rabbit squirrel turtle snail book-open graduation-cap pencil backpack lightbulb calculator dumbbell bike trophy volleyball target music headphones guitar gamepad-2 dices puzzle leaf flower-2 sun moon mountain tree-pine star heart zap flame rocket` (36 keys).
  - `export const AVATAR_COLORS` as a `const` tuple, exactly: `blue indigo violet pink red orange gold green teal sky slate brown` (12 keys).
  - `export type AvatarIcon`, `export type AvatarColor` (the tuple element types).
  - `export function isAvatarIcon(value: unknown): value is AvatarIcon`, `export function isAvatarColor(value: unknown): value is AvatarColor`.
  - `export function parseAvatar(input: unknown): { icon: AvatarIcon; color: AvatarColor } | { icon: null; color: null } | null`: takes the request body, returns the pair, the reset pair for `{icon:null,color:null}`, or `null` when invalid (one key missing, wrong type, unknown key, not an object).

- [x] **Step 1: Write the failing tests** in `shared/avatars.test.ts`: both lists have no duplicates and the stated lengths (36, 12); every icon key matches `/^[a-z0-9]+(-[a-z0-9]+)*$/`; `isAvatarIcon('cat')` true, `isAvatarIcon('Cat')`, `''`, `5`, `null` false; same for colours; `parseAvatar({icon:'cat',color:'blue'})` returns the pair; `{icon:null,color:null}` returns the reset pair; `null` is returned for `{icon:'cat'}`, `{color:'blue'}`, `{icon:'cat',color:null}`, `{icon:'nope',color:'blue'}`, `{icon:5,color:'blue'}`, `[]`, `'x'`, `undefined`. Migration test: after `createTestApp` runs all migrations, `PRAGMA table_info(users)` contains `avatar_icon` and `avatar_color` with `notnull = 0` and `dflt_value` null, and an existing seeded user reads both as null.
- [x] **Step 2: Run to verify it fails** (`npx vitest run shared/avatars.test.ts backend/src/migrations.avatar.test.ts`): module not found / columns missing.
- [x] **Step 3: Implement** `shared/avatars.ts` per the interface (use `Set` lookups for the guards), and the migration containing exactly `ALTER TABLE users ADD COLUMN avatar_icon TEXT;` and `ALTER TABLE users ADD COLUMN avatar_color TEXT;` plus a header comment ("Additive only. users is never rebuilt").
- [x] **Step 4: Run to verify it passes**, then `npm run typecheck`.
- [x] **Step 5: Commit** `feat(avatar): add the shared avatar lists and the user avatar migration`.

---

### Task 2: Save and read the signed-in user's avatar

**Files:**
- Modify: `backend/src/routes/account.ts` (new route), `backend/src/routes/me.ts` (return fields)
- Test: `backend/src/routes/account.test.ts`, `backend/src/routes/me.test.ts`

**Interfaces:**
- Consumes: `parseAvatar` from `shared/avatars.ts` (import with the relative path style used in `backend/src/lib/auth/identity.ts`, `../../../shared/avatars`).
- Produces: `PATCH /api/account/avatar` (`requireAuth`) returning `200 { avatarIcon: string | null, avatarColor: string | null }`; `GET /api/me` `user` object gains `avatarIcon` and `avatarColor` (each `string | null`).

- [ ] **Step 1: Write the failing tests** following the existing seeding and `jsonRequest` helpers in each file:
  - account: valid `{icon:'cat',color:'blue'}` returns 200 with the values and the row stores them; `{icon:null,color:null}` resets a saved avatar to null; each of `{icon:'cat'}`, `{icon:'cat',color:null}`, `{icon:'nope',color:'blue'}`, `{icon:5,color:'blue'}`, `{}` and a non-JSON body returns 400 with `error.code === 'invalid_avatar'` and leaves the row unchanged; an extra field (`{icon:'cat',color:'blue',id:'other-id'}`) saves only the signed-in user and leaves the other seeded user's row null; no session returns 401 (the existing `UNAUTHORIZED` shape).
  - me: a user with a saved avatar gets both fields; a user without gets `null` for both.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement** the route (`UPDATE users SET avatar_icon = ?, avatar_color = ? WHERE id = ?` with the session user id, then return the saved values) and add one more query to the `Promise.all` in `/api/me`: `SELECT avatar_icon, avatar_color FROM users WHERE id = ?`.
- [ ] **Step 4: Run to verify they pass**; run the whole backend suite (`npx vitest run backend`).
- [ ] **Step 5: Commit** `feat(avatar): add the avatar route and return it from me`.

---

### Task 3: Avatar fields in the member and admin lists

**Files:**
- Modify: `backend/src/routes/orgs.ts` (owner member list query around the `u.name AS name` select), `backend/src/routes/admin.ts` (`loadUser`, the users list `SELECT`, `toUser`)
- Test: `backend/src/routes/orgs.invites.test.ts` (or the file that already tests the member list), `backend/src/routes/admin.test.ts`, `backend/src/routes/orgs.public.test.ts`

**Interfaces:**
- Produces: each row of the owner's `GET /api/orgs/:org_id/members` response gains `avatar_icon` and `avatar_color` (null when unset or when the member has no account yet); each admin user (`items[]` and the PATCH response `item`) gains `avatarIcon` and `avatarColor`.

- [ ] **Step 1: Write the failing tests:** the member list returns both fields for a member with a saved avatar and nulls for one without an account; the admin list and the PATCH response return `avatarIcon`/`avatarColor`; the public org catalog and public org profile responses contain no key matching `/avatar/i` anywhere in the JSON (stringify and assert).
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement:** select `u.avatar_icon, u.avatar_color` in the member query; add `avatar_icon, avatar_color` to both admin `SELECT`s and map them in `toUser` (null when empty). Selecting a stored key not in the lists passes it through unchanged; clients validate on read (Task 4/5).
- [ ] **Step 4: Run to verify they pass**; run `npx vitest run backend` and `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(avatar): return avatars in the member and admin lists`.

---

### Task 4: Swatch tokens, icon map and `UserAvatar`

**Files:**
- Modify: `src/styles/tokens.css`, `src/styles/design.test.ts`, `DESIGN_SYSTEM.md` (token names only here; the avatar section is Task 7)
- Create: `src/components/avatar/avatarIcons.ts`, `src/components/avatar/avatarIcons.test.ts`, `src/components/avatar/UserAvatar.vue`, `src/components/avatar/UserAvatar.test.ts`

**Interfaces:**
- Produces tokens: one `--avatar-<color>` per key in `AVATAR_COLORS`, defined in `:root` and `.dark` (not in `.dark.black`; True black inherits Dark). Starting values (the contrast test is the authority; adjust any that fail):
  - Light: blue `#35438c`, indigo `#4338ca`, violet `#6d28d9`, pink `#be185d`, red `#c62828`, orange `#c2410c`, gold `#a87a1c`, green `#15803d`, teal `#0f766e`, sky `#0369a1`, slate `#475569`, brown `#92400e`.
  - Dark: blue `#8b97d8`, indigo `#a5b4fc`, violet `#c4b5fd`, pink `#f9a8d4`, red `#ef7373`, orange `#fdba74`, gold `#deac4b`, green `#86efac`, teal `#5eead4`, sky `#7dd3fc`, slate `#cbd5e1`, brown `#d6a77a`.
- Produces `AVATAR_ICON_COMPONENTS: Record<AvatarIcon, Component>` in `avatarIcons.ts`: one static import per icon from `lucide-vue-next` (PascalCase of the key, for example `book-open` is `BookOpen`, `gamepad-2` is `Gamepad2`, `flower-2` is `Flower2`, `tree-pine` is `TreePine`). If a name does not exist in the installed package, substitute the nearest icon and change that key in `shared/avatars.ts` and its test in the same commit.
- Produces `UserAvatar.vue` props: `name: string`, `icon?: string | null`, `color?: string | null`, `class?: string` (merged with `cn`, so callers pass the size classes the account menu uses today: `size-8` header, `size-9` collapsed, `size-11` sidebar, `size-12` menu header, and `size-8` in lists; the default is `size-8`). Renders the icon (`size-[55%]`, `aria-hidden`) coloured `var(--avatar-<color>)` on a wash `color-mix(in srgb, var(--avatar-<color>) 15%, transparent)`, via inline style; when icon or color is null or not in the lists, renders the existing `Avatar`/`AvatarFallback` with the initials of `name`. Decorative by default (the name is shown next to it everywhere it is used); no `aria-label` on the wrapper.

- [ ] **Step 1: Write the failing tests:**
  - `avatarIcons.test.ts`: the map's keys equal `AVATAR_ICONS` exactly (both directions), and every value is defined.
  - `UserAvatar.test.ts` (`// @vitest-environment happy-dom`): with `icon:'cat', color:'blue'` it renders an `svg` and the element's inline style references `--avatar-blue`, with no initials text; with null icon, null color, one null, an unknown icon `'nope'`, and an unknown colour it renders the initials (`'Ada Lovelace'` gives `AD`); a one-letter name `'x'` gives `X`; an empty name gives a non-empty fallback (use `'?'`); a name starting with an emoji does not throw.
  - `design.test.ts`: every `AVATAR_COLORS` key has `--avatar-<key>` in the light and dark palettes (and True black through inheritance); for each of light, dark and black, the avatar colour against its wash blended over the card **and** over the background is at least 3:1 (non-text graphic); the True black block still overrides only the nine existing surface tokens. Extend the existing "names every token" check by naming each `--avatar-*` token in `DESIGN_SYSTEM.md` (a short table row per token group is enough).
- [ ] **Step 2: Run to verify they fail** (`npx vitest run src/components/avatar src/styles`).
- [ ] **Step 3: Implement** the tokens, the map and the component. Reuse `over()` and `ratio()` helpers already in `design.test.ts`.
- [ ] **Step 4: Run to verify they pass**, then `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(avatar): add the avatar swatch tokens, icon map and UserAvatar`.

---

### Task 5: Session store and showing avatars everywhere

**Files:**
- Modify: `src/stores/session.ts`, `src/components/layout/AccountMenu.vue`, `src/views/orgs/OrgModifyView.vue` (member rows and `OrgMember`), `src/views/admin/AdminUsersView.vue` (`AdminUser` and the name cell)
- Test: `src/stores/session.test.ts` (or the existing store test), `src/components/layout/AccountMenu.test.ts` (or the existing one), the existing `OrgModifyView.test.ts` and `adminViews.test.ts`

**Interfaces:**
- Consumes: `UserAvatar` (Task 4), `isAvatarIcon`/`isAvatarColor` from `@shared/avatars`.
- Produces: `SessionUser` gains `avatarIcon: AvatarIcon | null` and `avatarColor: AvatarColor | null`; `asUser` sets both only when **both** are valid keys, otherwise both null; the store exposes `setAvatar(icon: AvatarIcon | null, color: AvatarColor | null): void` that updates the current user in place. `OrgMember` gains `avatar_icon?: string | null`, `avatar_color?: string | null`; `AdminUser` gains `avatarIcon`, `avatarColor` (both `string | null`).

- [ ] **Step 1: Write the failing tests:** `/api/me` with valid keys populates the session user; with an unknown icon (`'nope'`) or only one field populates both as null; `setAvatar` updates the user and `setAvatar(null, null)` clears it; `AccountMenu` renders the chosen icon in the trigger and in the menu header (the same `UserAvatar`) and falls back to initials otherwise; the member row and the admin user row render a `UserAvatar` before the name (an icon when set, initials otherwise) without changing the row text content the existing tests assert.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement:** replace both `Avatar`/`AvatarFallback` blocks in `AccountMenu.vue` with `UserAvatar` passing `displayName`, keeping the size classes; add `UserAvatar` (`class="size-8"`) to the member name cell and the admin name cell with the person's name; remove the now-unused `initials` computed and imports in `AccountMenu.vue`.
- [ ] **Step 4: Run to verify they pass**; run `npx vitest run src` and `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(avatar): show the chosen avatar in the menu, member list and admin users`.

---

### Task 6: `AvatarPicker` dialog

**Files:**
- Create: `src/components/avatar/AvatarPicker.vue`, `src/components/avatar/AvatarPicker.test.ts`
- Modify: `src/components/layout/AccountMenu.vue` (menu item and dialog mount), `src/components/layout/AccountMenu.theme.test.ts` is untouched; add `src/components/layout/AccountMenu.avatar.test.ts`

**Interfaces:**
- Consumes: `Dialog*` from `@/components/ui/dialog`, `UserAvatar`, `AVATAR_ICONS`, `AVATAR_COLORS`, `AVATAR_ICON_COMPONENTS`, `useSession().setAvatar`, `api.patch`, `useToast`.
- Produces: `AvatarPicker.vue` props `open: boolean` (with `update:open` emit). Behaviour: starts from the signed-in user's current icon and colour; a grid of icon buttons (`role="radio"` in a `radiogroup` labelled "Icon") and a row of swatch buttons (`radiogroup` labelled "Colour"), each with an `aria-label` (icon label is the key with hyphens as spaces, colour label is the key) and the visible focus ring, 44px minimum, the selected one marked with a check or ring, not colour alone; a live `UserAvatar` preview (initials until both are chosen); **Save** is disabled until both an icon and a colour are chosen, calls `api.patch('/api/account/avatar', { icon, color })`, on success calls `setAvatar`, closes, and shows a success toast ("Avatar updated"); on failure keeps the dialog open, keeps the previous avatar, and shows an error toast ("Could not save your avatar. Try again."); **Reset** calls the same route with both null, then `setAvatar(null, null)` and closes with the toast "Avatar reset". Escape closes without saving. `AccountMenu.vue` gains a "Change avatar" `DropdownMenuItem` (before the Appearance items) whose `@select` opens the dialog; the dialog's `update:open(false)` returns focus to the menu trigger.

- [ ] **Step 1: Write the failing tests** (`// @vitest-environment happy-dom`, mock `@/lib/api`): preview and Save disabled until both chosen; choosing an icon and colour enables Save and updates the preview; Save sends exactly `{ icon, color }`, then the session user is updated and the dialog emits `update:open` false; a rejected `api.patch` keeps `open`, leaves the session avatar unchanged and raises an error toast; Reset sends `{ icon: null, color: null }`; every icon and swatch button has an accessible name and exactly one of each group has `aria-checked="true"`; Escape closes without calling the API; the menu item "Change avatar" exists and opens the dialog.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement** the component and the menu item. Roving keyboard use matches `ThemeToggle.vue` (arrow keys move the selection inside a group; ignore Alt/Ctrl/Meta).
- [ ] **Step 4: Run to verify they pass**; run `npx vitest run src` and `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(avatar): add the avatar picker dialog to the account menu`.

---

### Task 7: Docs and verification

**Files:**
- Modify: `docs/db/schema-baseline.md`, `DESIGN_SYSTEM.md`, `CONTEXT.md` (add "Avatar" vocabulary in the existing style), `AGENTS.md` (index row for this plan)
- Create: `docs/owner-guide-avatar-picker.md`

- [ ] **Step 1: Write the failing check:** extend the `DESIGN_SYSTEM.md` test in `src/styles/design.test.ts` to assert the doc contains the strings `Avatar`, `UserAvatar` and `AvatarPicker`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Write the docs:** schema-baseline notes the two columns on `users`; `DESIGN_SYSTEM.md` gets an Avatars section (36 icons grouped as in the spec, the 12 swatches, the 15% wash, the three sizes, the picker and its accessibility rules); `docs/owner-guide-avatar-picker.md` says, in this order: (1) apply `backend/migrations/0013_user_avatar.sql` to the production Turso database, (2) then deploy the backend and frontend, and why the order matters (queries select the new columns); `AGENTS.md` gains a row for this plan next to the avatar spec row.
- [ ] **Step 4: Run to verify it passes**, then the full gate: `npm run typecheck` and `npm test`.
- [ ] **Step 5: Browser check (controller, not an implementer):** run `npm run dev:local` against a read-only token if the migration is not applied, otherwise check with a seeded local database; open the picker, choose each of two icons and two colours in Light, Dark and True black at desktop and phone width; confirm focus returns to the menu and the avatar updates everywhere without a reload. If the migration cannot be applied locally, record that the picker was verified against mocked API responses only and ask the owner to check after applying `0013`.
- [ ] **Step 6: Commit** `docs(avatar): document the avatar picker and its rollout`.
