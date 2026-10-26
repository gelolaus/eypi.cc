# Mobile-First UX Overhaul Implementation Plan

> **For agentic workers:** Run with `superpowers:subagent-driven-development`: one fresh implementer per task, one task review, one final whole-branch review. Tick checkboxes and commit the ticked plan with the task.

**Goal:** Rebuild eypi.cc's UI as strictly mobile-first, applying the UX practices of wantap.cc (`C:\Users\gelo\Documents\GitHub\wantap.cc`): app shell with bottom tab bar on phones and sidebar at `lg`, 44px touch targets, 16px inputs, soft rounded sections, bottom-sheet overlays, card lists instead of horizontal tables, `dvh` + safe-area handling, skeleton fallbacks, restrained motion.

**Architecture:** Vue 3 SPA only (`src/`). No backend, worker, `shared/`, router path or `meta` changes. Work directly on `main` (owner-approved).

**Tech Stack:** Vue 3.5, Vue Router 4, Tailwind 3, Vitest (+ happy-dom, @vue/test-utils).

## Reference: wantap.cc playbook (what "same UX" means)

- Shell: `h-dvh flex-col lg:flex-row`; content pane scrolls (`min-h-0 flex-1 overflow-y-auto`). Below `lg`: sticky top bar `h-14` (never hides on scroll) + fixed bottom tab bar (`grid h-[4.5rem]`, 4 tabs, icon `size-5` over `text-[11px]` label, `pb-[env(safe-area-inset-bottom)]`, `aria-label="Primary"`, active = primary color). Content gets `pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0`. At `lg+`: sticky sidebar `w-56`, items `rounded-xl px-3 py-2.5`, active `bg-primary/15`.
- Controls: default control height 44px (`h-11`), large `h-12`, small `h-9` only for dense secondary use; icon buttons `size-11`; inputs `h-11 text-base` (16px, avoids iOS zoom) with `aria-invalid` styling; buttons `rounded-xl`, `active:translate-y-px`, 3px focus ring.
- Surfaces: page sections `rounded-3xl border bg-card/70 p-6 sm:p-7`; page padding `px-4 sm:px-6`, `py-6 sm:py-8`, `max-w-6xl`; page intro = title (`text-3xl sm:text-4xl font-semibold tracking-tight`) + one short line.
- Dialogs: full-width minus 1rem on mobile, footer stacks `flex-col-reverse` so the primary action is at the bottom; here dialogs and slide panels become bottom sheets below `sm`.
- Lists: card list on mobile, table only from `md+`.
- Loading: skeleton blocks matching the final layout shape (`animate-pulse rounded-3xl bg-muted`), not spinners.
- Motion: restrained; one 280ms fade/slide-in; everything non-essential wrapped for `prefers-reduced-motion`.
- A11y: `sr-only` labels on icon-only items, `aria-current="page"` on active nav, 3px visible focus ring.

## Brand rulings (binding)

- **Keep** APC Blue `#34418F` / APC Gold `#DEAC4B`, Geist / Geist Mono self-hosted, and the copy rules in `DESIGN_SYSTEM.md` §2. wantap's coral/Syne/Plus Jakarta are its brand, not its UX practice.
- `contrast.test.ts` pins token blocks in `main.css` (`:root`, `html.dark`, `.btn-gold`, `:focus-visible`); do not rename or restructure them.
- `removedChrome.test.ts`, `a11ySurfaces.test.ts`, `selfHostedFonts.test.ts`, `dialogEsc.test.ts`, `HeroSection.test.ts`, `TheFooter.test.ts` pin markup; keep their contracts or update the test in the same commit with a stated reason.
- DESIGN_SYSTEM.md sections that the redesign contradicts (pill nav hides on scroll §1/§6, breakpoints §5, modals/toasts/scroll-top/footer §6, z-index §9) must be amended in the same commit as the code.

## Global Constraints

