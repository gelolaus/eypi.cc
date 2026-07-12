# eypi.cc Design System
**gelolaus design language. Production specification.**

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

**eypi.cc** is a URL shortener for the Asia Pacific College (APC) student community.

| Source | What it owns |
|---|---|
| **APC (Asia Pacific College)** | Brand colors: APC Blue `#34418F` (`--color-primary`), APC Gold `#DEAC4B` (`--color-accent`), and the gold hover variants listed in §3. These are APC brand colors, not gelolaus.com brand marks. |
| **gelolaus design language** | How eypi.cc is built: Geist / Geist Mono roles, light-default theme, fixed 120px dot grid, mica and pill glass surfaces, one heading per section, motion curves, z-index stack, UI copy rules in §2. gelolaus applies APC colors; it does not own them. |
| **eypi.cc** | The product: URL shortener and related modules for the APC student community. |

### Visual rules

- **Light and dark text pairs**: Light mode uses `#0A0A0A` on `#F5F5F5`. Dark mode uses `#F5F5F5` on `#000000`.
- **Geist for UI copy; Geist Mono for data**: `Geist` for headings, body, nav, buttons, and form labels. `Geist Mono` for slugs, codes, timestamps, and table numerics only.
- **One heading per section**: No eyebrow label above a heading when it repeats the same words. One heading at the correct hierarchy level per section.
- **APC Gold accent; APC Blue primary**: Accent is APC Gold `#DEAC4B` (`--color-accent`) for CTAs, hovers, and selection. Primary actions and focus borders use APC Blue `#34418F` (`--color-primary`). No third accent color.
- **Dot grid**: `.bg-dot-grid` uses `radial-gradient` dots, `background-size: 120px 120px`, `background-attachment: fixed`.
- **Glass surfaces**: `.mica-card` and `.pill-nav` use `backdrop-filter` blur (16px on cards, 20px on nav) over semi-transparent fills.
- **Pill navigation**: Fixed `.pill-nav-wrapper` at `top: 16px`. Hides on scroll down via `.pill-nav--hidden` (`translateY(-80px)`, `opacity: 0`).

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

These tokens are defined on `:root` and overridden on `html.dark`. Component-level colors must reference these variables, not hard-coded hex values, except where noted below.

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--color-bg` | `#F5F5F5` | `#000000` | Page background (dot grid base) |
| `--color-surface` | `#ffffff` | `#161616` | Card / panel / dropdown fills |
| `--color-border` | `#E8E8E8` | `#262626` | All border strokes |
| `--color-text` | `#0A0A0A` | `#F5F5F5` | Primary body text |
| `--color-text-muted` | `#6B6B6B` | `#AAAAAA` | Secondary / caption text |
| `--color-accent` | `#DEAC4B` | `#DEAC4B` | APC Gold accent. Same hex in light and dark. |
| `--color-primary` | `#34418F` | `#34418F` | APC Blue. Same hex in light and dark. |
| `--color-dot` | `#000000` | `#ffffff` | Dot grid dot fill |

### Extended brand palette (hard-coded where appropriate)

APC Blue and APC Gold below are APC brand colors applied by the gelolaus system. They are not gelolaus.com brand marks.

These values appear directly in components where the intent is to override the theme-aware system:

| Name | Hex | Usage |
|---|---|---|
| APC Blue | `#34418F` | Logo text, h1, headings, border-focus, primary actions |
| APC Gold (default) | `#DEAC4B` | CTAs, accent, selection, cursor states |
| APC Gold (dark hover) | `#c9a84c` | Dark mode button variant, progress bars |
| APC Gold (hover) | `#d4b55a` | Dark mode button hover |
| Footer BG | `#040d1f` | Always-dark footer; theme class does not change it |
| Footer Border | `#1a1a1a` / `#1f1f1f` | Footer section separators |
| Footer Text | `#F5F5F5` | Always light on dark footer |
| Footer Muted | `#444444` | Footer bottom-bar labels |
| Danger | `#dc2626` | Destructive actions (logout, delete) |
| Danger Hover BG | `rgba(220, 38, 38, 0.06)` | Danger item hover wash |
| Danger Solid | `#ef4444` / hover `#dc2626` | Delete confirmation button |

### Semantic status colors

