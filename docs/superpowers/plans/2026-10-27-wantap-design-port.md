# Wantap Design Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove eypi.cc's current visual design (APC blue/gold, Geist, mica glass, pill nav, light default) and replace it with the wantap.cc design language, applied to every screen, with no behaviour changes.

**Architecture:** Upgrade Tailwind v3 to v4 so wantap's token system (`@theme inline`, oklch variables, `ring-3`, `size-*`, `gap-(--card-spacing)`) is copied verbatim. Port wantap's shadcn `radix-nova` primitives to Vue (`src/components/ui/*`) on `reka-ui` with `class-variance-authority` and `tailwind-merge`, keeping wantap's exact class strings. Rebuild the shell (sidebar, mobile top bar, bottom tabs, marketing header, footer) to wantap's layout, then restyle every view onto the primitives. Old styles are quarantined in `src/styles/legacy.css` so each task leaves the app green, and a final guard test forbids any legacy token.

**Tech Stack:** Vue 3, Vite 6, Tailwind v4 (`tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`), `reka-ui`, `vue-sonner`, `lucide-vue-next`, `class-variance-authority`, `clsx`, `tailwind-merge`, Vitest + `@vue/test-utils`.

**Spec:** There is no separate spec. The authority is the wantap.cc repo, read-only, at `C:\Users\gelo\Documents\GitHub\wantap.cc`: `src/app/globals.css`, `src/app/layout.tsx`, `components.json`, `src/components/ui/*`, `src/components/layout/*`, `src/components/marketing/*`, `src/components/brand/wantap-logo.tsx`, and `docs/superpowers/{specs,plans}/2026-07-3*-*` (visual-atmosphere, app-wide-visual-system, dashboard-app-shell, landing-page-redesign, friendly-ui-redesign, logo-branding). Where this plan and wantap's source disagree on a class string or token, **wantap's source wins**. The design contract below is distilled from it. Also read `AGENTS.md`, `CONTEXT.md` and `docs/superpowers/specs/2026-10-25-eypi-overhaul-design.md` in this repo.

## Global Constraints