- Mobile-first CSS: base styles target a 360px phone; `sm`/`md`/`lg` only add. No `max-width` media queries for layout. No horizontal page scroll at 360px.
- Every interactive element is at least 44x44 CSS px on touch (visually smaller glyphs are fine if the hit area is 44px). Inputs/selects/textareas use `text-base` (16px).
- Use `dvh`, never bare `100vh`, for full-height surfaces. Fixed bottom elements add `env(safe-area-inset-bottom)`.
- No hover-only affordances for actions; hover styles live behind `(hover: hover) and (pointer: fine)`.
- Do not change route paths, `meta`, API calls, stores, or composables' public behavior. Do not touch `backend/`, `worker/`, `shared/`.
- Copy: follow `DESIGN_SYSTEM.md` §2 (no em dashes, no filler, sentence case, next-action errors).
- Never log or commit secrets. Never deploy.
- **Commits:** Conventional Commits, owner's style: `type(scope): lowercase imperative subject` (<= ~72 chars, no period), blank line, `- lowercase verb` bullets. Scopes: `ui`, `nav`, `links`, `tix`, `dp`, `forms`, `orgs`, `admin`, `landing`, `auth`, `account`, `design-system`, `docs`. **No `Co-Authored-By`, `Signed-off-by`, "Generated with", or any AI/tool trailer.** One commit per task (more is fine), each green.
- Definition of done per task: new/changed tests written first and passing; `npm run typecheck` and `npm test` pass; plan checkboxes ticked and committed with the work.

## Review Focus

1. Pinned a11y/markup tests still hold, or were updated with justification.
2. No 360px horizontal overflow; touch targets >= 44px; inputs 16px.
3. Behavior unchanged (same events, routes, store calls).
4. Dark mode and `prefers-reduced-motion` still correct; contrast tokens untouched.

---

### Task 1: Foundation tokens, primitives, design-system doc

**Files:** `src/styles/main.css`, `tailwind.config.js`, new `src/components/AppPage.vue`, `src/components/AppSection.vue`, `src/components/PageSkeleton.vue` (+ tests), `DESIGN_SYSTEM.md`.

- [x] Write tests for `AppPage` (renders `h1` title, optional one-line description slot/prop, `px-4 sm:px-6 py-6 sm:py-8 max-w-6xl` container), `AppSection` (`rounded-3xl border p-6 sm:p-7`, optional heading level), `PageSkeleton` (aria-busy, layout-shaped blocks, `animate-pulse` gated for reduced motion).
- [x] Add to `main.css` (outside the contrast-pinned blocks): shared control classes `.control` (min-h 44px, `rounded-xl`, 16px text, focus ring, `[aria-invalid=true]` state), `.btn-primary/.btn-secondary/.btn-ghost/.btn-danger` sizes (default 44px, `.btn-lg` 48px, `.btn-sm` 36px), `.section-card`, `.safe-bottom` (`padding-bottom: env(safe-area-inset-bottom)`), `.h-screen-dvh`, `.scrollbar-none`, and a `@media (prefers-reduced-motion: reduce)` block disabling `.reveal`, transitions and pulse. Replace `background-attachment: fixed` on `.bg-dot-grid` with a `position: fixed` pseudo layer or `@media (hover: hover)` gating so iOS Safari does not jank. Keep `.btn-gold` and token blocks byte-compatible with `contrast.test.ts`.
- [x] Create the three primitives.
- [x] Amend `DESIGN_SYSTEM.md`: add a "Mobile-first layout" section (shell, tab bar, control sizes, section cards, bottom sheets, skeletons, safe areas, dvh), update §5 breakpoints (`lg` shell split), and note wantap.cc as the UX reference. Re-run `contrast.test.ts` (it reads the doc).
- [x] `npm run typecheck && npm test`; commit `feat(design-system): add mobile-first tokens and page primitives`.

### Task 2: App shell and navigation

**Files:** `src/App.vue`, `src/components/TheHeader.vue`, `NavSidebar.vue`, `OrgSwitcher.vue`, `LocalDevBanner.vue`, `ScrollTop.vue`, new `src/components/AppShell.vue`, `BottomTabBar.vue`, `SideRail.vue`, `src/config/nav.ts` (+ tests), `main.css` (remove dead `.pill-nav__link/__cta/__user-btn/__dropdown*`), `DESIGN_SYSTEM.md` §1/§6/§9.