| Status | Color | Usage |
|---|---|---|
| Success | `#10b981` (emerald-500) | Toast accent bar, copy button |
| Error | `#ef4444` (red-500) | Toast accent bar, delete modal |
| Info | `#34418F` (APC Blue) | Info toast accent bar |
| Analytics | `#c9a84c` | Progress bars in analytics panel |

### Glassmorphism (mica) layer palette

The `mica-navy` scale is used on dashboard and settings views (glass surfaces over the dot grid):

| Token | Value | Usage |
|---|---|---|
| `mica-navy.DEFAULT` | `rgba(15, 23, 42, 0.25)` | Standard glass card |
| `mica-navy.input` | `rgba(15, 23, 42, 0.20)` | Input field fill (dark mode) |
| `mica-navy.card` | `rgba(15, 23, 42, 0.60)` | Dense card |
| `mica-navy.row` | `rgba(15, 23, 42, 0.15)` | Table row (dark) |
| `mica-navy.row-hover` | `rgba(15, 23, 42, 0.25)` | Table row hover (dark) |
| `mica-navy.header` | `rgba(15, 23, 42, 0.90)` | Table header (dark) |
| `mica-navy.panel` | `rgba(15, 23, 42, 0.92)` | Slide-out panel bg (dark) |
| `mica-navy.modal` | `rgba(15, 23, 42, 0.95)` | Modal bg (dark) |

**.mica-card** (light mode)
```
background-color: rgba(255, 255, 255, 0.35)
backdrop-filter: blur(16px) saturate(150%)
border: 1px solid rgba(255, 255, 255, 0.60)
box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07)
```

**.mica-card** (dark mode)
```
background-color: rgba(15, 23, 42, 0.25)
border: 1px solid rgba(51, 65, 85, 0.50)
box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.20)
```

### Dark mode mechanism

Dark mode is toggled by adding or removing the class `dark` on `<html>`. No `prefers-color-scheme` media query is used; the user's preference is stored in `localStorage` under the key `eypi_dark_mode`. Default is light mode.

`body` transitions `background-color` and `color` over `0.3s ease` on mode change:
```css
body {
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

---

## 4. Typography scale

### Font families

| Role | Family | Fallback | Usage |
|---|---|---|---|
| Sans (default) | `Geist` | `system-ui, sans-serif` | Headings, body, nav, buttons, form labels |
| Mono (data only) | `Geist Mono` | `monospace` | Slugs, codes, timestamps, table data, stat numbers |

### Typography utility classes

| Class | Usage |
|---|---|
| `.text-page-title` | Top-level page headings (h1) |
| `.text-section-title` | Section headings (h2) |
| `.text-card-title` | Card and list item titles |
| `.text-data` | Monospace data values |
| `.text-eyebrow` | Rare contextual labels only; not duplicate headings |

### Typographic rules by context

**Heading scale** (all use `font-family: Geist` sans):

| Element | Class / Size | Weight |
|---|---|---|
| Page title | `.text-page-title` / `clamp(2rem, 5vw, 3.5rem)` | 700 |
| Section title | `.text-section-title` / `clamp(1.25rem, 2.5vw, 1.75rem)` | 600 |
| Card title | `.text-card-title` / `1.125rem` | 600 |
| Hero | `.text-page-title` / larger clamp | 700 |

**Data scale** (use `.text-data` or `font-mono` only for):

| Context | Usage |
|---|---|
| Link slugs | `eypi.cc/abc123` |
| Table data cells | URLs, click counts |
| Timestamps | Event dates, created_at |
| Codes | 404 codes, verification tokens |

**Form labels**: `text-sm font-medium text-g-muted` in sans; normal case, no wide tracking.

### Responsive typography strategy

The site uses `clamp()` for all large display text. The clamp formula follows the pattern:
```
clamp(minimum, preferred-vw, maximum)
```

No fluid-type library. Clamp midpoints are hand-authored in the `3vw` to `8vw` range so maxima land near `1100px` to `1400px` viewports.

---

## 5. Spacing and layout

### Grid and max-widths

| Zone | Max-Width | Notes |
|---|---|---|
| Pill nav wrapper | `min(92vw, 1100px)` | Centered, floats 16px from top |
| Hero / main content | `max-w-5xl` (1024px) | Centered with `auto` margins |
| Dashboard content | `max-w-5xl` (1024px) | Centered |
| Login / auth card | `max-w-md` (448px) | Centered within full-screen |
| Settings panel | `max-w-xl` (576px) | Centered |
| Footer inner | `max-width: 87.5rem` (1400px) | `1400px` max content width |
| Analytics panel | `max-w-2xl` (672px) on md+, `95vw` on mobile | Right-anchored slide panel |
| Edit sidebar | `max-w-md` (448px) | Right-anchored slide panel |

### Padding tokens (Tailwind utilities plus custom values)

| Context | Value |
|---|---|
| Pill nav internal padding | `0.5rem 1.25rem` (8px × 20px) |
| Pill nav top offset | `16px` from viewport top |
| Main content top padding | `5rem` (80px, pt-20) compensates for fixed nav |
| Hero section padding | `1.5rem` sides; `3rem` to `6rem` vertical |
| Card inner padding | `2rem` (p-8, 32px) |
| Card inner padding (lg) | `3rem` (p-12, 48px) on settings |
| Footer inner padding | `clamp(4rem, 8vw, 6rem)` top; `clamp(1.5rem, 6vw, 6rem)` sides; `clamp(2.5rem, 5vw, 4rem)` bottom |
| Toast position | `1.5rem` from bottom and right edges |
| Scroll-top button | `2rem` from bottom and right |

### Breakpoints

Tailwind default breakpoints; no custom additions:

| Name | Min-width | Notes |
|---|---|---|
| `sm` | `640px` | 404 page card padding increase |
| `md` | `768px` | Form layout switches col→row; dashboard padding, analytics panel max-width |
| `lg` | `1024px` | Hero monitor height increase |
| `xl` | `1280px` | Not explicitly used |
| `2xl` | `1536px` | Not explicitly used |

### Dot grid background

```css
.bg-dot-grid {
  background-color: var(--color-bg);
  background-image: radial-gradient(circle, var(--color-dot) 1.5px, transparent 1.5px);
  background-size: 120px 120px;
  background-attachment: fixed;  /* fixed attachment; grid does not scroll with content */
}

