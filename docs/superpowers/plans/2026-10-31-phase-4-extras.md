# Phase 4: Extras, hardening and final verification

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Small additions that make the new nav and dashboard feel finished: a first-run checklist, copy-link on top links, accessibility and touch-target guards, and a final whole-branch verification.

**Architecture:** Each extra is a self-contained component or test file layered on Phases 1 to 3. Nothing here changes an API.

**Tech Stack:** Vue 3, TypeScript, Vitest with happy-dom.

**Spec:** `docs/superpowers/specs/2026-10-31-nav-groups-dashboard-design.md`
**Needs first:** Phases 1, 2 and 3 merged.

## Global Constraints

- Tokens only; no `dark:` utilities, no mica, no Geist. Touch targets at least 44px. UI copy per `DESIGN_SYSTEM.md` section 13.
- No new dependency, no backend change, no migration. Nothing is stored on the server.
- `localStorage` and `sessionStorage` access is wrapped in try/catch and the UI renders correctly without it.
- Commits: Conventional Commits, `type(scope): lowercase imperative subject`, blank line, `- bullet` lines starting with a lowercase verb. No `Co-Authored-By`, `Signed-off-by` or any AI/tool trailer. One commit per task, each green. Tick this task's boxes in this file and include the file in that commit.
- A task is done when its tests pass and `npm run typecheck` passes.

## Review Focus

1. A user who finished every checklist step, or dismissed it, never sees it again, even after a reload with storage unavailable (it must fail closed to hidden only when dismissed, and visible-but-harmless otherwise) (Task 1).
2. Copy-link on a device without the Clipboard API shows an error toast and does not throw (Task 2).
3. Every interactive element in the rail, tab bar, profile sheet and dashboard has an accessible name and a 44px target at 360px width (Task 3).
4. A member who is removed from their last org while the dashboard is open loses the Orgs section on the next org fetch without a reload (Task 3).

## File Structure

```
src/components/dashboard/GetStarted.vue        first-run checklist
src/composables/useGetStarted.ts               step state + dismissal
src/components/dashboard/TopLinks.vue          + copy button
src/components/dashboard/dashboardA11y.test.ts guard tests for the new surfaces
```

---

### Task 1: First-run checklist

**Files:** Create `src/composables/useGetStarted.ts`, `src/components/dashboard/GetStarted.vue` and tests; modify `src/views/DashboardView.vue` and `DashboardView.test.ts`; modify `src/views/wallpaper/WallpaperView.vue` (or the download handler it uses) to call `markWallpaperMade()`.

**Produces:**
```ts
export type GetStartedStep = { id: 'link' | 'wallpaper' | 'invites'; label: string; to: string; done: boolean }
export function useGetStarted(inputs: { linkCount: Ref<number | null>; pendingInvites: Ref<number> }): {
  steps: ComputedRef<GetStartedStep[]>
  visible: ComputedRef<boolean>      // false once dismissed or all steps done
  dismiss: () => void
}
export function markWallpaperMade(): void   // sets localStorage['eypi.wallpaperMade'] = '1'
```
Steps: "Create your first link" → `/links`, done when `linkCount > 0`; "Make a wallpaper from your schedule" → `/wallpaper`, done when the flag is set; "Check your invites" → `/invites`, done when `pendingInvites === 0` **and** the user has opened `/invites` once (flag `eypi.invitesSeen`, set by `InvitesView` on mount).

- [x] **Step 1: Write failing tests**: all three steps pending for a new user; `linkCount` null (still loading) hides the checklist; completing a step flips only that step; all done hides it; `dismiss()` writes `eypi.getStartedDismissed` and hides it; throwing storage keeps it visible and does not throw (Review Focus 1); the component renders a progress text "1 of 3 done", each step as a link with a check icon (`aria-hidden`) and a visually hidden "done"/"to do" word, and a Dismiss button of at least 44px.
- [x] **Step 2:** Run `npx vitest run src/composables/useGetStarted.test.ts src/components/dashboard/GetStarted.test.ts`. Expect FAIL.
- [x] **Step 3: Implement.** Render it at the top of the Rams section only (above the KPIs), only for users who have fewer than 3 links so established users never see it.
- [x] **Step 4:** Add the dashboard test (visible for a new user, hidden once dismissed) and run `npx vitest run src/views/DashboardView.test.ts`. Expect PASS.
- [x] **Step 5: Commit** `feat(dashboard): add a first-run checklist for new students`