- [x] Tests first: `nav.ts` item list per auth state (public: Orgs, Log in, Sign up; authed: Dashboard, Links, Tix, Frames/Forms/Orgs/Invites/Account, Admin for admins) with active matching (home exact, others prefix); `BottomTabBar` renders `nav[aria-label="Primary"]`, 4 tabs + "More", `aria-current="page"` on active, each target >= 44px (`h-[4.5rem]` grid), safe-area class; "More" opens the existing drawer (`NavSidebar`, keep `role="dialog"`/`aria-modal`/focus trap/`#site-nav-sidebar` contract from `a11ySurfaces.test.ts`); invite badge still shows (`inviteBadge.test.ts`).
- [x] Header: sticky `h-14` top bar (logo, org switcher, theme toggle `aria-label="Toggle dark mode"` with `aria-pressed`, invite badge on More); it no longer hides on scroll. Floating pill is removed on mobile and at `lg`; update `DESIGN_SYSTEM.md` accordingly.
- [x] Shell: authed routes get `h-dvh flex-col lg:flex-row`, `SideRail` (`hidden lg:flex w-56`, items `rounded-xl px-3 py-2.5`, active `bg-primary/15`) and `BottomTabBar` (`lg:hidden`); content pane `min-h-0 flex-1 overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0`. Public routes: top bar only, normal document scroll. Remove the fixed `pt-20` offset; account for `LocalDevBanner` without magic constants. Drawer close button 44px; drawer items visible immediately (drop opacity-0 stagger gating), `max-h-dvh`.
- [x] `ScrollTop` clears the tab bar and safe area; keep `removedChrome.test.ts` contract (App.vue must not contain removed names).
- [x] Verify all existing tests; commit `feat(nav): add mobile tab bar, sidebar rail and persistent top bar`.

### Task 3: Overlays (toast, dialog, slide panels)

**Files:** `ToastContainer.vue`, `DialogHost.vue`, `LinkEditorPanel.vue`, `AnalyticsPanel.vue`, `src/components/dp/*` panels, slide-over CSS in `main.css`, `DESIGN_SYSTEM.md` §6.

- [x] Tests first: DialogHost renders as bottom sheet below `sm` (`items-end sm:items-center`, `rounded-t-3xl sm:rounded-3xl`, `max-h-[90dvh] overflow-y-auto`, safe-area padding, footer `flex-col-reverse sm:flex-row`, inputs `h-11 text-base`); Esc/backdrop/focus-trap behavior unchanged (`dialogEsc.test.ts`, `useFocusTrap.test.ts`); Toast container sits `inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:inset-x-auto lg:right-6 lg:bottom-6`, dismiss button 44px, pause on touch/focus as well as mouse.
- [x] Slide panels: full-width bottom/side sheets using `dvh`, `p-5 sm:p-8`, sticky action footer with safe-area padding; keep `LinkEditorPanel` tests green.
- [x] Commit `feat(ui): turn dialogs and panels into bottom sheets and fix toast placement`.

### Task 4: Links module

**Files:** `src/views/Links*View.vue`, `src/components/links/*` (`LinkList`, `LinkRow`, `LinkFilters`, editor form fields), `useLinks` unchanged.

- [x] Tests first (`LinksView.test.ts`, `useLinks.test.ts` stay green): at mobile, each link renders as a card (slug in Geist Mono, destination truncated, status badges, 44px action buttons, 44px selection checkbox hit area); table layout only from `md+` with no `min-w-[640px]`.
- [x] Filters collapse into a sheet or wrapped chips; search input `h-11`; bulk-action bar sticks above the tab bar.
- [x] Use `AppPage`/`AppSection`/`PageSkeleton`; commit `feat(links): show links as mobile cards with 44px actions`.

### Task 5: Tix, Forms, Frames, Orgs modules