.bg-dot-grid-dark {  /* Footer: always dark regardless of theme */
  background-color: #040d1f;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.28) 1.5px, transparent 1.5px);
  background-size: 120px 120px;
  background-attachment: fixed;
}
```

---

## 6. Component anatomy

### 6.1 Pill navigation (TheHeader)

Fixed-position pill with frosted glass (`.pill-nav`).

**Outer wrapper** (`.pill-nav-wrapper`):
```css
position: fixed;
top: 16px;
left: 50%;
transform: translateX(-50%);
z-index: 9990;
width: min(92vw, 1100px);
transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease;
```

**Hidden state** (`.pill-nav--hidden`), triggered on scroll down:
```css
transform: translateX(-50%) translateY(-80px);
opacity: 0;
pointer-events: none;
```
Scroll logic: hides when `scrollY > lastScrollY && scrollY >= 50`; shows when scrolling up or `scrollY < 50`.

**Pill container** (`.pill-nav`):
```
display: flex; align-items: center; justify-content: space-between; gap: 1rem;
padding: 0.5rem 1.25rem;
border-radius: 9999px;            /* Full pill */
border: 1px solid var(--color-border);
background: rgba(245, 245, 245, 0.82);   /* Light */
backdrop-filter: blur(20px) saturate(180%);
box-shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
```
Dark mode: `background: rgba(22, 22, 22, 0.88); box-shadow: 0 2px 16px rgba(0,0,0,0.35);`

**Scrolled state** (`.pill-nav--scrolled .pill-nav`):
```
box-shadow: 0 4px 28px rgba(0, 0, 0, 0.10);
Dark: box-shadow: 0 4px 28px rgba(0, 0, 0, 0.50);
```

**Logo** (`.pill-nav__logo`):
- Font: Geist Mono, 15px, weight 700
- Color: `var(--color-primary)` (light) / `var(--color-text)` (dark)
- Hover: `var(--color-accent)`
- Transition: `color 0.2s ease`

**Nav links** (`.pill-nav__link`):
- Font: Geist, 13px, weight 500
- Color: `var(--color-text-muted)` → hover `var(--color-text)`
- Transition: `color 0.2s ease`

**CTA button** (`.pill-nav__cta`):
- Font: Geist, 13px, weight 600
- Padding: `0.35rem 0.875rem`
- Border-radius: `9999px`
- Background: `var(--color-accent)` (#DEAC4B), white text
- Hover: `opacity: 0.88; transform: translateY(-1px)`
- Transition: `opacity 0.2s ease, transform 0.15s ease`

**Dark mode toggle** (`.pill-nav__toggle`):
- Size: `30px × 30px`, border-radius `9999px`
- Border: `1px solid var(--color-border)`
- Background: transparent → surface on hover
- Border-color: `var(--color-text)` on hover
- Icon size: `14px × 14px` (h-3.5 w-3.5)

**User dropdown** (`.pill-nav__dropdown`):
- Position: `absolute; top: calc(100% + 10px); right: 0;`
- Width: `min-width: 210px`
- Border-radius: `1rem`
- Background: `var(--color-surface)`
- Box-shadow: `0 8px 32px rgba(0,0,0,0.12)`; dark `0 8px 32px rgba(0,0,0,0.45)`

---

### 6.2 Buttons

Three button variants:

**Primary CTA Button** (gold-filled):
```
background: #DEAC4B
color: #ffffff
font-family: Geist (Mono in dashboard/settings)
font-weight: 700 (bold)
font-size: 0.8125rem to 1.25rem (context-dependent)
text-transform: uppercase
letter-spacing: 0.05em to 0.1em
border-radius: 9999px (nav CTA) / 0.75rem to 0.875rem (form buttons)
padding: 0.35rem 0.875rem (nav) / 1rem 2rem (hero) / 0.75rem 1rem (auth)
```

States:
- **Hover**: `opacity: 0.88` or `hover:brightness-110` + `translateY(-0.5px to -1px)`
- **Active**: standard browser press
- **Disabled**: `opacity: 0.70; cursor: not-allowed` + `animate-pulse` (loading state)
- **Loading text**: label changes to `PROCESSING...` / `SAVING...` / `ENCRYPTING...`

**Ghost / Outline Button** (border only):
```
background: transparent
border: 2px solid var(--color-primary)   [or border-gray-200 for secondary]
color: var(--color-primary)
font-family: Geist Mono
font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em
border-radius: 0.5rem
```
Hover: `background: var(--color-primary); color: #ffffff`

