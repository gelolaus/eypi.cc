# eypi.cc Design System
**Wantap design language. Production specification.**

---

## Table of Contents

1. [Brand identity](#1-brand-identity)
2. [UI writing rules](#2-ui-writing-rules)
3. [Color system](#3-color-system)
4. [Typography scale](#4-typography-scale)
5. [Spacing and layout](#5-spacing-and-layout)
6. [Component anatomy](#6-component-anatomy)
7. [Motion and interaction](#7-motion-and-interaction)
8. [Accessibility (a11y)](#8-accessibility-a11y)
9. [Z-index architecture](#9-z-index-architecture)

---

## 1. Brand identity

### Product and attribution

**eypi.cc** is a URL shortener and org-tool suite for the Asia Pacific College (APC) student community.

| Source | What it owns |
|---|---|
| **APC (Asia Pacific College)** | Brand colors: APC Blue `#34418F` (`--color-brand` / `g-brand`), APC Gold `#DEAC4B` (`--color-primary` / `g-primary`), and gold hover variants in §3. These are APC brand colors, not Wantap brand marks. |
| **Wantap design language** | Shell pattern, density, radius, dual themes (warm paper + navy-ink), Syne + Plus Jakarta Sans roles, primitive kit, AppShell chrome. Wantap applies APC colors; it does not own them. |
| **eypi.cc** | The product: short links and suite modules for the APC student community. UI copy rules live in §2. |

### Visual rules

- **Dual themes, equally first-class**: Light is warm paper (`#F5F1EA` / `#FFFCF7`). Dark is deep navy-ink (`#0A0E18` / `#121826`), not warm brown.
- **Syne for display; Plus Jakarta Sans for UI**: Syne on page titles, marketing brand, H1–H3. Plus Jakarta Sans on nav, buttons, forms, body, labels.
- **One heading per section**: No eyebrow label above a heading when it repeats the same words. One heading at the correct hierarchy level per section.
- **Gold interactive primary; Blue brand secondary**: Gold `#DEAC4B` (`--color-primary`) owns CTAs, active nav tint, charts, focus rings. Blue `#34418F` (`--color-brand`) owns logo, selected headings, structural accents. Do not reuse `--color-primary` for blue.
- **AppShell chrome**: Desktop left sidebar; mobile slim top bar + bottom tabs. Marketing, auth, and public surfaces stay outside the shell.
- **Dropped gelolaus chrome**: No custom cursor, no fixed 120px body dot grid, no mica/pill-glass, no floating pill nav.

---

## 2. UI writing rules

UI text is part of the design system. Agents and contributors editing headings, labels, empty states, toasts, errors, or marketing-facing copy in eypi.cc must follow these rules. Full banned-word lists live in the no-ai-slop skill; this section is the product subset required inside eypi.cc.

### Prose rules

1. **No em dashes** in UI strings or design-system prose. Use a period, comma, colon, semicolon, or parentheses.
2. **No hollow intensifiers** (`seamless`, `robust`, `powerful`, `delightful`, `significantly`, etc.). If a claim needs a number or token, state the number or token; otherwise cut the word.
3. **No marketing filler** in product UI: no "In today's…", "It's important to note", "effortlessly", "unlock", "elevate". Open on the fact the user needs.
4. **Headings name the screen or section**; they do not tease. Use `Organization settings`, not `Take control of your org`.
5. **One job per line**: If a subtitle, eyebrow, helper, or card footer only restates a heading or control, remove it.
6. **Empty states and errors state the next action**, not mood. Wrong: `Something went wrong.` Right: `Could not save link. Check the URL and try again.`
7. **Loading labels stay uppercase data voice** where already specified (`PROCESSING...`, `SAVING...`, `ENCRYPTING...`); do not rewrite those into soft marketing phrases.
8. **When adding prose to this design system**, use checkable facts only; update tokens and examples when the product changes.

### Concision rules

Every heading, subtitle, label, or helper line must carry information the surrounding UI does not already convey. If a line only restates a heading, a control, or another line nearby, cut it.

- One heading per section; no eyebrow labels that duplicate the heading below them.
- No subtitles that restate what tabs, cards, or form fields already show.
- No helper text under links or buttons that repeat what the destination page says.
- No card footers or CTAs that only say "open this" when the card is already clickable.
- Keep instructional copy when it explains non-obvious behavior (format rules, consequences, empty-state next steps).

Use `.text-eyebrow` only when the label adds context the heading cannot (breadcrumbs, status chips, scroll cues). Never duplicate the heading text in miniature above it.

### Cut-copy examples (this codebase)

| Before (cut) | After |
|---|---|
| Dashboard card footer: `Launch ->` on every module card | *(removed; cards are already clickable launchers)* |
| OrgSwitcher dropdown header: `Switch organization` | *(removed; org list is self-evident)* |
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

---

## 3. Color system

### Design token map (CSS custom properties)

Defined on `:root` and overridden on `html.dark`. Source of truth for locked values: `src/lib/ui/tokens.ts`. Components must use these tokens (or Tailwind `g-*` maps), not hard-coded hex, except where noted below.

| Token | Light (warm paper) | Dark (navy-ink) | Usage |
|---|---|---|---|
| `--color-bg` | `#F5F1EA` | `#0A0E18` | Page background |
| `--color-surface` | `#FFFCF7` | `#121826` | Card / panel / dropdown fills |
| `--color-border` | `#E5DFD4` | `rgba(255, 255, 255, 0.10)` | Border strokes |
| `--color-text` | `#14110F` | `#F4F1EA` | Primary body text |
| `--color-text-muted` | `#6F675C` | `#A39E94` | Secondary / caption text |
| `--color-primary` | `#DEAC4B` | `#DEAC4B` | Interactive primary (gold). CTAs, active nav, charts, ring. |
| `--color-primary-fg` | `#1A1408` | `#1A1408` | Text/icons on gold fills |
| `--color-brand` | `#34418F` | `#34418F` | Brand secondary (blue). Logo, selected headings, structural accents. |
| `--color-destructive` | `#DC2626` | `#F87171` | Danger actions |
| `--color-ring` | gold mix 55% | gold mix 55% | Focus rings |
| `--radius` | `0.875rem` | `0.875rem` | Base radius |

Tailwind maps: `g-bg`, `g-surface`, `g-border`, `g-text`, `g-muted`, `g-primary`, `g-primary-fg`, `g-brand`, `g-accent` (alias of primary), `g-destructive`.

**Role flip note:** Older gelolaus docs used `--color-primary` for Blue and `--color-accent` for Gold. Current system inverts the interactive role: Gold is primary; Blue is brand.

### Extended brand palette

| Name | Hex | Usage |
|---|---|---|
| APC Blue | `#34418F` | Logo, brand headings, structural accents (`g-brand`) |
| APC Gold (default) | `#DEAC4B` | Primary actions, active nav tint, charts |
| APC Gold (dark hover) | `#c9a84c` | Optional darker gold (`eypi-gold-dark`) |
| APC Gold (hover) | `#d4b55a` | Optional hover gold (`eypi-gold-hover`) |
| Danger | `#DC2626` / dark `#F87171` | Destructive actions |

### Semantic status colors

| Status | Color | Usage |
|---|---|---|
| Success | `#10b981` (emerald-500) | Toast accent bars |
| Error | `#ef4444` (red-500) | Toast accent bars, delete confirm |
| Info | `#34418F` (APC Blue) | Info toast accent |
| Analytics | Gold / `#c9a84c` | Chart bars (gold owns charts) |

### Surfaces

**Light (warm paper)**

- Background: warm off-white `#F5F1EA`
- Cards: soft warm white `#FFFCF7`
- Borders: soft warm gray `#E5DFD4`
- Text: near-black `#14110F`; muted brown-gray `#6F675C`

**Dark (navy-ink)**

- Background: deep navy-ink `#0A0E18`
- Cards: slightly lighter `#121826`; optional `.glass-panel` via token mix
- Borders: soft light strokes ~10% white
- Text: off-white `#F4F1EA`; muted `#A39E94`

### Dark mode mechanism

Toggle class `dark` on `<html>`. Preference stored in `localStorage` under `eypi_dark_mode` (`useDarkMode` / `ThemeToggle`). Default is light when unset.

`body` transitions `background-color` and `color` over `0.3s ease` on mode change.

---

## 4. Typography scale

### Font families

| Role | Family | Fallback | Usage |
|---|---|---|---|
| Display / headings | `Syne` | `ui-sans-serif, sans-serif` | Page titles, marketing brand, H1–H3 (`.font-display`) |
| UI / body | `Plus Jakarta Sans` | `system-ui, sans-serif` | Nav, buttons, forms, body, labels (`font-sans`) |
| Data | System mono / tabular | `ui-monospace, SFMono-Regular, Menlo, monospace` | Slugs, codes, timestamps, table numbers (`.text-data` / `font-mono`) |

Loaded via Google Fonts in `index.html`. Geist is not part of this system.

### Typography utility classes

| Class | Usage |
|---|---|
| `.text-page-title` | Top-level page headings (h1); Syne; brand blue in light, text color in dark |
| `.text-section-title` | Section headings (h2); Syne |
| `.text-card-title` | Card and list item titles; Plus Jakarta Sans |
| `.text-data` | Monospace / tabular data values |
| `.text-eyebrow` | Rare contextual labels only; not duplicate headings |

### Heading scale

| Element | Class / Size | Weight |
|---|---|---|
| Page title | `.text-page-title` / `clamp(2rem, 5vw, 3.5rem)` | 700 |
| Section title | `.text-section-title` / `clamp(1.25rem, 2.5vw, 1.75rem)` | 600 |
| Card title | `.text-card-title` / `1.125rem` | 600 |

**Data scale** (use `.text-data` or `font-mono` only for): link slugs, table data cells, timestamps, codes.

**Form labels**: `text-sm font-medium text-g-muted` in Plus Jakarta Sans; normal case.

### Responsive typography

Large display text uses `clamp(minimum, preferred-vw, maximum)`. No fluid-type library.

---

## 5. Spacing and layout

### Shape and density

Copied from Wantap's friendly UI scale:

- Base radius `--radius: 0.875rem`; larger radii for section cards; pills (`rounded-full`) for primary CTAs
- Default Button/Input height `h-11` / `text-base`; large CTA `h-12`; compact `h-9`
- Section cards padded `p-7`–`p-8` (`Card` primitive)
- Content pane near full width (`max-w-5xl` / `max-w-6xl` or fluid), not narrow `max-w-2xl` by default
- Bottom tabs: icon above label; gold active state; `env(safe-area-inset-bottom)`

### Grid and max-widths

| Zone | Max-Width | Notes |
|---|---|---|
| AppShell content | fluid inside shell | Sidebar ~14rem (`w-56`); dense rail `w-16` |
| Marketing / legal content | `max-w-5xl` | Centered |
| Auth panel | `max-w-md` (~448px) | Quiet bordered panel |
| Settings content | `max-w-5xl` | Inside AppShell |
| Analytics panel | `max-w-2xl` / `95vw` | Right-anchored slide panel |
| Footer inner | `max-w-5xl` | Theme-aware footer (not always-dark) |

### Breakpoints

| Name | Min-width | Shell behavior |
|---|---|---|
| `< lg` (`1024px`) | — | Slim top bar + fixed bottom tab bar |
| `lg+` | `1024px` | Left sidebar; icon-only rail on dense editors |

Tailwind defaults otherwise: `sm` 640px, `md` 768px, `xl` 1280px, `2xl` 1536px.

### Chrome outside AppShell

Marketing `/`, auth, public Frames/Tix/Orgs, legal pages: no bottom tabs. Use `MarketingHeader` or `PublicHeader` plus content; footer on marketing surfaces.

---

## 6. Component anatomy

### 6.1 AppShell and navigation

`AppShell` (`src/components/layout/AppShell.vue`) is the authenticated suite chrome.

**Desktop (`lg+`)**

- Left sidebar ~14–15rem (`w-56`); dense editors may use icon-only rail (`w-16`)
- Logo: Syne, `text-g-text`
- Nav from `resolveAppNav`: always Home + Links; when org membership is activated, add Orgs / Forms / Frames / Tix
- Active item: gold wash `bg-g-primary/15` with gold icon
- Account menu + org switcher in sidebar footer

**Mobile / tablet (`< lg`)**

- Slim top bar: logo, theme toggle, account
- Fixed bottom tab bar: max 4–5 slots; Home + Links always; org destinations via **Org tools** sheet (`OrgToolsSheet`)
- Safe area: `env(safe-area-inset-bottom)`

**Account**

- Avatar menu: Settings, theme, sign out
- Org switcher near account; same `active_org_id` behavior as the API `X-Active-Org-Id` header

Nav resolution lives in `src/components/layout/app-nav.ts`.

### 6.2 Primitive kit (`src/components/ui/`)

Encode Wantap parity before view-level one-offs:

| Primitive | Notes |
|---|---|
| `Button` | `primary` / `secondary` / `ghost` / `destructive`; sizes `sm` / `default` / `lg`; variants in `buttonVariants.ts` |
| `Input`, `Textarea`, `Select` | Shared field classes (`fieldClasses.ts`); `h-11`, `rounded-xl`, gold ring |
| `Card` | `rounded-2xl border bg-g-surface p-7 md:p-8` |
| `Dialog` | Used by `DialogHost` for info / confirm |
| `Switch` | Gold track when checked (`switchClasses.ts`) |
| `Badge`, `Tabs`, `Avatar`, `EmptyState` | Shared suite grammar |
| `ThemeToggle` | Persists `eypi_dark_mode` |

Prefer importing the kit. Do not invent a second parallel style path.

### 6.3 Buttons

| Variant | Treatment |
|---|---|
| Primary | Gold fill `bg-g-primary`, ink text `text-g-primary-fg`, `rounded-full`, hover `brightness-110` |
| Secondary | Transparent, `border-g-border`, hover `bg-g-bg` |
| Ghost | Transparent muted text; hover text + wash |
| Destructive | `bg-g-destructive` white text |

Heights: `h-9` (sm), `h-11` (default), `h-12` (lg). Loading: reduce opacity; uppercase data labels where already specified.

### 6.4 Inputs

Standard field:

```
h-11 w-full rounded-xl
border border-g-border bg-g-surface
px-4 text-base text-g-text
focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]
```

Textareas use the same border/radius/ring with `min-h-[6rem]` and `py-3`.

### 6.5 Cards and glass

**Section card** (`Card`): opaque `g-surface`, border `g-border`, radius `rounded-2xl`, padding `p-7`/`p-8`.

**Glass panel** (`.glass-panel`): translucent surface mix + `backdrop-filter: blur(16px)` + token border. Prefer tokens over hard-coded rgba glass.

No mica-card / pill-glass classes.

### 6.6 Dialogs and feedback

**DialogHost** (z-index `10000`): info and confirm via `useDialog()`.

- Info: full-width primary (gold) CTA
- Confirm: secondary abort + destructive confirm; optional `requireText`
- Esc / backdrop aborts (info dismisses). Focus trap; restore focus to opener.
- API: `useDialog().info(...)`, `useDialog().confirm(...)`
- Do not use `window.confirm()` or `alert()` for product feedback

**Signal strip toast** (`ToastContainer`, z `9999`):

- Bottom-right stack; cap 3; dedup by type + message
- `bg-g-surface`, border `g-border`, sentence-case message + mono tag (`OK` / `ERR` / `INFO`)
- Durations: success/info 4s, error 7s
- API: `useToast().success|error|info(...)`

### 6.7 Marketing and auth

**Marketing `/`**

1. `MarketingHeader`: logo + Log in + Get started (gold) + theme toggle
2. Hero: dominant eypi brand, one headline, one support line, CTA group, product mock
3. One proof section
4. Final CTA band + footer

No stats strip, features carousel, or multi-section "why" dump.

**Auth**

Quiet bordered panel; low-opacity warm gold wash (no blue glow orb); Syne title; large controls. Keep APC email auth flows (login, verify, reset).

### 6.8 Scroll-top and loader

**ScrollTop**: fixed bottom-right utility; appears after scroll threshold; gold hover.

**AppLoader**: fullscreen splash; Syne `eypi.cc` with brand-blue wordmark and gold dot; auto-dismiss ~1.4s.

---

## 7. Motion and interaction

### 7.1 Easing curves

| Name | Cubic Bezier | Primary use |
|---|---|---|
| Spring Out | `cubic-bezier(0.16, 1, 0.3, 1)` | Scroll reveals, loader, soft chrome |
| Quick In-Out | `cubic-bezier(0.2, 1, 0.3, 1)` | Slide panels, toasts |
| Heavy Cinematic | `cubic-bezier(0.76, 0, 0.24, 1)` | Page transition wipe |
| Linear ease | `ease` | Color/opacity micro-transitions |

### 7.2 Scroll reveal

`.reveal` starts at `opacity: 0; translateY(28px)` and becomes `.is-visible` via IntersectionObserver. Stagger with `.delay-1` … `.delay-4`. Prefer 2–3 intentional moves per marketing composition, not noise.

### 7.3 Page transition wipe

Authenticated login wipe (`AppTransition`): full-screen `clip-path` circle expand over ~600ms. Prefer brand/primary fill from tokens.

### 7.4 Shell chrome

Short ease transitions on sidebar, bottom tabs, and Org tools sheet. No custom cursor theater. Native OS pointer always.

### 7.5 Slide panels

Analytics / editors: backdrop fade `0.3s ease`; panel `translateX(100%) → 0` over `0.4s` Quick In-Out.

### 7.6 Hover and press

- `.tap-scale:active` → `scale: 0.96`
- Fine-pointer link hover opacity softens slightly
- Primary buttons: brightness / subtle lift via kit classes
- Scroll-top: slight lift + scale on hover

### 7.7 Loading

`animate-pulse` placeholders while fetching. Buttons in loading state use reduced opacity (and pulse where already specified).

### 7.8 Theme toggle

`ThemeToggle` swaps Moon/Sun. Page-wide color shift uses the `body` token transition (`0.3s ease`).

---

## 8. Accessibility (a11y)

### Focus management

Visible focus rings site-wide:

```css
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 0.5rem;
}
```

Kit controls also use `focus-visible:ring-2` with `--color-ring`. Skip-to-content link is first focusable (`href="#app-content"`).

### Reduced motion

`@media (prefers-reduced-motion: reduce)` disables or shortens scroll reveal, slide-over transitions, page wipe, and animation loops.

### Live regions

Toasts use `aria-live` (`polite` / `assertive` for errors) and `role="status"`.

### ARIA patterns in use

| Element | Attribute | Value |
|---|---|---|
| AppShell nav | `aria-label` | `"App"` / bottom tab labels |
| Backdrop overlays | `aria-hidden` | `"true"` |
| Loader / page transition | `aria-hidden` | `"true"` |
| Icon buttons | `aria-label` | Action name (`Copy link`, `Close`, …) |
| Theme toggle | `aria-label` | Dark mode control |
| Scroll-top | `aria-label` | `"Back to top"` |
| Footer nav | `aria-label` | `"Footer"` |

### Color contrast

| Pairing | Notes |
|---|---|
| `#14110F` on `#F5F1EA` | Body text, light |
| `#F4F1EA` on `#0A0E18` | Body text, dark |
| `#1A1408` on `#DEAC4B` | Primary button label on gold |
| `#6F675C` on `#F5F1EA` | Muted text, light |

Verify gold-on-fill and brand-blue headings in both themes when changing tokens.

### Text selection

```css
::selection {
  background-color: #DEAC4B;
  color: #1A1408;
}
```

---

## 9. Z-index architecture

| Layer | Z-Index | Element |
|---|---|---|
| Page content | `10` / flow | `<main>` / AppShell content |
| Footer | flow | `<footer>` |
| Mobile top bar | `40` | AppShell sticky header |
| Bottom tabs / org sheet | shell local | AppShell mobile chrome |
| Scroll-top button | `9998` | Fixed utility |
| Toast container | `9999` | Signal strip |
| DialogHost | `10000` | Info / Confirm |
| Skip link (focused) | `100000` | Accessibility |
| Slide panel backdrop | `99990` | Teleported overlay |
| Slide panel | `99991` | Teleported panel |
| Page transition wipe | `99997` | Full-screen clip-path |
| Page load splash | `99998` | AppLoader |

---

## Appendix: Common pattern snippets

### Primary Button (kit)

```ts
buttonVariants({ variant: 'primary', size: 'default' })
// bg-g-primary text-g-primary-fg h-11 rounded-full
```

### Section Card (kit)

```vue
<Card>
  <!-- p-7 md:p-8 rounded-2xl border-g-border bg-g-surface -->
</Card>
```

### Glass panel

```css
.glass-panel {
  background-color: color-mix(in srgb, var(--color-surface) 88%, transparent);
  backdrop-filter: blur(16px);
  border: 1px solid var(--color-border);
}
```

### Scroll reveal

```css
.reveal { opacity: 0; transform: translateY(28px); }
.reveal.is-visible { opacity: 1; transform: translateY(0); }
```