**Files:** `src/views/EventsView.vue`, `EventDetailView`, `NewEventView`, `TicketLookupView`, `src/components/tix/*` (`AttendeeTable`, `ConfirmStep`, `ScannerPanel`, `AddGuestPanel`), `src/components/dp/*`, `DpPublicView`, `Dp*View`, `Forms*`/`LetterOfIntentView`/`VisitorsPassView`, `Org*View`, `src/components/orgs/*`, `OrgSwitcher.vue`.

- [x] Tests first for the shared pieces (`DpPublicView.test.ts`, `DpFrameUploader.test.ts`, `OrgModifyView.test.ts`, `VisitorsPassView.test.ts`, `useQrScanner.test.ts` stay green): attendee/event/org tables become card lists below `md`; remove `min-w-[520px|640px|480px]` wrappers; steppers/remove buttons/toggles >= 44px; `text-[0.6rem]` controls removed; scanner is full-bleed with a bottom action bar; org dropdown becomes a sheet on mobile (no left clipping).
- [x] Adopt `AppPage`/`AppSection`/skeletons across these views.
- [x] Commit per module if large (`feat(tix)`, `feat(dp)`, `feat(forms)`, `feat(orgs)`).

### Task 6: Admin

**Files:** `src/views/Admin*View.vue`, `AdminLayout`.

- [x] Tests first (`adminViews.test.ts` stays green): users/links/audit/reports render as cards below `md` (remove `min-w-[820px|860px]`); admin tab nav scrolls horizontally with snap, tabs `min-h-11`; row actions >= 44px.
- [x] Commit `feat(admin): show admin tables as cards on mobile`.

### Task 7: Landing and footer

**Files:** `HeroSection.vue`, `FeaturesCarousel.vue`, `StatsStrip.vue`, `WhyEypi.vue`, `ClosingCta.vue`, `TheFooter.vue`, `HomeView.vue`.

- [x] Tests first (`HeroSection.test.ts`, `TheFooter.test.ts`, `a11ySurfaces.test.ts` stay green or are updated with reason): one composition per viewport: one headline, one support line, one primary CTA (`h-12`/`h-14`); drop bouncing scroll cue and per-badge blur; carousel becomes native scroll-snap on mobile (keeps pause/play button, `article` slides, `inert` on hidden ones); footer heading `clamp` reduced, link rows 44px+, `.footer-arrow` stays `aria-hidden` `↗`.
- [x] Commit `feat(landing): simplify the hero and make the footer mobile-first`.

### Task 8: Auth, account, dashboard and static pages

**Files:** `LoginView`, `UnlockView`, `ExpiredView`, `ReportView`, `ConsentView`, `ContactView`, `LegalView`, `LegalLayout`, `NotFoundView`, `RedirectView`, `DashboardView`, `AccountView`, `InvitesView`, `OrgLockout`.

- [x] Tests first (existing `*View.test.ts` stay green; `ContactView` heading levels stay `H1,H2,H2,H2`): single-column forms with `h-11 text-base` fields and full-width `h-12` primary buttons, inline errors with `aria-invalid`; dashboard module cards form a 1-col/2-col/3-col grid with 44px+ tap area; account sections use `AppSection` with stacked fields; auth pages avoid `min-h-screen` (use `min-h-dvh`).
- [x] Commit `feat(auth): rebuild sign-in and account pages for mobile` and `feat(dashboard): rebuild dashboard and static pages for mobile`.

### Task 9: Hygiene and verification

**Files:** all `src/**`, `main.css`, `DESIGN_SYSTEM.md`.

- [ ] Remove leftover `data-cursor` attributes, dead pill-nav CSS, and bare `100vh`/`min-h-screen` uses; add a regression test grepping `src` for `min-w-\[\d{3}px\]` table wrappers, `100vh`, and sub-44px `h-6 w-6`/`h-9 w-9` on buttons.
- [ ] `npm run typecheck`, `npm test`, `npm run build` all green; start `npm run dev:local` and capture 360x800 and 1280x800 screenshots of home, login, dashboard, links, tix for the final review (no production writes).
- [ ] Commit `chore(ui): remove dead cursor attributes and guard mobile regressions`.