**Icon Buttons** (dashboard table actions):
```
padding: 0.5rem (p-2)
border-radius: 9999px
background: transparent → gray-100 on hover (dark: slate-600/30)
transition: color 0.15s ease
```
Colors by action: Copy (gray), Analytics (emerald), Edit (blue/sky), Delete (red).

**Toggle Button** (Login/Register tabs):
- Active: `background: #34418F; color: white`
- Inactive: `background: transparent; color: gray-400` → hover `color: #34418F`
- Border-radius: `0.5rem`; Transition: `color 0.2s ease, background 0.2s ease`

---

### 6.3 Input fields

Two size variants:

**Hero Input** (large, landing page):
```
border: 2px solid #D1D5DB (gray-300)
border-radius: 1rem (rounded-2xl)
padding: 1.25rem 1.75rem (px-7 py-5)
font-size: 1.25rem (text-xl)
font-family: Geist Mono (implied)
background: #ffffff
color: #0f172a (slate-900)
```
Focus: `border-color: #34418F`
Dark: `border: slate-600; background: slate-900; focus: slate-500`

**Standard Input** (auth, dashboard, settings):
```
border: 2px solid #E5E7EB (gray-200)
border-radius: 0.5rem (rounded-lg)
padding: 0.75rem 1rem (px-4 py-3)
font-size: 0.875rem
font-family: Geist Mono
background: rgba(255,255,255,0.5)  [auth] / #F9FAFB (gray-50)  [settings]
```
Focus: `border-color: #34418F; background: #ffffff`
Dark: `background: rgba(15,23,42,0.20); border: slate-600; focus: slate-500`

**Prefixed Input** (slug editor in sidebar):
```
/* Wrapper: */
border: 2px solid gray-200
border-radius: 0.5rem
padding: 0.75rem 1rem
focus-within: border-color: #34418F

/* Prefix span: */
font-family: Geist Mono; font-weight: 700; color: #34418F; flex-shrink: 0

/* Inner input: */
background: transparent; border: none; outline: none; flex: 1
```

**Select Elements**: Same border/radius/font as standard input. Focus: `border-color: #34418F`.

---