### Task 2: Copy short link on top links

**Files:** Modify `src/components/dashboard/TopLinks.vue` and its test.

**Consumes:** the existing copy helper used by `LinkRow.vue` (grep `clipboard` in `src/components/links/`); reuse it, do not write a second one.

- [ ] **Step 1: Write failing tests**: each row has a button with `aria-label="Copy eypi.cc/{slug}"` and at least 44px; clicking calls the clipboard helper with `https://eypi.cc/{slug}` and shows the success toast; when the helper rejects (Review Focus 2) an error toast shows and nothing throws.
- [ ] **Step 2:** Run it. Expect FAIL.
- [ ] **Step 3: Implement** the button inside each `BarList` row via the component's slot if it has one, otherwise render the list rows in `TopLinks` itself using the same bar markup (do not modify `BarList` for one caller).
- [ ] **Step 4:** Run it. Expect PASS.
- [ ] **Step 5: Commit** `feat(dashboard): add a copy button to top links`

### Task 3: Accessibility and size guards for the new surfaces

**Files:** Create `src/components/dashboard/dashboardA11y.test.ts`; extend `src/components/a11ySurfaces.test.ts` if it already enumerates shell surfaces (read it first and follow its style).

- [ ] **Step 1: Write the tests** (they should pass if Phases 1 to 3 followed the plan; any failure is a defect to fix in the owning component):
  - mount `AppShell` as a member and as a non-member: every `<a>` and `<button>` in the rail, tab bar and open profile sheet has non-empty accessible text (text content or `aria-label`), and the tab bar links carry `min-h` classes giving at least 44px (class-based assertion, as other tests in this repo do).
  - mount `DashboardView`: exactly one `<h1>`; the two `section` landmarks are labelled by their headings; each chart has an `aria-label` or an associated hidden table; no element uses a `dark:` utility class (the repo's `design.test.ts` already guards this repo-wide, so only assert here that it still passes).
  - removing the last org (set `orgs.value = []`, `orgsLoaded` true) removes the Orgs rail section and the dashboard Orgs section after `flushPromises` (Review Focus 4).
- [ ] **Step 2:** Run `npx vitest run src/components/dashboard/dashboardA11y.test.ts`. Fix any real defect it finds in the owning component, then re-run until PASS.
- [ ] **Step 3: Commit** `test(nav): guard names, targets and gating on the new surfaces`

### Task 4: Whole-branch verification and handoff notes

**Files:** Modify `CONTEXT.md` and `DESIGN_SYSTEM.md` only where the earlier phases left them stale; modify `docs/superpowers/plans/2026-10-31-phase-4-extras.md` (tick boxes).

- [ ] **Step 1:** Run `npm test`, `npm run typecheck`, `npm run build`, `npm run release:check` (if present in `package.json`). All must pass; paste any failure output into your report instead of working around it.
- [ ] **Step 2:** Manual pass with `npm run dev:local`, signed in with a non-member account and a member account (ask the owner for credentials; never invent or store them): desktop at 1280px and phone at 360px. Check the list below and report each line as pass or fail with a one-line note:
  - non-member sees no Tix, Frames, Forms or My org anywhere (rail, tabs, profile sheet, palette with Ctrl+K, dashboard cards);
  - member sees all four in the rail, the profile sheet, the palette and the dashboard Orgs section;
  - tab bar shows Dashboard, Links, My tickets, Wallpaper, Invites with working badges and no wrapped labels;
  - profile sheet matches the org sheet in width and form and closes with Escape, backdrop and swipe-free tap;
  - `/orgs/modify/...` highlights only My org;
  - dashboard period picker changes every Rams chart, Orgs section follows the same period;
  - light, dark and true black themes render charts legibly.
- [ ] **Step 3:** Update the docs that are stale, tick the boxes, and run `npm test` once more.
- [ ] **Step 4: Commit** `docs(dashboard): record the finished nav and dashboard round`