- **Dark only.** `<html class="dark">` always; no light theme, no toggle, no `localStorage` theme key. `:root` light tokens are not shipped.
- **Palette = wantap's "warm ink + coral".** Background `oklch(0.14 0.01 55)`, foreground `oklch(0.96 0.01 75)`, primary `#e8a87c`, primary-foreground `oklch(0.18 0.02 55)`. The APC blue `#34418F` and gold `#DEAC4B` are removed from the UI entirely. No third accent colour.
- **Radius base `--radius: 0.875rem`.** Controls and cards are `rounded-xl`; `sm`/`xs` controls are `rounded-lg`.
- **Control scale:** default control height `h-11`, text `text-base`; `lg` is `h-12`; `sm` is `h-9`; `xs` is `h-8`. Never ship a tappable target smaller than `size-8`, and primary mobile actions are at least `h-11`.
- **Focus:** ring-based, `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`. The old global `:focus-visible` outline is deleted. Every interactive element, including raw `<a>` and `<button>`, shows a visible ring.
- **Fonts, self-hosted woff2 only (CSP `font-src 'self'`):** Plus Jakarta Sans (`--font-sans`), JetBrains Mono (`--font-mono`), Syne (`--font-heading`, used for `h1`-`h3` and `.font-display`). Source Serif 4 is **not** ported (wantap uses it only for public card themes, which eypi lacks).
- **Surfaces:** cards are `bg-card ring-1 ring-foreground/10 rounded-xl`; borders are `border-border` (white at 10%); inputs use `border-input` (white at 12%) with `dark:bg-input/30`. No `backdrop-blur` except `glass-panel`, sticky headers (`backdrop-blur-md`) and the bottom nav.
- **Icons:** `lucide-vue-next`, `size-4` inside controls, `size-5` in nav. No icon fonts or emoji as UI icons.
- **Toasts:** `vue-sonner`, `richColors`, `position="top-center"`.
- **Motion:** only wantap's keyframes (`float-slow`, `float-slow-2`, `sparkle-pulse`, `blink-caret`, `marketing-block-in`) plus `tw-animate-css` for overlays, and every decorative animation is disabled under `prefers-reduced-motion: reduce`. Buttons use `active:translate-y-px`.
- **No behaviour changes.** Routes, stores, API calls, copy meaning, and test intent are unchanged. UI copy follows this repo's `DESIGN_SYSTEM.md` §2 writing rules (no em dashes in UI strings), not wantap's copy.
- **CSP stays as is** (`script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `font-src 'self'`). No inline scripts, no CDN fonts or icons.
- Local dev uses the **production** Turso database: do not run writes, migrations, or deploys. Never deploy, set secrets, or touch Entra/R2/Resend.
- **Commits:** Conventional Commits `type(scope): lowercase imperative subject`, blank line, `- bullet` lines starting with lowercase verbs. One commit per task. **Never add `Co-Authored-By`, `Signed-off-by`, "Generated with ...", or any AI/tool trailer.**
- Definition of done per task: tests first and failing, then passing; `npm run typecheck` and `npm test` green; `npm run build` green; plan checkbox ticked in the same commit.

## Design contract (copy exactly)

```css
/* src/styles/tokens.css  (the .dark block is the only palette) */
.dark {
  --background: oklch(0.14 0.01 55);
  --foreground: oklch(0.96 0.01 75);
  --card: oklch(0.18 0.012 55 / 75%);
  --card-foreground: oklch(0.96 0.01 75);
  --popover: oklch(0.17 0.012 55);
  --popover-foreground: oklch(0.96 0.01 75);
  --primary: #e8a87c;
  --primary-foreground: oklch(0.18 0.02 55);
  --secondary: oklch(0.22 0.012 55);
  --secondary-foreground: oklch(0.96 0.01 75);
  --muted: oklch(0.2 0.01 55);
  --muted-foreground: oklch(0.72 0.02 65);
  --accent: color-mix(in oklch, #e8a87c 18%, transparent);
  --accent-foreground: oklch(0.9 0.04 65);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 12%);
  --ring: color-mix(in oklch, #e8a87c 55%, transparent);
  --chart-1: #e8a87c; --chart-2: oklch(0.556 0 0); --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0); --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.15 0.01 55); --sidebar-foreground: oklch(0.96 0.01 75);
  --sidebar-primary: #e8a87c; --sidebar-primary-foreground: oklch(0.18 0.02 55);
  --sidebar-accent: oklch(0.22 0.012 55); --sidebar-accent-foreground: oklch(0.96 0.01 75);
  --sidebar-border: oklch(1 0 0 / 10%); --sidebar-ring: color-mix(in oklch, #e8a87c 55%, transparent);
  --radius: 0.875rem;
}
```

Radius scale (`@theme inline`): `sm = radius*0.6`, `md = *0.8`, `lg = *1`, `xl = *1.4`, `2xl = *1.8`, `3xl = *2.2`, `4xl = *2.6`. Base layer: `* { border-border outline-ring/50 }`, `body { bg-background text-foreground }`, `html { font-sans }`, `h1,h2,h3 { font-family: var(--font-heading) }`. Utilities to copy from wantap `globals.css`: `.glass-panel`, `.float-slow`, `.float-slow-2`, `.font-display`, `.marketing-block-enter`, `.scrollbar-none`, `.bg-dot-grid` (24px, 16% foreground dots), `.animate-sparkle`, `.animate-blink-caret` and their keyframes.

Layout rules (from wantap `dashboard-shell.tsx`, `app-section.tsx`, `hero.tsx`):

| Element | Spec |
|---|---|
| App frame | `flex h-dvh flex-col bg-background lg:flex-row` |
| Sidebar (`lg+`) | `sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-background/95 lg:flex`; logo row `h-16 border-b px-4`; nav `p-2 gap-1`; footer `border-t p-3` with account menu |
| Nav item | `flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition`; active `bg-primary/15 text-foreground` with icon `text-primary`; idle `text-muted-foreground hover:bg-muted hover:text-foreground` |
| Mobile top bar (`<lg`) | `sticky top-0 z-40 h-14 border-b border-border bg-background/90 px-4 backdrop-blur-md`, logo left, account menu right |
| Bottom tabs (`<lg`) | `fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md`; grid `h-[4.5rem]`; item `flex-col gap-1 text-[11px] font-medium`, active `text-primary`; main gets `pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0` |
| Marketing hero | `px-5 pb-24 pt-12 sm:px-6 sm:pt-20`; `max-w-5xl` two-column grid `lg:grid-cols-[1.05fr_0.95fr] gap-16 lg:gap-12`; `WantapLogo`-style large brand (`font-display text-5xl sm:text-6xl`), `h1 text-4xl sm:text-5xl font-semibold tracking-tight`, lead `text-lg sm:text-xl text-muted-foreground`, CTA `Button size="lg" h-14 px-6` plus text link |
| Auth screens | centred single `Card`, large primary CTA (`size="lg"`), the Microsoft button full width `h-12` |
| Empty / error states | `bg-dot-grid` full-bleed backdrop, centred icon, `font-display` heading, one primary action |

## Review Focus

Failure modes the spec implies but no feature task would otherwise test, most likely first:

1. **QR codes must stay scannable.** The QR designer preview and exported PNG/SVG must keep dark modules on a light background regardless of the dark UI (a dark-on-dark QR will not scan). Pinned in Task 10.
2. **Narrow screens (375px).** `h-11` controls, tables (links, attendees, admin) and the bottom tabs must not overflow horizontally or hide the primary action. Pinned in Tasks 7 and 10-14.
3. **Focus visibility and keyboard.** Every Dialog, Select, Dropdown and Tab must trap or return focus and close on Esc (existing `dialogEsc.test.ts` stays green); raw links and buttons show the ring. Pinned in Tasks 4, 5 and 15.
4. **Charts and canvases on dark.** Chart.js axes, grid and legends, the DP frame canvas preview, and spreadsheet exports must stay legible and must not inherit UI colours into generated files. Pinned in Tasks 10 and 13.
5. **Reduced motion.** `float-slow`, `sparkle` and `blink-caret` must stop under `prefers-reduced-motion: reduce`. Pinned in Task 1.

---

## File map

| Path | Responsibility |
|---|---|
| `src/styles/main.css` | Tailwind v4 entry: imports, `@theme inline`, base layer, utilities, keyframes |
| `src/styles/tokens.css` | The `.dark` token block above |
| `src/styles/legacy.css` | Quarantined old classes; shrinks every task; deleted in Task 15 |
| `src/assets/fonts/` | `plus-jakarta-sans-latin-wght-normal.woff2`, `jetbrains-mono-latin-wght-normal.woff2`, `syne-latin-wght-normal.woff2`, `ATTRIBUTION.txt` (copied from wantap `src/fonts/`); Geist files removed |
| `src/lib/cn.ts` | `cn(...inputs)` = `twMerge(clsx(inputs))` |
| `src/components/ui/<name>/` | One folder per primitive: `Name.vue` parts + `index.ts` + variants file |
| `src/components/brand/BrandLogo.vue` | Logo lockup (mark + wordmark), sizes `sm`/`md`/`lg` |
| `src/components/layout/AppShell.vue`, `appNav.ts` | Sidebar / top bar / bottom tabs shell and nav model |
| `src/components/layout/AppPage.vue`, `AppSection.vue` | Page and section chrome (replace `PageShell.vue`) |
| `src/components/marketing/*` | Header, hero, sections, footer (replace HeroSection, FeaturesCarousel, StatsStrip, ClosingCta, WhyEypi, TheHeader, TheFooter, NavSidebar) |
| `src/styles/design.test.ts` | Token + contrast + legacy-ban tests (replaces `contrast.test.ts`) |
| `DESIGN_SYSTEM.md` | Rewritten for the wantap language (Task 16) |

## Owner actions (the agent cannot do these)

- **Task 0:** confirm the wantap repo exists at `C:\Users\gelo\Documents\GitHub\wantap.cc` (the agent stops if not).
- **Task 6:** decide whether to keep eypi's current `favicon.svg` mark or supply a new coral-compatible logo (default: keep it, recolour via CSS only if it is a monochrome SVG).
- **Task 17:** review the screenshots the agent produces; merge the PR in GitHub Desktop; deploy with `cd backend; npm run deploy; cd ..; npm run deploy` (no migrations in this work, so no migration step).

---

### Task 0: Preflight

**Files:** none changed.

- [x] **Step 1:** Create branch `feat/wantap-design-port` from `main`. Run `Test-Path C:\Users\gelo\Documents\GitHub\wantap.cc\src\app\globals.css`; if false, stop and ask the owner.
- [x] **Step 2:** Run `npm run typecheck`, `npm test`, `npm run build` on the untouched branch. Record pass/fail counts in `.superpowers/sdd/2026-10-27-wantap-design-port/progress.md` (gitignored). Note the flaky `src/lib/tix/spreadsheet.test.ts` if it fails once.
- [x] **Step 3:** Inventory `src/**/*.vue` for the legacy class families `mica`, `pill-nav`, `g-bg`, `g-surface`, `g-border`, `g-text`, `g-muted`, `g-accent`, `g-primary`, `eypi-gold`, `apc-`, `bg-dot-grid`, `tap-scale`, `data-cursor`, `dark:` slate/gold literals (`grep -rln`), and write the per-file list into the ledger. This list drives Tasks 7-14.

### Task 1: Tailwind v4, tokens, fonts, base layer

**Files:**
- Modify: `package.json`, `vite.config.ts`, `src/styles/main.css`, `index.html`
- Create: `src/styles/tokens.css`, `src/styles/legacy.css`, `src/styles/design.test.ts`
- Delete: `tailwind.config.js`, `postcss.config.js`, `src/styles/contrast.test.ts`, Geist woff2 files
- Copy: the three woff2 files and `ATTRIBUTION.txt` from wantap `src/fonts/` into `src/assets/fonts/`
- Modify: `src/selfHostedFonts.test.ts`

**Interfaces:**
- Produces: CSS variables and Tailwind theme colours `background foreground card popover primary secondary muted accent destructive border input ring sidebar-*`, fonts `font-sans font-mono font-heading font-display`, utilities listed in the contract.

- [x] **Step 1: Write failing tests in `src/styles/design.test.ts`.**
  - `it('defines every wantap token in the dark block')`: read `tokens.css` and assert each variable name and exact value from the contract.
  - `it('meets WCAG AA for text pairs')`: implement `oklchToLuminance` in the test (oklch to linear sRGB) and assert contrast >= 4.5 for foreground/background, muted-foreground/background, primary-foreground/primary, card-foreground/card-over-background, and >= 3 for ring-colour/background.
  - `it('disables decorative animation under reduced motion')`: assert `main.css` contains `@media (prefers-reduced-motion: reduce)` covering `.float-slow`, `.float-slow-2`, `.animate-sparkle`, `.animate-blink-caret`.
  - Update `src/selfHostedFonts.test.ts`: expect the three new woff2 files, `font-display: swap`, no Geist, and no `http` font URLs.
- [x] **Step 2:** Run `npx vitest run src/styles src/selfHostedFonts.test.ts`; expect FAIL.
- [x] **Step 3: Implement.**
  - Install `tailwindcss@^4 @tailwindcss/vite tw-animate-css`; uninstall `autoprefixer postcss` if nothing else uses them. Add `tailwindcss()` to the Vite plugins next to the Cloudflare plugin.
  - `main.css`: `@import "tailwindcss"; @import "tw-animate-css"; @import "./tokens.css"; @import "./legacy.css";`, `@custom-variant dark (&:is(.dark *));`, `@font-face` for the three fonts (`font-weight` ranges: sans `200 800`, mono `100 800`, display `400 800`), the `@theme inline` block mapping tokens exactly as wantap's `globals.css` (colours, `--font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`, `--font-mono`, `--font-heading: "Syne", ui-sans-serif, sans-serif`, radius scale), base layer and utilities from the contract, plus the reduced-motion block.
  - `legacy.css`: move every remaining rule from the old `main.css` there unchanged (including `@apply` lines, rewritten to v4-valid syntax: `@reference "./main.css";` at the top where `@apply` is used). Legacy rules may reference the removed `g-*` colours only through raw `var()` fallbacks defined at the top of `legacy.css` so existing views still render.
  - `index.html`: `<html lang="en" class="dark">`, `<meta name="theme-color" content="#...">` set to the sRGB hex of `oklch(0.14 0.01 55)` (compute it; expected near `#14110e`), remove the Geist preloads and add preloads for the sans and display woff2.
- [x] **Step 4:** Run `npm run typecheck && npm test && npm run build`; expect PASS. Fix v3-to-v4 utility renames only where the build or a test breaks; the full restyle happens later.
- [x] **Step 5: Commit** `feat(design): adopt tailwind v4 with the wantap tokens and fonts`.

### Task 2: Utilities and dependencies

**Files:** Create `src/lib/cn.ts`, `src/lib/cn.test.ts`; modify `package.json`.

**Interfaces:** Produces `cn(...inputs: ClassValue[]): string`.

- [x] **Step 1:** Test: `cn('px-2', false && 'x', 'px-4')` returns `'px-4'`; `cn('p-2', ['m-1'])` returns `'p-2 m-1'`. Run; expect FAIL.
- [x] **Step 2:** Install `clsx tailwind-merge class-variance-authority reka-ui vue-sonner lucide-vue-next`. Implement `cn`.
- [x] **Step 3:** Run the test, `npm run typecheck`; expect PASS. Commit `chore(ui): add the component toolkit and cn helper`.

### Task 3: Primitives A (Button, Input, Textarea, Label, Card, Badge, Separator, Avatar)

**Files:** Create `src/components/ui/{button,input,textarea,label,card,badge,separator,avatar}/` each with the `.vue` part(s), `index.ts`, and a `*.test.ts`.

**Reference (read, then port class strings verbatim):** wantap `src/components/ui/button.tsx`, `input.tsx`, `card.tsx`, `textarea.tsx`, `label.tsx`, `badge.tsx`, `separator.tsx`, `avatar.tsx`.

**Interfaces:**
- `buttonVariants({ variant, size, class })` with variants `default outline secondary ghost destructive link` and sizes `default xs sm lg icon icon-xs icon-sm icon-lg`. `Button.vue` props: `variant`, `size`, `asChild` (via reka-ui `Primitive`), `as`; sets `data-slot="button"`, `data-variant`, `data-size`.
- `Input.vue` uses `v-model` (`modelValue`), sets `data-slot="input"`, `aria-invalid` styling via attribute.
- `Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter` with `size?: 'default' | 'sm'` on `Card`.
- Consumed by every later task.

- [x] **Step 1:** Write tests (Vue Test Utils): Button default renders `h-11 rounded-xl bg-primary` and `data-slot="button"`; `size="lg"` renders `h-12`; `variant="outline"` renders `border-border`; `asChild` renders the child element (an `<a>`) with button classes; disabled has `disabled:opacity-50` and the `disabled` attribute; Input emits `update:modelValue` and renders `h-11 rounded-xl border-input`; `aria-invalid="true"` Input keeps the attribute; Card renders `ring-1 ring-foreground/10 rounded-xl` and `size="sm"` sets `data-size="sm"`; Badge variants render. Run; expect FAIL.
- [x] **Step 2:** Implement the components by translating the React class strings character for character; replace `React.ComponentProps` with Vue props/attrs, `Slot` with reka-ui `Primitive`.
- [x] **Step 3:** Run tests and typecheck; PASS. Commit `feat(ui): port the wantap button, input, card and badge primitives`.

### Task 4: Primitives B (Dialog, DropdownMenu, Select, Tabs, Switch, Tooltip, Slider)

**Files:** Create `src/components/ui/{dialog,dropdown-menu,select,tabs,switch,tooltip,slider}/` with tests. Slider exists because `DpPublicView.vue` uses a range input.

**Reference:** the same-named wantap `ui/*.tsx` files (Radix to reka-ui is a one-to-one API rename: `Dialog.Root` to `DialogRoot`, etc.).

**Interfaces:** shadcn-style exports (`Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose`; `DropdownMenu*`; `Select, SelectTrigger, SelectValue, SelectContent, SelectItem`; `Tabs, TabsList, TabsTrigger, TabsContent`; `Switch`; `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider`; `Slider`), all with `v-model` where the Radix original is controlled.

- [x] **Step 1:** Tests: Dialog opens, traps focus, closes on Esc and on overlay click, returns focus to the trigger (use `attachTo: document.body`); Select trigger is `h-11` and selecting an item updates the model; Tabs trigger is `h-11` and arrow keys move the selection; Switch toggles with Space; Tooltip content appears on focus; DropdownMenu opens on click and closes on Esc; Slider emits on arrow keys. Run; FAIL.
- [x] **Step 2:** Implement with wantap's overlay/content class strings (popover surface `bg-popover text-popover-foreground ring-1 ring-foreground/10 rounded-xl`, overlay as in wantap `dialog.tsx`).
- [x] **Step 3:** Run; PASS. Commit `feat(ui): port the wantap dialog, menu, select, tabs, switch, tooltip and slider`.

### Task 5: Toasts and DialogHost

**Files:** Modify `src/components/ToastContainer.vue`, `src/components/DialogHost.vue`, `src/App.vue` (or the root), their stores' tests untouched; create `src/components/ui/sonner/Toaster.vue`.

- [x] **Step 1:** Add a test: after the existing toast store pushes a success toast, the `Toaster` text appears; `richColors` and `position="top-center"` props are set. Keep `dialogEsc.test.ts` unchanged and green.
- [x] **Step 2:** Back the toast store with `vue-sonner` (the store API is unchanged; the container renders `<Toaster rich-colors position="top-center" />` styled per wantap `ui/sonner.tsx`). Re-skin `DialogHost` onto the Dialog primitive, keeping its store-driven API and Esc behaviour.
- [x] **Step 3:** Run `npm test` and `npm run build`; PASS. Commit `feat(ui): move toasts and dialogs onto the wantap primitives`.

### Task 6: Brand and theme removal

**Files:** Create `src/components/brand/BrandLogo.vue` and test; modify `index.html`, `public/manifest.webmanifest`, `public/_headers` (only if it references `theme-init.js`), `scripts/release-check.mjs` if it asserts `theme-init.js`; delete `public/theme-init.js`, `src/composables/useDarkMode.ts` and its test and every dark-mode toggle UI.

**Interfaces:** `BrandLogo` props `{ to?: string; size?: 'sm' | 'md' | 'lg'; markOnly?: boolean }`. Sizes copy wantap `WantapLogo` (`sm` mark `size-5`, `md` mark `size-8 text-xl font-semibold tracking-tight gap-2.5`, `lg` mark `size-14 sm:size-16`, wordmark `font-display text-5xl sm:text-6xl`). Renders a router-link with `aria-label="eypi.cc"` when `to` is set; the mark image has `alt=""`.

- [x] **Step 1:** Tests: `BrandLogo` renders the wordmark by default, hides it with `markOnly`, and exposes `aria-label` on the link; a repo test asserts `public/theme-init.js` does not exist and `index.html` has `class="dark"` and no inline script.
- [x] **Step 2:** Implement; remove the toggle from every consumer (`grep -rn useDarkMode src`); update `manifest.webmanifest` `theme_color`/`background_color` to the Task 1 hex.
- [x] **Step 3:** `npm run typecheck && npm test && npm run build`; PASS. Commit `feat(brand): add the logo lockup and drop the light theme`.

### Task 7: App shell and page chrome

**Files:** Create `src/components/layout/{AppShell.vue,appNav.ts,AppPage.vue,AppSection.vue}` and tests; modify the router layout wiring, `src/App.vue`, `OrgSwitcher.vue`, `OrgLogo.vue`, `AppTransition.vue`, `LocalDevBanner.vue`, `ScrollTop.vue`; retire `NavSidebar.vue` and `PageShell.vue`.

**Interfaces:**
- `appNav.ts`: `export const APP_NAV: { to: string; label: string; icon: Component }[]` built from the modules the current `NavSidebar.vue` lists, `isAppNavActive(to: string, path: string): boolean` (exact match or prefix + `/`).
- `AppShell.vue` slots `default`; renders the layout table above. Bottom tabs show at most 4 module links; any further modules, the invites entry (keep the pending-invite count badge using `Badge`) and sign-out live in the account `DropdownMenu`.

- [x] **Step 1:** Tests: sidebar link for the current route has `bg-primary/15`; `isAppNavActive('/links', '/links/abc')` is true and `('/links', '/linksx')` false; at least the 4-item bottom nav renders `aria-label="Primary"`; main has the bottom padding class; account menu opens and contains sign-out; the invite badge shows the pending count.
- [x] **Step 2:** Implement exactly per the layout table; `AppPage` is `mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6`, `AppSection` is a `Card`-based section with a `font-heading` title.
- [x] **Step 3:** Run tests; manually verify with the preview tools at 375, 768 and 1280 widths that nothing overflows and the primary action is reachable. Commit `feat(layout): rebuild the app shell on the wantap sidebar and bottom tabs`.

### Task 8: Marketing site

**Files:** Create `src/components/marketing/{MarketingHeader,MarketingFooter,Hero,FeatureStrip,ProofSection,CtaSection}.vue`; modify `src/views/HomeView.vue`, `ContactView.vue`; delete the replaced components and their tests, porting `HeroSection.test.ts` and `TheFooter.test.ts` intent (CTA links and footer links keep working) to the new files.

- [x] **Step 1:** Tests: Hero has one `h1`, a primary `Get started` link to the sign-in route, and the large brand; header shows logo and one primary button, collapsing to a menu on mobile; footer keeps every link the old test asserted.
- [x] **Step 2:** Implement per the hero spec in the layout table: dark ink background, `bg-dot-grid` at low opacity behind the hero, `float-slow` accents (decorative, `aria-hidden`), at most one proof section and one closing CTA (wantap's landing plan removed feature grids and comparison tables, so do not add them; condense `FeaturesCarousel`, `StatsStrip` and `WhyEypi` into one `FeatureStrip`). Header primary button is `Button` default; it is sticky with `backdrop-blur-md`.
- [x] **Step 3:** Run tests. Commit `feat(marketing): rebuild the home page in the wantap landing style`.

### Task 9: Auth and status pages

**Files:** Modify `LoginView.vue`, `ConsentView.vue`, `UnlockView.vue`, `ExpiredView.vue`, `NotFoundView.vue`, `RedirectView.vue`, `components/OrgLockout.vue`, and their existing tests (assertions on copy and behaviour stay; class assertions are updated).

- [x] **Step 1:** Update tests first to assert the new structure: a single `Card`, the Microsoft sign-in control is a `Button size="lg"` full width with its accessible name unchanged, error states (`?error=server|state|tenant|domain|disabled|cancelled`) render in a destructive-styled inline message with the same copy, Unlock input is an `Input` with a visible `Label`. Run; FAIL.
- [x] **Step 2:** Restyle per the auth and empty-state rows of the layout table.
- [x] **Step 3:** Run tests. Commit `feat(auth): restyle sign-in and status pages with the wantap primitives`.

### Task 10: Links module

**Files:** Modify `views/links/LinksView.vue`, `views/DashboardView.vue`, `components/links/*`, `components/AnalyticsPanel.vue`, `components/links/QrDesigner.vue`; update their tests.

- [x] **Step 1:** Tests (add to the existing files): the link list renders as `Card` rows, the row actions are icon `Button`s with `aria-label`s; at 375px classes allow wrapping (`min-w-0`, `truncate` on slugs, `font-mono` for slugs); `QrDesigner` preview container has an explicit light background (`bg-white`) and the exported colours default to dark modules on a light background (**Review Focus 1**); `AnalyticsPanel` passes chart colours derived from `--chart-1..5` and light grid/tick colours to Chart.js (**Review Focus 4**).
- [x] **Step 2:** Replace legacy classes with primitives (`Input`, `Select`, `Switch`, `Tabs`, `Dialog`, `Badge`); keep all logic.
- [x] **Step 3:** Run tests; preview at 375/1280. Commit `feat(links): restyle the links dashboard, editor, qr designer and analytics`.

### Task 11: Tix module

**Files:** Modify `views/tix/*`, `components/tix/*` (including `selection/`).

- [x] **Step 1:** Update or add tests: attendee tables scroll inside `overflow-x-auto` wrappers at 375px; the scanner panel keeps the camera view (video stays unstyled by the theme) and its start/stop `Button`s; `ClusterBars` use `--chart-*` tokens.
- [x] **Step 2:** Restyle onto primitives; do not touch spreadsheet export logic or generated file styles (**Review Focus 4**).
- [x] **Step 3:** Run tests. Commit `feat(tix): restyle events, attendees and the scanner`.

### Task 12: Orgs, settings, account, invites

**Files:** Modify `views/orgs/*`, `views/settings/*`, `views/AccountView.vue`, `views/InvitesView.vue`, `components/orgs/InviteCard.vue`, `views/ReportView.vue`; update their tests.

- [x] **Step 1:** Update tests for structure only (cards, buttons, labelled inputs); invite pending badges still show counts.
- [x] **Step 2:** Restyle. Commit `feat(orgs): restyle org management, settings, account and invites`.

### Task 13: DP and Forms

**Files:** Modify `views/dp/*`, `components/dp/DpFrameUploader.vue`, `views/forms/*` (including `generators/`).

- [ ] **Step 1:** Tests: `DpPublicView` range control is the `Slider` primitive and still emits the same values; the frame canvas preview and downloaded output are unaffected by theme colours (**Review Focus 4**); `DpFrameUploader` drop zone is `bg-dot-grid` with a ring on focus and drag-over.
- [ ] **Step 2:** Restyle. Commit `feat(dp): restyle profile frames and forms`.

### Task 14: Admin and legal pages

**Files:** Modify `views/admin/*`, `views/LegalView.vue`, `components/LegalLayout.vue`, `views/ContactView.vue` leftovers.

- [ ] **Step 1:** Update `adminViews.test.ts` and `LegalView.test.ts` for structure; tables scroll at 375px; legal prose uses `text-muted-foreground`, `max-w-prose`, headings in `font-heading`.
- [ ] **Step 2:** Restyle. Commit `feat(admin): restyle admin tools and legal pages`.

### Task 15: Remove legacy styles and lock it in

**Files:** Delete `src/styles/legacy.css`; modify `src/styles/design.test.ts`, `src/removedChrome.test.ts`, `src/components/a11ySurfaces.test.ts`.

- [ ] **Step 1:** Add failing tests: `it('uses no legacy design tokens')` globs `src/**/*.{vue,ts,css}` and `index.html` and fails on any of `mica`, `pill-nav`, `g-bg`, `g-surface`, `g-border`, `g-text`, `g-muted`, `g-accent`, `g-primary`, `eypi-gold`, `apc-blue`, `apc-gold`, `#34418F`, `#DEAC4B`, `Geist`, `useDarkMode`, `tap-scale`, `data-cursor`; `it('has no hard-coded hex colours in components except the QR designer defaults')`. Add `a11ySurfaces` cases that every `<button>` and `<a>` in the shell renders an accessible name.
- [ ] **Step 2:** Run; list offenders; fix each file in place (replace with tokens). Delete `legacy.css` and its import.
- [ ] **Step 3:** `npm run typecheck && npm test && npm run build && npm run lint` (warnings may not increase beyond 1061). Commit `refactor(design): remove the legacy eypi styles`.

### Task 16: Documentation

**Files:** Rewrite `DESIGN_SYSTEM.md`; modify `AGENTS.md` (table row), `CONTEXT.md` (any design vocabulary), `docs/superpowers/plans/2026-10-27-wantap-design-port.md` (tick boxes).

- [ ] **Step 1:** `DESIGN_SYSTEM.md` sections: brand and source of truth (wantap.cc), the token table, typography, radius and control scale, surfaces, layout (shell, marketing, auth, empty states), component catalogue (each `ui/*` primitive with variants), motion and reduced motion, accessibility (focus ring, contrast ratios as tested), z-index (`z-40` bars, overlays from reka-ui), UI writing rules kept from the old §2. Every value must match `tokens.css` and `design.test.ts`.
- [ ] **Step 2:** Add a test in `design.test.ts` that every token name in `DESIGN_SYSTEM.md` exists in `tokens.css`. Commit `docs(design): rewrite the design system for the wantap language`.

### Task 17: Whole-app verification

- [ ] **Step 1:** `npm run typecheck && npm test && npm run build && npm run lint`; all green.
- [ ] **Step 2:** Run `npm run dev:local` and, with the preview tools, screenshot these routes at 375, 768 and 1280 px: `/`, `/login`, `/dashboard`, a links editor, QR designer, tix event, org page, DP campaign, admin, a legal page, a 404. Save to `docs/superpowers/screenshots/wantap-port/` (do not commit if larger than 5 MB total; otherwise keep them out of git and list them in the PR). Confirm in each: no horizontal scroll, visible focus ring on Tab, toasts appear top-center, QR still dark-on-light.
- [ ] **Step 3:** Open a PR description (title `feat(design): port the wantap.cc design language`) summarising tokens, primitives, shell, pages; no AI trailer. Do not deploy.
- [ ] **Step 4:** Report to the owner: what changed, test counts, screenshots location, the owner actions above.

## Self-review

- **Coverage:** tokens, fonts, radius, control scale, focus, surfaces, icons, toasts, motion, shell, marketing, auth, every module, docs, guard tests: Tasks 1-16. Light theme removal: Task 6. Contrast: Task 1. Legacy ban: Task 15.
- **Consistency:** `cn`, `buttonVariants`, `BrandLogo`, `APP_NAV`, `isAppNavActive` are defined once and consumed by name later.
- **Proportion:** class strings are referenced from wantap's source rather than transcribed, except the token block and layout rules that wantap's source does not state in one place.
- **Risk:** Task 1 (v3 to v4) is the highest risk; the quarantine file keeps every later task independent.