### 6.4 Cards and containers

**Glassmorphism Card** (`.mica-card`):
```
Light:
  background: rgba(255, 255, 255, 0.35)
  backdrop-filter: blur(16px) saturate(150%)
  border: 1px solid rgba(255, 255, 255, 0.60)
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.07)

Dark:
  background: rgba(15, 23, 42, 0.25)
  border: 1px solid rgba(51, 65, 85, 0.50)
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.20)
```
All glassmorphism cards use `border-radius: 1.5rem` (rounded-3xl, 24px).

**Hardware Card motif** (corner screws):
Four `8px × 8px` circles positioned at each corner (3px inset):
```
position: absolute; [top|bottom]: 3px; [left|right]: 3px;
width: 8px; height: 8px;
border-radius: 50%;
background: #9CA3AF (gray-400);
box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
```
Present on: Login card, 404 card, Hero monitor widget.

**Settings Panel Card** (flat, not glass):
```
background: #ffffff; dark: rgba(15,23,42,0.60)
border: 1px solid #D1D5DB; dark: slate-600
box-shadow: 0 25px 50px rgba(0,0,0,0.25) (shadow-2xl)
padding: 2.5rem (p-10) / 3rem (p-12) on md+
border-radius: 0  /* settings panels; mica cards use 1.5rem */
```
Top accent bar: `height: 8px; background: #34418F; width: 100%; position: absolute; top: 0; left: 0;`

**Dashboard Table Container**:
```
border-radius: 1rem (rounded-2xl)
border: 1px solid gray-200 / slate-600
overflow: hidden
```
Row hover: `background: rgba(255,255,255,0.5)` (light) / `rgba(15,23,42,0.25)` (dark)
Row border: `1px solid gray-100` / `rgba(51,65,85,0.30)`

---

### 6.5 Modals and slide panels

**Backdrop** (shared pattern):
```
position: fixed; inset: 0;
background: rgba(0,0,0,0.20) (light) / rgba(15,23,42,0.80) (dark)
backdrop-filter: blur(4px)   /* Tailwind: backdrop-blur-sm */
```
Transition: `opacity 0.3s ease` (fade in/out)

**Slide-out Panel** (Edit Sidebar, Analytics Panel):
```
position: fixed; top: 0; right: 0;
height: 100%; overflow-y: auto;
border-left: 1px solid [border-color];
box-shadow: 0 25px 50px rgba(0,0,0,0.25) (shadow-2xl)
```
Panel widths: `max-w-md` (448px) for edit; `max-w-2xl` (672px) / `95vw` for analytics.
Slide direction: enters from `translateX(100%)`, exits to `translateX(100%)`.
Transition: `transform 0.4s cubic-bezier(0.2, 1, 0.3, 1)`.

**Delete Confirmation Modal** (centered):
```
position: fixed; inset: 0;
z-index: 9999;
display: flex; align-items: center; justify-content: center;
padding: 1rem;
```
Modal box: `max-width: 448px; border-radius: 1rem; overflow: hidden`
Danger stripe: `height: 8px; background: #ef4444; width: 100%` at top
Transition: `opacity 0.3s ease`

---

### 6.6 Toast notification system

Position: `fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999`
Stacks vertically (column direction) with `gap: 0.75rem` between toasts.

**Toast Card**:
```
width: 320px (w-80)
background: #ffffff; dark: rgba(15,23,42,0.95)
border: 1px solid #E5E7EB; dark: slate-600
box-shadow: 0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04) (shadow-xl)
padding: 1rem (p-4)
border-radius: 0
```
Left accent stripe: `position: absolute; left: 0; top: 0; bottom: 0; width: 4px; border-radius: 0`
- Success: `#10b981` (emerald-500)
- Error: `#ef4444` (red-500)
- Info: `#34418F` (APC Blue)

Text: `font-family: Geist Mono; font-size: 0.875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-left: 8px`

**Enter animation**: `opacity: 0 → 1; transform: translateY(20px) scale(0.95) → none`
**Exit animation**: `opacity: 0; transform: scale(0.95)`
Both: `transition: all 0.3s cubic-bezier(0.2, 1, 0.3, 1)`

---

### 6.7 Scroll-top button

