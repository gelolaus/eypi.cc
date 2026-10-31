# eypi.cc Design System

The wantap design language (layout, components, type, motion) in the APC palette, in three themes: Light, Dark and True black. Every value below is read from the code (`src/styles/tokens.css`, `src/styles/main.css`, `src/components/ui/*`, `src/components/layout/*`, `src/components/marketing/*`) and guarded by `src/styles/design.test.ts`. If the code and this file disagree, the code wins: fix this file.

## Contents

1. Brand and source of truth
2. Tokens
3. Typography
4. Radius and control scale
5. Surfaces
6. Layout
7. Component catalogue
8. Motion and reduced motion
9. Accessibility
10. Z-index
11. QR output
12. Toasts
13. UI writing rules
14. Loading, undo, transitions, palette, empty states, install

## 1. Brand and source of truth

**eypi.cc** is a URL shortener and org-tool suite for the Asia Pacific College (APC) student community.

- The reference for layout, components, type and motion is the wantap.cc repository. Where a class string is shared, copy it from wantap.cc; do not reinvent it. The palette is eypi's own.
- The palette is the APC brand on warm neutrals: APC blue (`#35438c`) is the primary and APC gold (`#deac4b`) is the accent. Gold is used for fills and washes (`--accent`, `--chart-2`) and is never text on a light surface or the background of white text.
- The app has three themes: Light, Dark and True black. Light is the `:root` block of `tokens.css`, Dark is the `.dark` block, and True black is `.dark.black`, which overrides surfaces only (section 2). The theme is applied only through tokens: no `dark:` utility exists anywhere (Tailwind's default `dark` variant follows the OS, so one stray `dark:` class would darken part of the UI), and `main.css` sets `color-scheme` to `light` on `:root` and `dark` on `html.dark`.
- The picker offers System, Light and Dark, plus a True black switch that applies to Dark. It lives in the account menu under "Appearance" and on the sign-in screen. The default is System, which follows the OS. The preference is stored on the device in `localStorage` under the single key `eypi.theme` as `{ mode, black }`. `public/theme-init.js` reads it and sets the `dark` and `black` classes on `<html>` and the `theme-color` meta before first paint (it is an external script because the page forbids inline scripts), and `useTheme` (`src/composables/useTheme.ts`) keeps the classes, the meta and the stored value in sync afterwards, including when the OS setting changes under System.
- Components never hard-code colors. They use the token utilities (`bg-background`, `text-muted-foreground`, `border-border`, `bg-primary/15`). Two allowances exist, both enforced by `design.test.ts`: the Microsoft logo fills in `LoginView.vue` (fixed by Microsoft brand rules) and the camera viewfinder scrim in `ScannerPanel.vue`.
- Wordmark: `BrandLogo` (`src/components/brand/BrandLogo.vue`) shows the Eypi mascot (`public/eypi-mark.png`) beside the Eypi name. Eypi is a baby ram, the APC spirit animal: cream wool, royal blue horns and eyes, honey gold background. The source image is `docs/logo/eypi-icon-source.png`; the favicon, apple-touch icon and manifest icons in `public/` are resized from it.

## 2. Tokens

Defined once, in the `:root` block of `src/styles/tokens.css`. `src/styles/main.css` maps each one to a Tailwind color (`--color-background: var(--background)` and so on), so `bg-primary`, `text-foreground`, `border-border`, `ring-ring` work with opacity modifiers.

| Token | Value | Use |
|---|---|---|
| `--background` | `#f5f5f5` | Page background |
| `--foreground` | `#0a0a0a` | Body text |
| `--card` | `#ffffff` | Card fill |
| `--card-foreground` | `#0a0a0a` | Text on cards |
| `--popover` | `#ffffff` | Menus, dialogs, tooltips, toasts |
| `--popover-foreground` | `#0a0a0a` | Text on popovers |
| `--primary` | `#35438c` | APC blue: primary buttons, active nav, links |
| `--primary-foreground` | `#ffffff` | Text on primary |
| `--secondary` | `#ebebeb` | Secondary buttons, quiet fills |
| `--secondary-foreground` | `#0a0a0a` | Text on secondary |
| `--muted` | `#ebebeb` | Hover wash, tab list, avatar fallback |
| `--muted-foreground` | `#5c5c5c` | Secondary text, placeholders |
| `--accent` | `color-mix(in srgb, #deac4b 25%, transparent)` | APC gold wash: menu hover, highlights |
| `--accent-foreground` | `#0a0a0a` | Text on the accent wash |
| `--destructive` | `#c62828` | Errors and destructive actions |
| `--border` | `#e2e2e2` | All hairlines |
| `--input` | `#8c8c8c` | Input borders (3:1 on white and on the page) |
| `--ring` | `#35438c` | Focus ring (solid; the halo is `ring-ring/50`) |
| `--chart-1` | `#35438c` | Chart series 1 |
| `--chart-2` | `#deac4b` | Chart series 2 |
| `--chart-3` | `#7783c4` | Chart series 3 |
| `--chart-4` | `#a87a1c` | Chart series 4 |
| `--chart-5` | `#9aa0b8` | Chart series 5 |
| `--avatar-blue`, `--avatar-indigo`, `--avatar-violet`, `--avatar-pink`, `--avatar-red`, `--avatar-orange`, `--avatar-gold`, `--avatar-green`, `--avatar-teal`, `--avatar-sky`, `--avatar-slate`, `--avatar-brown` | one hex each (see `tokens.css`) | Avatar icon colours (3:1 against their own 15% wash); Dark and True black share one set |
| `--sidebar` | `#ffffff` | Sidebar background |
| `--sidebar-foreground` | `#0a0a0a` | Sidebar text |
| `--sidebar-primary` | `#35438c` | Sidebar accent |
| `--sidebar-primary-foreground` | `#ffffff` | Text on the sidebar accent |
| `--sidebar-accent` | `#ebebf2` | Sidebar hover fill |
| `--sidebar-accent-foreground` | `#0a0a0a` | Text on the sidebar hover fill |
| `--sidebar-border` | `#e2e2e2` | Sidebar hairlines |
| `--sidebar-ring` | `#35438c` | Sidebar focus ring |
| `--radius` | `0.875rem` | Base radius (section 4) |

`design.test.ts` asserts every value in this table, and that this file names every token in `tokens.css` and no token that does not exist there.

### Dark and True black

The table above is the Light palette. The `.dark` block redefines the same tokens; `.dark.black` is applied on top of it and overrides only the surfaces listed after the Dark table. The values below are read from `tokens.css`, which wins if this file disagrees.

| Token | Dark |
|---|---|
| `--background` | `#0a0a0a` |
| `--foreground` | `#ededed` |
| `--card` | `#141414` |
| `--card-foreground` | `#ededed` |
| `--popover` | `#181818` |
| `--popover-foreground` | `#ededed` |
| `--primary` | `#8b97d8` |
| `--primary-foreground` | `#0a0a0a` |
| `--secondary` | `#1f1f1f` |
| `--secondary-foreground` | `#ededed` |
| `--muted` | `#1f1f1f` |
| `--muted-foreground` | `#a3a3a3` |
| `--accent` | `color-mix(in srgb, #deac4b 20%, transparent)` |
| `--accent-foreground` | `#ededed` |
| `--destructive` | `#ef7373` |
| `--border` | `#262626` |
| `--input` | `#6b6b6b` |
| `--ring` | `#8b97d8` |
| `--chart-1` | `#8b97d8` |
| `--chart-2` | `#deac4b` |
| `--chart-3` | `#5a68b8` |
| `--chart-4` | `#f0d08a` |
| `--chart-5` | `#9aa0b8` |
| `--sidebar` | `#101010` |
| `--sidebar-foreground` | `#ededed` |
| `--sidebar-primary` | `#8b97d8` |
| `--sidebar-primary-foreground` | `#0a0a0a` |
| `--sidebar-accent` | `#1b1e30` |
| `--sidebar-accent-foreground` | `#ededed` |
| `--sidebar-border` | `#262626` |
| `--sidebar-ring` | `#8b97d8` |

`--radius` is shared by all three themes. True black overrides nine tokens and inherits the rest from Dark:

| Token | True black |
|---|---|
| `--background` | `#000000` |
| `--card` | `#0d0d0d` |
| `--popover` | `#121212` |
| `--secondary` | `#181818` |
| `--muted` | `#181818` |
| `--border` | `#1f1f1f` |
| `--sidebar` | `#080808` |
| `--sidebar-accent` | `#12141f` |
| `--sidebar-border` | `#1f1f1f` |

## 3. Typography

Three families, self-hosted as variable woff2 files in `src/assets/fonts/` and declared with `@font-face` in `main.css` (`font-display: swap`). No CDN fonts: the CSP forbids them.

| Role | Family | Weights | File | Tailwind |
|---|---|---|---|---|
| Sans (body, UI) | Plus Jakarta Sans | 200 to 800 | `plus-jakarta-sans-latin-wght-normal.woff2` | `font-sans` (set on `html`) |
| Mono (slugs, codes, data) | JetBrains Mono | 100 to 800 | `jetbrains-mono-latin-wght-normal.woff2` | `font-mono` |
| Heading | Syne | 400 to 800 | `syne-latin-wght-normal.woff2` | `font-heading`, `.font-display` |

- `h1`, `h2` and `h3` use the heading family by default (`main.css` base layer). `.font-display` applies Syne to any other element.
- Fallbacks: sans `ui-sans-serif, system-ui, sans-serif`; mono `ui-monospace, monospace`; heading `ui-sans-serif, sans-serif`.
- `index.html` preloads the Plus Jakarta Sans and Syne files.
- Mono is for data only: slugs, URLs, codes, timestamps, confirm-text prompts.
- Common sizes in use: page title `text-3xl font-semibold tracking-tight sm:text-4xl` (`AppPage`); section title `font-heading text-xl font-semibold tracking-tight` (`AppSection`); hero `text-4xl font-semibold tracking-tight sm:text-5xl`; body `text-base`. Form text is at least `text-base` (16px) so iOS does not zoom.
- One heading per section. No eyebrow label that repeats the heading.

## 4. Radius and control scale

`--radius` is `0.875rem`. `main.css` derives the scale from it:

| Utility | Formula | Value |
|---|---|---|
| `rounded-sm` | radius x 0.6 | 0.525rem |
| `rounded-md` | radius x 0.8 | 0.7rem |
| `rounded-lg` | radius x 1 | 0.875rem |
| `rounded-xl` | radius x 1.4 | 1.225rem |
| `rounded-2xl` | radius x 1.8 | 1.575rem |
| `rounded-3xl` | radius x 2.2 | 1.925rem |
| `rounded-4xl` | radius x 2.6 | 2.275rem |

Control heights (touch targets are at least 44px by default):

| Control | Height |
|---|---|
| `Button` default, `Input`, `SelectTrigger` default, `TabsList` | `h-11` (44px) |
| `Button` `lg` | `h-12` (48px) |
| `Button` `sm`, `SelectTrigger` `sm` | `h-9` (36px) |
| `Button` `xs` | `h-8` (32px) |
| Icon buttons | `size-11` (default), `size-12` (`icon-lg`), `size-9` (`icon-sm`), `size-8` (`icon-xs`) |

Default controls use `rounded-xl`; `sm` and `xs` use `rounded-lg`. Section cards use `rounded-3xl`. Icon-only buttons carry an `sr-only` label.

## 5. Surfaces

| Surface | Classes | Notes |
|---|---|---|
| Page | `bg-background` | Set on `body` and the app shell |
| Card | `Card`: `rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10` | White fill on the grey page |
| Section card | `AppSection`: `Card` with `gap-0 rounded-3xl p-6 sm:p-7` | Titled with `font-heading text-xl font-semibold tracking-tight` |
| Popover (menu, select, dialog, tooltip) | `bg-popover text-popover-foreground ring-1 ring-foreground/10` | Tooltips invert: `bg-foreground text-background` |
| Glass panel | `.glass-panel` utility: `bg-card backdrop-blur-xl border border-border` | Used for panels over the dot grid |
| Bars (top bar, tab bar) | `bg-background/90` or `bg-background/95` with `backdrop-blur-md`, `border-border` | Section 6 |
| Dot grid | `.bg-dot-grid` | `radial-gradient` of `--foreground` at 16% opacity, `1px` dots, `24px 24px`. Used at `opacity-35` to `opacity-40` behind hero and empty states |

Borders are hairlines (`border-border`, `ring-foreground/10`); there are no heavy shadows except popovers (`shadow-md`, `shadow-2xl` on `BottomSheet`).

## 6. Layout

### App shell

`AppShell` (`src/components/layout/AppShell.vue`) chooses the chrome with `isAppShellRoute()` in `src/config/nav.ts`: signed-in users on `requiresAuth` routes or any nav destination get the app shell; everything else gets the public page.

Root: a fixed-height column; only the content pane scrolls.

```
div[data-app-shell].flex h-dvh flex-col bg-background
  LocalDevBanner
  div[data-shell-body].flex min-h-0 flex-1 flex-col lg:flex-row
    aside.sticky top-0 hidden h-full w-64 shrink-0 flex-col border-r border-border bg-background/95 lg:flex
    div.flex min-h-0 min-w-0 flex-1 flex-col
      header.sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden
      main#app-content.relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0
      nav[aria-label="Primary"].fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden
```

- **Side rail** (`lg` and up, `w-64`, or `w-16` when collapsed): logo row `h-16`, then nav `aria-label="App modules"` in two groups, Rams (Dashboard, Links, My tickets, Wallpaper, Invites, Orgs `/orgs`) and Orgs (members only: Tix, Frames, Forms, My org `/orgs/modify`, hidden when `useActiveOrg().hasOrg` is false), each with a heading (`text-xs font-medium text-muted-foreground`, `sr-only` when collapsed), then a collapse toggle (`aria-label` "Collapse sidebar" / "Expand sidebar", state saved in `localStorage` key `eypi.rail.collapsed`), the org switcher and the account menu in the footer. Collapsed, only icons show: nav links keep their label in `title` and an `sr-only` span, the org switcher and account menu shrink to their icon and avatar. The org switcher shows only the capitalised org slug (full name on `title` and `aria-label`). The account menu holds Admin (admins only), Account, Contact, Privacy, Terms and Sign out; Admin and Account are not rail items. Nav item: `flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition`. Active: `bg-primary/15 text-foreground` with a `text-primary` icon and `aria-current="page"`. Inactive: `text-muted-foreground hover:bg-muted hover:text-foreground`. The invite count renders as a `Badge`.
- **Top bar** (below `lg`, `h-14`): `BrandLogo`, compact `OrgSwitcher`, header `AccountMenu`. Never hides on scroll.
- **Tab bar** (below `lg`): `grid h-[4.5rem] grid-cols-5`. Cell: `flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition`, icon `size-5`. Active `text-primary`, inactive `text-muted-foreground hover:text-foreground`. The five tabs are Dashboard, Links, My tickets, Wallpaper and Invites. On phones the profile menu is a bottom sheet, and from `sm` up it stays the dropdown; Orgs, and for members Tix, Frames, Forms and My org, sit in that menu. My tickets shows a count badge (`9+` above nine) with screen-reader text such as "3 new updates", and Invites shows a pending-invite badge.
- **Content pane**: the scroll container for `ScrollTop` and route scroll restore (`useScrollContainer`, `installPaneScroll`). Pages sit inside `AppPage`: `mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8`, an `h1` and one short description line (`text-base text-muted-foreground sm:text-lg`).
- **Public pages**: `div.flex min-h-dvh flex-col` with `MarketingHeader`, `main#app-content.relative z-10 flex min-h-0 flex-1 flex-col`, `MarketingFooter`. Normal document scroll.
- **Skip link**: the first focusable element, `href="#app-content"`, visible on focus.
- Full-height surfaces use `dvh` (`h-dvh`, `min-h-dvh`), never bare `100vh`. Fixed bottom elements add `env(safe-area-inset-bottom)`.

### Marketing hero

`Hero.vue`:

```
section.relative isolate overflow-hidden px-5 pb-24 pt-12 sm:px-6 sm:pt-20
  .bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-40
  .float-slow decorative blobs: size-40 rounded-3xl bg-primary/15 and size-28 rounded-full bg-accent
  div.mx-auto grid max-w-5xl grid-cols-1 items-center gap-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12
```

Headline `mt-8 text-4xl font-semibold tracking-tight sm:text-5xl` with the accent word in `text-primary`. Lead paragraph `max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl`. Primary CTA is a `Button` `size="lg"` at `h-14 px-6`. The preview card is decorative (`aria-hidden`). Other marketing blocks: `FeatureStrip`, `ProofSection`, `CtaSection`, `MarketingHeader` (`sticky top-0 z-40 flex h-14 ... bg-background/90 backdrop-blur-md`), `MarketingFooter` (a slim bar: copyright on the left, inline links on the right from `md` up, stacked on phones; links keep `min-h-11`).

### Auth screen

`LoginView.vue`: `section.relative flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10 sm:py-24`, `BrandLogo` above a `Card` (`w-full max-w-md gap-6 rounded-3xl bg-card/80 p-6 sm:p-8`). Title `font-display text-3xl font-semibold tracking-tight`, one body line, errors as `role="alert"` with `rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-base text-destructive`.

### Empty and error states

`NotFoundView.vue` and `ExpiredView.vue` share one pattern: a full-height centered section over the dot grid.

```
section.relative isolate flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-6 sm:py-20
  .bg-dot-grid pointer-events-none absolute inset-0 -z-10 opacity-35
  div.flex max-w-md flex-col items-center gap-6 text-center
    icon disc: flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground
    code in font-display text-base font-semibold text-primary, h1 font-display text-3xl sm:text-4xl, one muted line, one Button
```

Empty states and errors state the next action (section 13).

## 7. Component catalogue

All primitives live in `src/components/ui/<name>/` and are imported from the folder (`@/components/ui/button`). Style props are composed with `cn()`; callers can append classes.

| Primitive | Parts | Variants and sizes |
|---|---|---|
| `Button` | `Button`, `buttonVariants` | Variants: `default` (`bg-primary text-primary-foreground`), `outline`, `secondary`, `ghost`, `destructive`, `link`. Sizes: `default` `h-11`, `xs` `h-8`, `sm` `h-9`, `lg` `h-12`, `icon` `size-11`, `icon-xs` `size-8`, `icon-sm` `size-9`, `icon-lg` `size-12`. Base: `rounded-xl text-base font-medium`, press nudge `translate-y-px`, `disabled:opacity-50`. |
| `Badge` | `Badge`, `badgeVariants` | `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`. `h-5 rounded-4xl px-2 text-xs font-medium`. |
| `Card` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` | `size`: `default` (spacing 4) or `sm` (spacing 3). |
| `Dialog` | `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`, `DialogClose` | Content: centered, `max-w-[calc(100%-2rem)] sm:max-w-sm`, `rounded-xl bg-popover p-4`. Overlay `bg-black/10` with `backdrop-blur-xs`. Close button is a `ghost` `icon-sm` with an `sr-only` label (`showCloseButton`). |
| `BottomSheet` | `BottomSheet` | Below `sm`: a modal bottom sheet (`role="dialog"`, backdrop, Escape, focus trap, `rounded-t-3xl`, `max-h-[80dvh]`). From `sm` up the slot stays inline with no dialog role, and that path is the org switcher's popover, not the profile menu. The profile menu uses it on phones and stays the dropdown from `sm` up. |
| `DropdownMenu` | Root, Trigger, Content, Item, CheckboxItem, RadioGroup, RadioItem, Label, Separator, Shortcut, Group, Sub, SubTrigger, SubContent, Portal | Content: `rounded-lg bg-popover p-1 shadow-md ring-1 ring-foreground/10`, `min-w-32`. |
| `Input` | `Input` | One style: `h-11 rounded-xl border-input bg-transparent px-3.5 text-base`. `aria-invalid` turns the border and ring destructive. |
| `Textarea` | `Textarea` | `min-h-16 rounded-lg border-input px-2.5 py-2 text-base md:text-sm`, auto-grows (`field-sizing-content`). |
| `Label` | `Label` | `text-base font-medium leading-none`. |
| `Select` | Root, Trigger, Value, Content, Item, Group, Label, Separator, ScrollUp/DownButton | Trigger `size`: `default` `h-11`, `sm` `h-9`. Content `rounded-lg bg-popover shadow-md`, `position` `item-aligned` (default) or `popper`. |
| `Separator` | `Separator` | `bg-border`, 1px, horizontal or vertical. |
| `Slider` | `Slider` | Thumb `size-3` with an enlarged hit area; optional `thumbLabel` for screen readers. |
| `Switch` | `Switch` | `size`: `default` (`18.4px` by `32px`) or `sm` (`14px` by `24px`). Checked `bg-primary`, unchecked `bg-input`. |
| `Tabs` | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `TabsList` `variant`: `default` (`bg-muted`) or `line` (transparent, underline on the active trigger). `h-11`, horizontal or vertical. |
| `Tooltip` | `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent` | Inverted: `bg-foreground text-background text-xs rounded-md`, `max-w-xs`. |
| `Avatar` | `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount` | `size`: `sm` `size-6`, `default` `size-8`, `lg` `size-10`. |
| `Toaster` | `Toaster` (vue-sonner wrapper) | Sonner `theme` follows the resolved theme (light or dark), with its base colors mapped to the popover tokens. See section 12. |

Focus on every interactive primitive: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` (badges, tabs and the slider thumb use the same ring at `3px`).

**`AppImage`** (`src/components/AppImage.vue`) is the standard way to show a stored org, frame or campaign image (static brand assets such as the `BrandLogo` mark in `public/` are plain files and do not use it). Props: `src`, `meta` (`ImageMeta`: width, height, variant widths, format, blur placeholder), `alt`, `sizes`, `priority`. It sets `width` and `height` from `meta` (no layout shift), `srcset` from the variants, `loading="lazy"` unless `priority` (then `fetchpriority="high"`), and a blur placeholder until load. If a variant fails it falls back to the original once. Pass `priority` only for the above-the-fold image. `data:` and `blob:` sources skip `srcset`. Decorative images use `alt=""`.

**Chart components** (`src/components/charts/`, hand-written SVG and HTML, no chart library; colors from `--chart-1` to `--chart-5`):

| Component | Props | Notes |
|---|---|---|
| `LineChart` | `series`, `yLabel` | Up to 5 series. |
| `BarList` | `items`, `max?` | Horizontal bars with the value as text. |
| `HeatGrid` | `cells` (168), `label` | 7 days by 24 hours; intensity is opacity. |
| `SparkLine` | `values`, `label` | Inline trend, no axes. |
| `StatTile` | `label`, `value`, `delta?` | Delta shows an arrow and a signed percent. |

Rules: color is never the only signal. `LineChart` gives each series its own dash pattern and marker shape (circle, square, diamond, triangle, cross) as well as its color, and `StatTile` pairs the delta color with an arrow and a signed percent. Every chart has `role="img"` and an `aria-label` that states the data (`BarList` is HTML, not SVG, but carries the same `role="img"`). Charts need a visible text label or legend and must fit 360px without horizontal scroll.

**Dashboard panels** (`src/components/dashboard/`, used by `/dashboard`):

| Component | Props | Notes |
|---|---|---|
| `PeriodPicker` | `modelValue` (`7` / `30` / `90`) | `role="group"` labelled "Period"; each option is a `Button` with `aria-pressed` and `min-h-11`. Range is owned by `useDashboardRange` (`sessionStorage` key `eypi.dashboardRange`, default 30). |
| `PanelState` | `status` (`loading` / `error` / `empty` / `ready`), `title`, `emptyBody?`, `action?` | Shared skeleton (`role="status" aria-busy="true"`), error with Retry (`retry` emit), and `EmptyState` when empty; slot when ready. One panel failing never blanks the page. |
| `LinkKpis` | `trends`, `status`, `previous?` | Stat tiles for clicks, daily uniques, QR scans, active links, and links total (links total has no previous-period delta). |
| `ClicksTrend` | `trends`, `status` | `LineChart` of clicks (and uniques) for the selected range. |
| `TopLinks` | `trends`, `status` | Own bar rows (same look as `BarList`) of the top links by clicks; each row links to `/links` and has a 44px copy button (`aria-label` `Copy eypi.cc/{slug}`) that uses `copyShortLink`. |
| `AudiencePanels` | `trends`, `status` | `BarList`s for device, country, referrer and in-app browser when present. |
| `BestHours` | `trends`, `status` | `HeatGrid` of the 168 Manila hour-of-week cells with a peak caption. |
| `UpcomingTickets` | `tickets`, `status` | Up to three upcoming tickets with a link to `/tickets`. |
| `AcrossApc` | `stats`, `status` | Muted strip of platform totals from `GET /api/stats`. |
| `OrgInsightsSection` | (uses active org + range) | Member-only org KPI strip, profile-views chart, members sparkline and "Full insights" link; fetches `GET /api/orgs/:org_id/insights`. |
| `FeatureCards` | `admin`, `org`, `group?` (`rams` / `orgs`) | Grouped nav cards with one-line descriptions; optional `group` mounts only that landmark's cards. |
| `GetStarted` | `linkCount`, `pendingInvites` | First-run Rams checklist (create a link, make a wallpaper, check invites); hidden when dismissed, all steps done, or the user already has 3+ links. Progress text, 44px Dismiss, and per-step done/to-do wording for screen readers. |

The dashboard view composes two labelled landmarks (Rams and Orgs). Orgs is members only. Under Rams, `GetStarted` sits above the KPIs for new students (fewer than 3 links), then the analytics panels with the period picker; org insights and Orgs cards sit under Orgs.


**Tix patterns** (`src/components/tix/`, `src/views/tix/`):

- **Ticket card** (`TicketCard`): `Card` with `rounded-3xl`, event name and a status `Badge` at the top, date and location below, then a bordered section with a sentence that explains the status. The QR shows only when the status is `confirmed`; other statuses show their sentence instead. Waitlisted cards state the position as text. Used on `/tickets` and `/t/:token`.
- **Status badges** say the status in words (`Confirmed`, `Waitlist`, `Pending`, `In the lottery`, `Not accepted`, `Cancelled`). Variant changes the look (`default`, `secondary`, `outline`), never the meaning. The same labels appear in event lists and the attendees inbox.
- **Door result states** (`DoorModeView`): a full-width card announced through `role="status"` with `aria-live="assertive"`. Each result carries its own sentence (`Checked in`, `Already checked in`, `Not on the guest list`, `Not confirmed`) plus the guest name, in white text on a solid color (emerald, amber, destructive) and a vibration pattern. Color never carries the result alone. Offline, save-failed and sync-stuck banners use `role="status"` or `role="alert"` and say what to do.
- **Tabs** on the event detail and the attendees inbox are `role="tablist"` with `role="tab"` buttons, `aria-selected`, `aria-controls` to a `role="tabpanel"`, and a roving `tabindex` (0 on the active tab, -1 on the rest). `onTabKeydown` (`src/lib/tix/tabKeys.ts`) adds ArrowLeft, ArrowRight, Home and End with wraparound. Tab counts are part of the label text.

App-level components built on these: `AppPage`, `AppSection`, `BrandLogo`, `OrgSwitcher`, `AccountMenu`, `SiteNavSheet`, `DialogHost` (confirm and info dialogs via `useDialog()`), `PageSkeleton`, `ScrollTop`, `AppImage`.

**Avatars** (`src/components/avatar/`, `shared/avatars.ts`): a signed-in user can pick an icon and a colour that replace their initials. Both halves are stored on the user (`avatar_icon`, `avatar_color`) and travel together; with either one missing or unknown, the initials show instead.

- **Icons**: 36 Lucide icons in six groups. Animals: `cat`, `dog`, `bird`, `fish`, `rabbit`, `squirrel`, `turtle`, `snail`. School: `book-open`, `graduation-cap`, `pencil`, `backpack`, `lightbulb`, `calculator`. Sports: `dumbbell`, `bike`, `trophy`, `volleyball`, `target`. Music and games: `music`, `headphones`, `guitar`, `gamepad-2`, `dices`, `puzzle`. Nature: `leaf`, `flower-2`, `sun`, `moon`, `mountain`, `tree-pine`. Abstract: `star`, `heart`, `zap`, `flame`, `rocket`. The list lives in `shared/avatars.ts` and the icon components in `avatarIcons.ts`.
- **Colours**: 12 swatches (blue, indigo, violet, pink, red, orange, gold, green, teal, sky, slate, brown), each one the `--avatar-*` token row in section 2. The icon is drawn in the swatch colour on a wash of the same colour at 15% (`color-mix`), so the pair stays legible in Light, Dark and True black.
- **`UserAvatar`**: `name`, `icon?`, `color?` and a `class` for size. It draws the round swatch with the icon at 55% of the circle, and falls back to the standard `Avatar` initials. Sizes in use: `size-8` in lists (org members, admin users) and the account menu trigger, `size-9`, `size-11` and `size-12` in the account menu, and `size-20` for the live preview in the picker. The icon is `aria-hidden`; the name is always shown next to the avatar.
- **`AvatarPicker`**: a `Dialog` opened from the `Change avatar` item in the account menu. It holds a live preview, an `Icon` radiogroup (6 columns) and a `Colour` radiogroup, then `Reset` (ghost) and `Save`. `Save` stays disabled until both an icon and a colour are chosen. It starts from the current avatar every time it opens.
- **Accessibility**: each option is a `role="radio"` button inside a `radiogroup` with an `aria-label` (the icon name or colour name), `aria-checked`, and a roving `tabindex` (the selected one, or the first when none is selected). Arrow keys move and select. Targets are at least 44px (`min-h-11 min-w-11`). Focus uses the standard ring. The selection is shown by a ring (and a check mark on a colour swatch), never by colour alone. Closing the dialog returns focus to the account menu button.

## 8. Motion and reduced motion

Only wantap motion exists. Keyframes and utilities are in `main.css`:

| Utility | Keyframes | Timing |
|---|---|---|
| `.float-slow` | `float-slow`: `translateY(0)` to `-14px`, rotate `-2deg` to `1deg` | `6s ease-in-out infinite` |
| `.float-slow-2` | `float-slow-2`: `translateY(0)` to `16px`, rotate `2deg` to `-2deg` | `8s ease-in-out infinite` |
| `.animate-sparkle` | `sparkle-pulse`: opacity `0.3` to `1`, scale `0.8` to `1.15`, rotate `0` to `12deg` | `2.6s ease-in-out infinite` |
| `.animate-blink-caret` | `blink-caret`: opacity steps | `1.1s step-end infinite` |
| `.marketing-block-enter` | `marketing-block-in`: opacity `0` to `1`, `translateY(6px)` to `0` | `280ms ease-out` |

Overlays (dialog, dropdown, select, tooltip) use `tw-animate-css` classes (`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`) at `duration-100`. Buttons press with `translate-y-px`. `main.css` defines no other keyframes; do not add motion that wantap does not have.

Under `@media (prefers-reduced-motion: reduce)` the block at the end of `main.css` sets `animation: none` on `.float-slow`, `.float-slow-2`, `.animate-sparkle`, `.animate-blink-caret` and `.marketing-block-enter`. `design.test.ts` asserts the first four are in that block.

Skeletons (`PageSkeleton`, blocks shaped like the final layout) are used instead of spinners. See section 14 for the new primitives.

## 9. Accessibility

**Contrast.** `design.test.ts` computes WCAG contrast from the token values (sRGB to linear light, the accent wash blended over the background) and requires the thresholds below in all three palettes: Light, Dark and True black. In Dark and True black it also requires 3:1 for every chart colour against `--card`; Light is exempt because its gold fill is decorative. The measured ratios below are for the Light palette:

| Pair | Required | Measured |
|---|---|---|
| `--foreground` on `--background` | 4.5:1 | 18.16:1 |
| `--muted-foreground` on `--background` | 4.5:1 | 6.13:1 |
| `--muted-foreground` on `--muted` | 4.5:1 | 5.61:1 |
| `--primary-foreground` on `--primary` | 4.5:1 | 9.00:1 |
| `--primary` as text on `--background` (links, active nav) | 4.5:1 | 8.26:1 |
| `--primary` as text on `--card` | 4.5:1 | 9.00:1 |
| `--destructive` as text on `--background` | 4.5:1 | 5.16:1 |
| `--destructive` as text on `--card` | 4.5:1 | 5.62:1 |
| `--card-foreground` on `--card` | 4.5:1 | 19.80:1 |
| `--accent-foreground` on the `--accent` wash over `--background` | 4.5:1 | 16.00:1 |
| `--sidebar-accent-foreground` on `--sidebar-accent` | 4.5:1 | 16.69:1 |
| `--ring` against `--background` (non-text) | 3:1 | 8.26:1 |
| `--ring` against `--card` (non-text) | 3:1 | 9.00:1 |
| `--input` against `--card` (control border) | 3:1 | 3.36:1 |
| `--input` against `--background` (control border) | 3:1 | 3.08:1 |

APC gold is not in this table because it is never text and never carries white text; on `--background` it is about 1.9:1, so it is decorative only.

**Focus ring.** Every focusable control shows a ring in `--ring`: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`. `--ring` is solid APC blue, so the border of a focused control is full strength and the halo is the 50% ring around it. The base layer also sets a full-strength `outline-ring` on every element, so links without their own ring still meet 3:1.

**Touch targets.** Controls are 44px by default (section 4).

**Structure.**
- A skip link to `#app-content` is the first focusable element.
- Landmarks: top bar `header`, `nav[aria-label="Primary"]` (tab bar), `nav[aria-label="App modules"]` (side rail), `main#app-content`.
- Active nav item: `aria-current="page"`. Invite count badge: `aria-label` such as `2 pending invites`.
- Invalid fields set `aria-invalid="true"`; form errors use `role="alert"`.
- Icon-only buttons have an `sr-only` label or `aria-label`; decorative icons and visuals are `aria-hidden="true"`.
- Overlays (dialog, dropdown, select, tooltip) come from reka-ui and bring focus trap, Esc, and focus return. Do not use `window.confirm()` or `alert()`.
- No action is hover-only.
- No horizontal page scroll at 360px.

## 10. Z-index

| Layer | Class | Where |
|---|---|---|
| Behind content | `-z-10` | Dot grid and blobs inside the hero and empty states |
| Content pane | `z-10` | `main#app-content` |
| Bars | `z-40` | App top bar, tab bar, `MarketingHeader`, `ScrollTop` |
| reka-ui overlays | `z-50` | `DialogOverlay`, `DialogContent`, `DropdownMenuContent`, `SelectContent`, `TooltipContent` |
| Local dev banner | `z-[9991]` | `LocalDevBanner`, in flow |
| Bottom sheet | `z-[10000]` backdrop, `z-[10001]` sheet on mobile; `sm:z-40` backdrop and `sm:z-50` popover | `BottomSheet` (profile menu on phones, and the org switcher) |
| Skip link | `z-[100000]` | Visible on focus only |

Toasts are rendered by vue-sonner, which manages its own stacking.

## 11. QR output

QR codes must stay dark on a light background to scan. The QR preview in `QrDesigner.vue` is therefore always white, in Light, Dark and True black alike. Do not theme QR output. Two other things also ignore the theme: the Microsoft sign-in logo keeps its brand fills, and emails are unchanged.

## 12. Toasts

`ToastContainer` mounts the `Toaster` wrapper (`src/components/ui/sonner`) with `rich-colors` and `position="top-center"`. The wrapper sets `theme` from the resolved theme (light or dark) and maps the sonner background, text, border and radius variables to `--popover`, `--popover-foreground`, `--border` and `--radius`. Status icons are lucide icons at `size-4`.

The `useToast()` store (`success`, `error`, `info`) remains the source of truth for dedupe, cap and timers; vue-sonner only renders (`duration: Infinity`, the store dismisses). Call `useToast()`, never `toast` from vue-sonner directly.

## 13. UI writing rules

UI text is part of the design system. Anyone editing headings, labels, empty states, toasts, errors or marketing copy follows these rules. This file follows them too.

### Prose rules

1. **No em dashes** in UI strings or design-system prose. Use a period, comma, colon, semicolon, or parentheses.
2. **No hollow intensifiers** (`seamless`, `robust`, `powerful`, `delightful`, `significantly`, etc.). If a claim needs a number or token, state it; otherwise cut the word.
3. **No marketing filler** in product UI: no "In today's...", "It's important to note", "effortlessly", "unlock", "elevate". Open on the fact the user needs.
4. **Headings name the screen or section**; they do not tease. Use `Organization settings`, not `Take control of your org`.
5. **One job per line.** If a subtitle, eyebrow, helper, or card footer only restates a heading or control, remove it.
6. **Empty states and errors state the next action**, not mood. Wrong: `Something went wrong.` Right: `Could not save link. Check the URL and try again.`
7. **Loading labels stay uppercase data voice** where already specified (`PROCESSING...`, `SAVING...`, `ENCRYPTING...`); do not rewrite them into soft marketing phrases.
8. **Prose added to this file uses checkable facts only.** Update tokens and examples when the product changes.

### Concision rules

Every heading, subtitle, label or helper line must carry information the surrounding UI does not already convey. If a line only restates a heading, a control or another line nearby, cut it.

- One heading per section; no eyebrow that duplicates the heading below it.
- No subtitles that restate what tabs, cards or form fields already show.
- No helper text under links or buttons that repeats what the destination says.
- No card footers or CTAs that only say "open this" when the card is already clickable.
- Keep instructional copy when it explains non-obvious behavior (format rules, consequences, empty-state next steps).

### Cut-copy examples (this codebase)

| Before (cut) | After |
|---|---|
| Dashboard card footer: `Launch ->` on every module card | *(removed; cards are already clickable launchers)* |
| OrgSwitcher dropdown header: `Switch organization` | *(removed; the org list is self-evident)* |
| Settings subtitle: `Account security and platform org management.` | *(removed; tab labels already say this)* |
| Login `<h2>LOGIN</h2>` above a form with Login/Register toggles | *(removed; toggles identify the mode)* |

### UI string examples (wrong vs right)

| Wrong | Right |
|---|---|
| `Unlock powerful link analytics` | `Link analytics` |
| `Seamlessly manage your organization` | `Organization settings` |
| `Something went wrong. Please try again.` | `Could not save link. Check the URL and try again.` |
| `Welcome to your dashboard!` | `Dashboard` |
| `Get started with eypi today` | `Create account` (button label only; no subtitle) |


## 14. Loading, undo, transitions, palette, empty states, install

- **Skeleton** (`ui/Skeleton.vue`): `w` (px or CSS), `h` (px, required), `radius`; `bg-muted`, `aria-hidden`, pulse only under `motion-safe`. Page skeletons (`skeletons/ListSkeleton`, `CardGridSkeleton`, `DetailSkeleton`, `OrgProfileSkeleton`) use fixed pixel heights taken from the loaded markup so nothing shifts, and set `role="status"` and `aria-busy="true"`. No spinners for page loads. A changed card or row needs its skeleton height changed with it (tests assert the heights).
- **Undo** (`useUndoToast`, `runWithUndo({ message, apply, revert, commit, windowMs = 5000 })`): apply now, show an info toast with an `Undo` action for 5 s, then commit once. Undo reverts and never commits; a failed commit reverts and shows an error toast; leaving or hiding the page commits at once. Use it for reversible actions (single link delete, bulk disable, remove member, cancel invite, remove attendee, remove frame). Keep `confirm` for permanent or hard-to-reverse ones (bulk delete, delete campaign, transfer ownership, leave org, decline invite, new guest link).
- **Route transitions** (`routeTransitions` in `lib/viewTransition.ts`): a 150 ms cross-fade through the View Transitions API, started after guards and chunk loads. Off when the API is missing, under `prefers-reduced-motion: reduce` (also disabled in `main.css`), on first load and for query or hash-only changes.
- **Command palette** (`CommandPalette.vue`, lazy): `Ctrl+K` or `Cmd+K`, or the search button in the rail; ignored while typing in an input, textarea, select or editable field. Groups: Go to, Create, Switch org. Arrow keys, Enter and Esc work, rows are 44px, admin commands show for admins only. Org-only destinations are hidden when `useActiveOrg().hasOrg` is false. The site sheet (`SiteNavSheet`) uses the same membership gate.
- **EmptyState** (`EmptyState.vue`): icon disc, `title`, optional `body` (`text-base`) and at most one primary `action` (`to`, `href` or `onClick`). The action must work for users without an org. It states the next step (section 13).
- **Install**: "Install Eypi" in the account menu (44px). It appears only after `beforeinstallprompt` and hides after `appinstalled`; there is no pop-up. The manifest opens at `/dashboard`.
