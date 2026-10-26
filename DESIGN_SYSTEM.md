# eypi.cc Design System

The wantap design language (layout, components, type, motion) in the APC light palette. Light only. Every value below is read from the code (`src/styles/tokens.css`, `src/styles/main.css`, `src/components/ui/*`, `src/components/layout/*`, `src/components/marketing/*`) and guarded by `src/styles/design.test.ts`. If the code and this file disagree, the code wins: fix this file.

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

## 1. Brand and source of truth

**eypi.cc** is a URL shortener and org-tool suite for the Asia Pacific College (APC) student community.

- The reference for layout, components, type and motion is the wantap.cc repository. Where a class string is shared, copy it from wantap.cc; do not reinvent it. The palette is eypi's own.
- The palette is the APC brand on warm neutrals: APC blue (`#35438c`) is the primary and APC gold (`#deac4b`) is the accent. Gold is used for fills and washes (`--accent`, `--chart-2`) and is never text on a light surface or the background of white text.
- The app is light only. `index.html` declares `color-scheme: light`, the palette lives in the `:root` block of `tokens.css`, and no `dark:` utility exists anywhere (Tailwind's default `dark` variant follows the OS, so one stray `dark:` class would darken part of the UI). There is no dark theme and no theme toggle.
- Components never hard-code colors. They use the token utilities (`bg-background`, `text-muted-foreground`, `border-border`, `bg-primary/15`). Two allowances exist, both enforced by `design.test.ts`: the Microsoft logo fills in `LoginView.vue` (fixed by Microsoft brand rules) and the camera viewfinder scrim in `ScannerPanel.vue`.
- Wordmark: `BrandLogo` (`src/components/brand/BrandLogo.vue`).

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

Borders are hairlines (`border-border`, `ring-foreground/10`); there are no heavy shadows except popovers (`shadow-md`, `shadow-2xl` on the mobile org sheet).

## 6. Layout

### App shell

`AppShell` (`src/components/layout/AppShell.vue`) chooses the chrome with `isAppShellRoute()` in `src/config/nav.ts`: signed-in users on `requiresAuth` routes or any nav destination get the app shell; everything else gets the public page.

Root: a fixed-height column; only the content pane scrolls.

```
div[data-app-shell].flex h-dvh flex-col bg-background
  LocalDevBanner
  div[data-shell-body].flex min-h-0 flex-1 flex-col lg:flex-row
    aside.sticky top-0 hidden h-full w-56 shrink-0 flex-col border-r border-border bg-background/95 lg:flex
    div.flex min-h-0 min-w-0 flex-1 flex-col
      header.sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden
      main#app-content.relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0
      nav[aria-label="Primary"].fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden
```

- **Side rail** (`lg` and up, `w-56`): logo row `h-16`, then nav `aria-label="App modules"`, then org switcher and account menu in the footer. Nav item: `flex items-center gap-3 rounded-xl px-3 py-2.5 text-base font-medium transition`. Active: `bg-primary/15 text-foreground` with a `text-primary` icon and `aria-current="page"`. Inactive: `text-muted-foreground hover:bg-muted hover:text-foreground`. The invite count renders as a `Badge`.
- **Top bar** (below `lg`, `h-14`): `BrandLogo`, compact `OrgSwitcher`, header `AccountMenu`. Never hides on scroll.
- **Tab bar** (below `lg`): `grid h-[4.5rem] grid-cols-4`. Cell: `flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition`, icon `size-5`. Active `text-primary`, inactive `text-muted-foreground hover:text-foreground`. Destinations beyond the tabs appear in the header account menu.
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

Headline `mt-8 text-4xl font-semibold tracking-tight sm:text-5xl` with the accent word in `text-primary`. Lead paragraph `max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl`. Primary CTA is a `Button` `size="lg"` at `h-14 px-6`. The preview card is decorative (`aria-hidden`). Other marketing blocks: `FeatureStrip`, `ProofSection`, `CtaSection`, `MarketingHeader` (`sticky top-0 z-40 flex h-14 ... bg-background/90 backdrop-blur-md`), `MarketingFooter`.

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
| `Toaster` | `Toaster` (vue-sonner wrapper) | Light theme, mapped to the popover tokens. See section 12. |

Focus on every interactive primitive: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` (badges, tabs and the slider thumb use the same ring at `3px`).

App-level components built on these: `AppPage`, `AppSection`, `BrandLogo`, `OrgSwitcher`, `AccountMenu`, `SiteNavSheet`, `DialogHost` (confirm and info dialogs via `useDialog()`), `PageSkeleton`, `ScrollTop`.

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

Skeletons (`PageSkeleton`, blocks shaped like the final layout) are used instead of spinners.

## 9. Accessibility

**Contrast.** `design.test.ts` computes WCAG contrast from the token values (sRGB to linear light, the accent wash blended over the background) and requires the thresholds below. Measured ratios with the current tokens:

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

**Focus ring.** Every focusable control shows a ring in `--ring`: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`. `--ring` is solid APC blue, so the border of a focused control is full strength and the halo is the 50% ring around it. The base layer also sets `outline-ring/50` on every element.

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
| Org switcher sheet | `z-[10000]` backdrop, `z-[10001]` sheet on mobile; `sm:z-40` backdrop and `sm:z-50` popover | `OrgSwitcher` |
| Skip link | `z-[100000]` | Visible on focus only |

Toasts are rendered by vue-sonner, which manages its own stacking.

## 11. QR output

QR codes must stay dark on a light background to scan. The QR preview in `QrDesigner.vue` is therefore always white; there is no theme to follow, so this is a rule for QR output, not an exception. Do not theme QR output.

## 12. Toasts

`ToastContainer` mounts the `Toaster` wrapper (`src/components/ui/sonner`) with `rich-colors` and `position="top-center"`. The wrapper uses `theme="light"` and maps the sonner background, text, border and radius variables to `--popover`, `--popover-foreground`, `--border` and `--radius`. Status icons are lucide icons at `size-4`.

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