```
position: fixed; bottom: 2rem; right: 2rem; z-index: 9998;
width: 44px; height: 44px;
border-radius: 9999px;
border: 1px solid var(--color-border);
background: var(--color-surface);
color: var(--color-text);
font-size: 1.1rem;
backdrop-filter: blur(12px);
box-shadow: 0 2px 12px rgba(0,0,0,0.06);
```
Appears when `window.scrollY > 300`.
Hover: `border-color: var(--color-accent); background: var(--color-accent); color: #ffffff; transform: translateY(-2px)`

---

### 6.8 Footer

The footer is always dark regardless of the current theme. It uses the `bg-dot-grid-dark` class.

**Heading** (`.footer-heading`):
```
font-family: Geist; font-weight: 700;
font-size: clamp(2.8rem, 8vw, 7rem);
line-height: 0.95;
color: #F5F5F5;
letter-spacing: -0.04em;
margin-bottom: clamp(3rem, 6vw, 5rem);
max-width: 900px;
```

**Link Rows** (`.footer-link-row`): Full-width stacked rows with top border `#1f1f1f` and clamp type sizes:
```
display: flex; align-items: center; justify-content: space-between;
padding: clamp(1.1rem, 2.5vw, 1.75rem) 0;
border-top: 1px solid #1f1f1f;
font-size: clamp(1.2rem, 3vw, 2rem);
font-weight: 500; letter-spacing: -0.03em;
color: #F5F5F5;
transition: color 0.22s ease;
```
Hover: `color: #DEAC4B` (APC Gold)
Arrow: `font-size: 0.85em; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)`
Arrow hover: `translate(4px, -4px)`.

---

## 7. Motion and interaction

### 7.1 Easing curves

Four easing curves:

| Name | Cubic Bezier | Behavior | Primary Use |
|---|---|---|---|
| **Spring Out** | `cubic-bezier(0.16, 1, 0.3, 1)` | Fast start, long deceleration | Scroll reveals, pill nav transitions, cursor size, footer arrow |
| **Quick In-Out** | `cubic-bezier(0.2, 1, 0.3, 1)` | Slightly slower ease-in than Spring Out | Slide panels, toast notifications |
| **Heavy Cinematic** | `cubic-bezier(0.76, 0, 0.24, 1)` | Slow in and slow out | Page transition wipe (`clip-path` expand, `0.6s`) |
| **Linear ease** | `ease` | Standard browser ease | Color/opacity micro-transitions |

### 7.2 Scroll reveal system

Elements marked with `.reveal` are hidden by default and revealed by an `IntersectionObserver`.

**Initial state** (`.reveal`):
```css
opacity: 0;
transform: translateY(28px);
transition:
  opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1),
  transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);
```

**Revealed state** (`.reveal.is-visible`, added by JS):
```css
opacity: 1;
transform: translateY(0);
```

**Staggered delays** (applied manually via class):
```
.delay-1 → transition-delay: 0.12s
.delay-2 → transition-delay: 0.24s
.delay-3 → transition-delay: 0.36s
.delay-4 → transition-delay: 0.48s
```

**Observer config**: `{ threshold: 0.10, rootMargin: '0px 0px -40px 0px' }`. Elements trigger 40px before they reach the bottom of the viewport. Once revealed, they are `unobserved` (fire-once, not bi-directional).

### 7.3 Page transition wipe

Triggered on authenticated login before router push. A full-screen `clip-path` animation:

```css
/* Initial state (inactive) */
.app-transition {
  position: fixed; inset: 0;
  z-index: 99997;
  background-color: var(--color-primary);   /* APC Blue wipe */
  clip-path: circle(0% at 50% 50%);        /* Collapsed to a point at center */
  pointer-events: none;
}

/* Expanding state */
.app-transition--expanding {
  clip-path: circle(150% at 50% 50%);      /* Expands beyond all four corners */
  transition: clip-path 0.6s cubic-bezier(0.76, 0, 0.24, 1);
}
```

**Timing sequence**:
1. Element becomes visible (2 rAF delay for render)
2. `clip-path` expands over `600ms` (Heavy Cinematic ease)
3. After `500ms`, route navigation resolves
4. After `900ms`, element is removed from DOM

### 7.4 Page load splash screen

On first load, a fullscreen overlay displays `eypi.cc` in APC Blue with the dot in APC Gold:

```css
@keyframes loader-scale-in {
  0%   { opacity: 0; transform: scale(0.6); letter-spacing: 0.1em; }
  40%  { opacity: 1; transform: scale(1);   letter-spacing: -0.04em; }
  80%  { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1.08); }
}
```
Duration: `1.1s` with `cubic-bezier(0.16, 1, 0.3, 1)` fill-forwards.
Auto-dismisses after `1400ms`.
Exit: `opacity: 0` over `0.25s ease` (Vue Transition `leave-active`).

### 7.5 Custom cursor (AppCursor)

The native OS pointer is hidden on desktop (`html.has-custom-cursor`). A custom circle follows the mouse at all times via `requestAnimationFrame`.

**Default state**: 24×24px white circle with `mix-blend-mode: difference`.

**Hover states** morph when over interactive elements (explicit `data-cursor` or auto-detected `a`, `button`, inputs, etc.):

| State | Size | Color | Trigger |
|---|---|---|---|
| `default` | 24×24px | `#ffffff` (difference blend) | Non-interactive areas |
| `nav` | 34×34px | `#DEAC4B` | Links, buttons, toggles |
| `cta` | 48×48px | `#DEAC4B` | Submit buttons, primary CTAs |
| `card` | 80×80px | `#34418F` | Card links |
| `text` | 2×22px | `#DEAC4B` | Text inputs, textareas |

**Spring physics**: `SPRING = 0.38` for follow rate.

**Touch devices**: Not rendered when `pointer: coarse`; native pointer used.

### 7.6 Slide panel transitions

Used for the Edit Sidebar and Analytics Panel:

**Backdrop**: `opacity: 0 → 1` over `0.3s ease`
**Panel**: `translateX(100%) → translateX(0)` over `0.4s cubic-bezier(0.2, 1, 0.3, 1)`

Exit reverses: panel slides back `translateX(100%)` and backdrop fades to `opacity: 0`.

### 7.7 Navigation scroll behavior

```js
function onScroll() {
  const y = window.scrollY
  isScrolled = y > 20              // Adds deeper box-shadow
  isNavVisible = y < lastScrollY || y < 50  // Hides on scroll down, shows on scroll up
  lastScrollY = y
}
```
The nav hides via `translateY(-80px)` + `opacity: 0` on the pill wrapper, not the pill itself.

### 7.8 Hover lift pattern

| Element | Hover transform |
|---|---|
| Pill nav CTA | `translateY(-1px)` |
| Scroll-top button | `translateY(-2px)` |
| 404 return CTA | `scale(1.05)` |
| Dashboard shorten button | `scale(1.05)` |

### 7.9 Loading / skeleton states

The Analytics Panel uses `animate-pulse` (Tailwind) on placeholder rectangles while data is fetching:
```
background: gray-200 / dark: slate-800/60
border-radius: 0.75rem
animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite
```

Buttons in loading state use `animate-pulse` on the button itself (combined with reduced opacity).

### 7.10 Dark mode toggle transition

The icon switches between Moon (light mode) and Sun (dark mode) with a `v-if`/`v-else` swap (instant icon change). The page-wide color shift uses the `body` transition: `background-color 0.3s ease, color 0.3s ease`.

### 7.11 Chevron rotation

The dropdown chevron in the user button rotates on open:
```css
transition-duration: 200ms;   /* Tailwind: duration-200 */
transform: rotate(180deg);    /* When open: .rotate-180 */
```

---

## 8. Accessibility (a11y)

### Focus management

Visible focus rings are applied site-wide:
```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 0.5rem;
}
```

A **Skip to content** link is the first focusable element (`href="#app-content"`), visible on focus.

### Reduced motion

`@media (prefers-reduced-motion: reduce)` in `main.css` disables or shortens:
- Scroll reveal animations (`.reveal` shown immediately)
- Pill nav hide/show transitions
- Slide-over panel transitions
- Custom cursor (native pointer on touch only)
- Page transition wipe (instant)
- Animation loops (reveal, nav transitions)

### Live regions

Toast notifications use `aria-live="polite"` and `role="status"` on each toast item.

### ARIA attributes in use

| Element | Attribute | Value |
|---|---|---|
| Pill nav `<nav>` | `aria-label` | `"Main navigation"` |
| Pill nav separator | `aria-hidden` | `"true"` |
| Backdrop overlays | `aria-hidden` | `"true"` |
| Loader | `aria-hidden` | `"true"` |
| Page transition | `aria-hidden` | `"true"` |
| Icon buttons (table) | `aria-label` | `"Copy link"`, `"Analytics"`, `"Edit"`, `"Delete"` |
| Close buttons | `aria-label` | `"Close"` |
| Dark mode toggle | `aria-label` | `"Toggle dark mode"` |
| Scroll-top button | `aria-label` | `"Back to top"` |
| Footer `<nav>` | `aria-label` | `"Footer navigation"` |

### Semantic structure

```
<body>
  <AppLoader aria-hidden>       ← z:99998, auto-dismisses
  <AppTransition aria-hidden>   ← z:99997, page wipe overlay
  <AppCursor>                   ← z:99999, decorative
  <ScrollTop>                   ← z:9998, fixed utility
  <div id="base-layer">         ← z:-10, dot grid background
  <TheHeader>                   ← z:9990, fixed pill nav
  <main id="app-content">       ← z:10, page content
    <router-view />
  </main>
  <TheFooter>                   ← z:1, always-dark
  <ToastContainer>              ← z:9999, fixed notifications
</body>
```

### Color contrast

| Pairing | Ratio (approx.) | Notes |
|---|---|---|
| `#0A0A0A` on `#F5F5F5` (body text, light) | ~18.5:1 | AAA |
| `#F5F5F5` on `#000000` (body text, dark) | ~18.5:1 | AAA |
| `#DEAC4B` on `#34418F` (gold on blue) | ~3.7:1 | Passes AA for large text |
| `#DEAC4B` on `#000000` (gold CTA text) | ~7.8:1 | AAA |
| `#ffffff` on `#DEAC4B` (button label) | ~3.2:1 | Passes AA for large/bold |
| `#6B6B6B` on `#F5F5F5` (muted text) | ~4.8:1 | Passes AA |

### Text selection

```css
::selection {
  background-color: #DEAC4B;
  color: #000000;
}
```

---

## 9. Z-index architecture

Z-index hierarchy (matches [src/App.vue](src/App.vue) and teleported overlays):

| Layer | Z-Index | Element |
|---|---|---|
| Background dot grid | `-10` | `#base-layer` (fixed) |
| Page content | `10` | `<main>` (relative) |
| Footer | `1` | `<footer>` (relative) |
| Fixed nav | `9990` | Pill nav wrapper |
| Scroll-top button | `9998` | Fixed bottom-right |
| Delete modal | `9999` | Inline modal |
| Toast container | `9999` | Fixed bottom-right |
| Slide panel backdrop | `99990` | Teleported overlay |
| Slide panel | `99991` | Teleported panel |
| Page transition wipe | `99997` | Full-screen clip-path |
| Page load splash | `99998` | Full-screen loader |
| Custom cursor | `99999` | Fixed, pointer-events:none |

---

## Appendix: Common pattern snippets

### CTA Button (minimal spec)
```css
background: #DEAC4B;
color: #ffffff;
font-family: 'Geist', 'Geist Mono', sans-serif;
font-weight: 700;
font-size: 0.8125rem to 1.25rem;
text-transform: uppercase;
letter-spacing: 0.05em to 0.1em;
border-radius: 0.75rem to 9999px;
padding: 0.75rem 1.5rem;
transition: opacity 0.2s ease, transform 0.15s ease;

/* Hover: */
opacity: 0.88;
transform: translateY(-1px);

/* Disabled: */
opacity: 0.70;
cursor: not-allowed;
animation: pulse 2s infinite;
```

### Glassmorphism Card (minimal spec)
```css
background: rgba(255, 255, 255, 0.35);
backdrop-filter: blur(16px) saturate(150%);
border: 1px solid rgba(255, 255, 255, 0.60);
box-shadow: 0 8px 32px rgba(31, 38, 135, 0.07);
border-radius: 1.5rem;
```

### Scroll Reveal (minimal spec)
```css
/* Apply to element: */
opacity: 0;
transform: translateY(28px);
transition: opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1),
            transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);

/* JS adds .is-visible when element enters viewport: */
opacity: 1;
transform: translateY(0);
```

### Dot Grid Background (minimal spec)
```css
background-color: var(--color-bg);
background-image: radial-gradient(circle, var(--color-dot) 1.5px, transparent 1.5px);
background-size: 120px 120px;
background-attachment: fixed;
```
