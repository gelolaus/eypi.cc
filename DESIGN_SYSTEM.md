# eypi.cc Design System
**gelolaus Design Language — Production Specification**

---

## Table of Contents

1. [Brand Identity & Vibe](#1-brand-identity--vibe)
2. [Color System](#2-color-system)
3. [Typography Scale](#3-typography-scale)
4. [Spacing & Layout](#4-spacing--layout)
5. [Component Anatomy](#5-component-anatomy)
6. [Motion & Interaction](#6-motion--interaction)
7. [Accessibility (a11y)](#7-accessibility-a11y)
8. [Z-Index Architecture](#8-z-index-architecture)

---

## 1. Brand Identity & Vibe

### Aesthetic Philosophy

**eypi.cc** is a URL shortener built for the APC (Asia Pacific College) student community. The visual language is derived from the **gelolaus design language** — a refined, monospace-forward aesthetic that sits at the intersection of **brutalism** and **premium minimalism**.

Key personality markers:
- **Dark on light / light on dark**: pure black-on-near-white in light mode; pure white-on-true-black in dark mode — no gray-washed midgrounds.
- **Monospace identity**: UI labels, codes, slugs, and navigation elements use `Geist Mono`. This signals precision, technical trust, and a developer-adjacent personality.
- **Gold as the singular accent**: `#DEAC4B` (APC Gold) is the *only* warm color on the whole site. Every CTA, every hover spark, every selection highlight traces back to this single gold. Its rarity gives it weight.
- **Dot-grid texture**: The page background is a fixed-attachment radial-gradient dot grid (120px × 120px pitch). It gives depth without noise and adapts between light/dark modes by simply inverting the dot color.
- **Hardware skeuomorphism in cards**: Glassmorphism cards carry four decorative corner-screw `div`s — a deliberate physical/mechanical motif that runs through auth cards, 404, and the hero monitor widget.
- **Uppercase + wide tracking for metadata**: Labels, table headers, nav items, and error codes are styled `text-transform: uppercase; letter-spacing: 0.06em+` in `Geist Mono`. This creates a consistent "system readout" feel throughout the data-dense dashboard and settings views.
- **Pill navigation**: The header exists as a floating frosted-glass pill, not a full-width bar. It auto-hides on scroll down, reappears on scroll up, and rides 16px from the viewport top — keeping content fully visible.

---

## 2. Color System

### Design Token Map (CSS Custom Properties)

These tokens are defined on `:root` and overridden on `html.dark`. All component-level colors MUST reference these variables, never hard-coded hex values (with the exceptions noted below).

| Token | Light Mode | Dark Mode | Usage |
|---|---|---|---|
| `--color-bg` | `#F5F5F5` | `#000000` | Page background (dot grid base) |
| `--color-surface` | `#ffffff` | `#161616` | Card / panel / dropdown fills |
| `--color-border` | `#E8E8E8` | `#262626` | All border strokes |
| `--color-text` | `#0A0A0A` | `#F5F5F5` | Primary body text |
| `--color-text-muted` | `#6B6B6B` | `#AAAAAA` | Secondary / caption text |
| `--color-accent` | `#DEAC4B` | `#DEAC4B` | Gold accent — **never changes** |
| `--color-primary` | `#34418F` | `#34418F` | APC Blue — **never changes** |
| `--color-dot` | `#000000` | `#ffffff` | Dot grid dot fill |

### Extended Brand Palette (Hard-coded where appropriate)

These values appear directly in components where the intent is to override the theme-aware system:

| Name | Hex | Usage |
|---|---|---|
| APC Blue | `#34418F` | Logo text, h1, headings, border-focus, primary actions |
| APC Gold (default) | `#DEAC4B` | CTAs, accent, selection, cursor states |
| APC Gold (dark hover) | `#c9a84c` | Dark mode button variant, progress bars |
| APC Gold (hover) | `#d4b55a` | Dark mode button hover |
| Footer BG | `#040d1f` | Always-dark footer — ignores theme |
| Footer Border | `#1a1a1a` / `#1f1f1f` | Footer section separators |
| Footer Text | `#F5F5F5` | Always light on dark footer |
| Footer Muted | `#444444` | Footer bottom-bar labels |
| Danger | `#dc2626` | Destructive actions (logout, delete) |
| Danger Hover BG | `rgba(220, 38, 38, 0.06)` | Danger item hover wash |
| Danger Solid | `#ef4444` / hover `#dc2626` | Delete confirmation button |

### Semantic Status Colors

| Status | Color | Usage |
|---|---|---|
| Success | `#10b981` (emerald-500) | Toast accent bar, copy button |
| Error | `#ef4444` (red-500) | Toast accent bar, delete modal |
| Info | `#34418F` (APC Blue) | Info toast accent bar |
| Analytics | `#c9a84c` | Progress bars in analytics panel |

### Glassmorphism (Mica) Layer Palette

The `mica-navy` scale is used exclusively for the dashboard and settings views (glassmorphism surfaces over the dot grid):

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

### Dark Mode Mechanism

Dark mode is toggled by adding/removing the class `dark` on `<html>`. No `prefers-color-scheme` media query is used — the user's preference is stored in `localStorage` under the key `eypi_dark_mode`. Default is **light mode**.

The `body` transitions smoothly on mode change:
```css
body {
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

---

## 3. Typography Scale

### Font Families

| Role | Family | Fallback |
|---|---|---|
| Sans (body) | `Geist` | `system-ui, sans-serif` |
| Mono (code, labels, UI) | `Geist Mono` | `monospace` |

Both are loaded via the `Geist` npm package or a CDN import. There is no serif typeface used anywhere in this system.

### Typographic Rules by Context

**Heading Scale** — all use `font-family: Geist` with tight leading and negative letter-spacing:

| Element | Size (`clamp`) | Weight | Line Height | Tracking |
|---|---|---|---|---|
| H1 (hero) | `clamp(2.6rem, 6vw, 5.5rem)` | 900 (black) | `1.05` | `-0.03em` |
| H1 (404) | `clamp(~4.5rem, 8vw, 9rem)` via Tailwind `text-7xl` → `text-9xl` | 900 | `1.0` | tighter |
| Footer heading | `clamp(2.8rem, 8vw, 7rem)` | 700 | `0.95` | `-0.04em` |
| Loader text | `clamp(2.5rem, 8vw, 5rem)` | 700 | — | `-0.04em` |
| Dashboard panel h2 | `1.5rem` (24px) | 900 | — | `0.1em` (widest) |

**Label / Metadata scale** — all use `font-family: Geist Mono`, uppercase, wide tracking:

| Context | Size | Weight | Tracking | Transform |
|---|---|---|---|---|
| Table column headers | `0.75rem` (12px) | 700 | `0.1em` | uppercase |
| Nav dropdown name | `0.75rem` | 700 | `0.06em` | uppercase |
| Nav dropdown items | `0.75rem` | 600 | `0.06em` | uppercase |
| Toast messages | `0.875rem` | 700 | `0.05em` | uppercase |
| Form labels | `0.75rem` | 700 | `0.05em` | uppercase |
| Footer label/year | `clamp(0.75rem, 1.2vw, 0.9rem)` | 500 | `0.06em` | uppercase |

**Body / UI text scale**:

| Context | Size | Weight | Font | Leading |
|---|---|---|---|---|
| Body paragraph | `clamp(1.1rem, 2vw, 1.4rem)` | 400 | Geist | `1.65` |
| Nav links | `0.8125rem` (13px) | 500 | Geist | — |
| Nav CTA | `0.8125rem` | 600 | Geist | — |
| Nav logo | `0.9375rem` (15px) | 700 | Geist Mono | `-0.01em` |
| Table body primary | `1.125rem` (18px) | 700 | Geist Mono | — |
| Table body secondary | `0.875rem` (14px) | 400 | Geist Mono | — |
| Input fields | `1rem` (16px) body; `1.25rem` hero | 400 | Geist Mono | — |
| Footer link rows | `clamp(1.2rem, 3vw, 2rem)` | 500 | Geist | `-0.03em` |

### Responsive Typography Strategy

The site uses `clamp()` for all large display text. The clamp formula follows the pattern:
```
clamp(minimum, preferred-vw, maximum)
```

No custom fluid type scale library is used — values are manually authored. The midpoint `vw` values are in the `3vw–8vw` range, chosen to reach the maximum at approximately `1100–1400px` viewport widths.

---

## 4. Spacing & Layout

### Grid & Max-Widths

| Zone | Max-Width | Notes |
|---|---|---|
| Pill nav wrapper | `min(92vw, 1100px)` | Centered, floats 16px from top |
| Hero / main content | `max-w-5xl` (1024px) | Centered with `auto` margins |
| Dashboard content | `max-w-5xl` (1024px) | Centered |
| Login / auth card | `max-w-md` (448px) | Centered within full-screen |
| Settings panel | `max-w-xl` (576px) | Centered |
| Footer inner | `max-width: 87.5rem` (1400px) | Generous editorial width |
| Analytics panel | `max-w-2xl` (672px) on md+, `95vw` on mobile | Right-anchored slide panel |
| Edit sidebar | `max-w-md` (448px) | Right-anchored slide panel |

### Padding Tokens (derived from Tailwind + custom)

| Context | Value |
|---|---|
| Pill nav internal padding | `0.5rem 1.25rem` (8px × 20px) |
| Pill nav top offset | `16px` from viewport top |
| Main content top padding | `5rem` (80px, pt-20) compensates for fixed nav |
| Hero section padding | `1.5rem` sides; `3rem–6rem` vertical |
| Card inner padding | `2rem` (p-8, 32px) — standard |
| Card inner padding (lg) | `3rem` (p-12, 48px) on settings |
| Footer inner padding | `clamp(4rem, 8vw, 6rem)` top; `clamp(1.5rem, 6vw, 6rem)` sides; `clamp(2.5rem, 5vw, 4rem)` bottom |
| Toast position | `1.5rem` from bottom and right edges |
| Scroll-top button | `2rem` from bottom and right |

### Breakpoints

The system uses Tailwind's default breakpoints with no custom additions:

| Name | Min-width | Notes |
|---|---|---|
| `sm` | `640px` | 404 page card padding increase |
| `md` | `768px` | Form layout switches col→row; dashboard padding, analytics panel max-width |
| `lg` | `1024px` | Hero monitor height increase |
| `xl` | `1280px` | Not explicitly used |
| `2xl` | `1536px` | Not explicitly used |

### Dot Grid Background

```css
.bg-dot-grid {
  background-color: var(--color-bg);
  background-image: radial-gradient(circle, var(--color-dot) 1.5px, transparent 1.5px);
  background-size: 120px 120px;
  background-attachment: fixed;  /* Parallax-lite: grid doesn't scroll with content */
}

.bg-dot-grid-dark {  /* Footer — always dark regardless of theme */
  background-color: #040d1f;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.28) 1.5px, transparent 1.5px);
  background-size: 120px 120px;
  background-attachment: fixed;
}
```

---

## 5. Component Anatomy

### 5.1 — Pill Navigation (TheHeader)

A floating, fixed-position pill with frosted glass effect.

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

**Hidden state** (`.pill-nav--hidden`) — triggered on scroll down:
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
box-shadow: 0 4px 28px rgba(0, 0, 0, 0.10);  /* deeper shadow */
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

### 5.2 — Buttons

Three distinct button variants are used throughout the system:

**Primary CTA Button** (gold-filled):
```
background: #DEAC4B
color: #ffffff
font-family: Geist (Mono in dashboard/settings)
font-weight: 700 (bold)
font-size: 0.8125rem–1.25rem (context-dependent)
text-transform: uppercase
letter-spacing: 0.05em–0.1em
border-radius: 9999px (nav CTA) / 0.75rem–0.875rem (form buttons)
padding: 0.35rem 0.875rem (nav) / 1rem 2rem (hero) / 0.75rem 1rem (auth)
```

States:
- **Hover**: `opacity: 0.88` or `hover:brightness-110` + `translateY(-0.5px to -1px)` (lift effect)
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

### 5.3 — Input Fields

Two size variants exist:

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

### 5.4 — Cards & Containers

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
border-radius: 0  /* Intentionally sharp — brutalist vs. card views */
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

### 5.5 — Modals & Slide Panels

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
Transition: `transform 0.4s cubic-bezier(0.2, 1, 0.3, 1)` — decelerate-in, accelerate-out.

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

### 5.6 — Toast Notification System

Position: `fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999`
Stacks vertically (column direction) with `gap: 0.75rem` between toasts.

**Toast Card**:
```
width: 320px (w-80)
background: #ffffff; dark: rgba(15,23,42,0.95)
border: 1px solid #E5E7EB; dark: slate-600
box-shadow: 0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04) (shadow-xl)
padding: 1rem (p-4)
border-radius: 0   /* Sharp — intentional, not rounded */
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

### 5.7 — Scroll-Top Button

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

### 5.8 — Footer

The footer is **always dark** regardless of the current theme. It uses the `bg-dot-grid-dark` class.

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

**Link Rows** (`.footer-link-row`): Full-width stacked rows, gelolaus editorial style:
```
display: flex; align-items: center; justify-content: space-between;
padding: clamp(1.1rem, 2.5vw, 1.75rem) 0;
border-top: 1px solid #1f1f1f;
font-size: clamp(1.2rem, 3vw, 2rem);
font-weight: 500; letter-spacing: -0.03em;
color: #F5F5F5;
transition: color 0.22s ease;
```
Hover: `color: #DEAC4B` (gold)
Arrow: `font-size: 0.85em; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)`
Arrow hover: `translate(4px, -4px)` — diagonal northeast movement.

---

## 6. Motion & Interaction

### 6.1 — Easing Curves

Two primary easing curves are used throughout the system:

| Name | Cubic Bezier | Character | Primary Use |
|---|---|---|---|
| **Spring Out** | `cubic-bezier(0.16, 1, 0.3, 1)` | Fast start, long deceleration — feels physical | Scroll reveals, pill nav transitions, cursor size, footer arrow |
| **Quick In-Out** | `cubic-bezier(0.2, 1, 0.3, 1)` | Slightly slower ease-in than Spring Out | Slide panels, toast notifications |
| **Heavy Cinematic** | `cubic-bezier(0.76, 0, 0.24, 1)` | Slow start AND slow end — dramatic | Page transition wipe (clip-path expand) |
| **Linear ease** | `ease` | Standard browser ease | Color/opacity micro-transitions |

### 6.2 — Scroll Reveal System

Elements marked with `.reveal` are hidden by default and revealed by an `IntersectionObserver`.

**Initial state** (`.reveal`):
```css
opacity: 0;
transform: translateY(28px);
transition:
  opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1),
  transform 0.65s cubic-bezier(0.16, 1, 0.3, 1);
```

**Revealed state** (`.reveal.is-visible` — added by JS):
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

**Observer config**: `{ threshold: 0.10, rootMargin: '0px 0px -40px 0px' }` — elements trigger 40px before they reach the bottom of the viewport. Once revealed, they are `unobserved` (fire-once, not bi-directional).

### 6.3 — Page Transition Wipe

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
2. `clip-path` expands over `600ms` (heavy cinematic ease)
3. After `500ms`, route navigation resolves
4. After `900ms`, element is removed from DOM

### 6.4 — Page Load Splash Screen

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

### 6.5 — Custom Cursor (AppCursor)

The system cursor is globally hidden: `* { cursor: none !important; }`.
A custom `div` follows the mouse via `requestAnimationFrame`.

**Spring physics**:
```js
const SPRING = 0.175   // Interpolation factor per frame
curX += (mouseX - curX) * SPRING
curY += (mouseY - curY) * SPRING
element.style.transform = `translate(${curX}px, ${curY}px) translate(-50%, -50%)`
```
This creates a lagging spring effect — the cursor chases the mouse with ~17.5% of the gap closed per frame (~6–8 frames of lag at 60fps).

**Cursor states** (toggled via `data-cursor` attribute on target elements):

| State | Size | Color | Blend Mode | Trigger |
|---|---|---|---|---|
| `default` | 24×24px | `#ffffff` | `difference` | No `data-cursor` attribute |
| `nav` | 34×34px | `#DEAC4B` | `normal` | `data-cursor="nav"` (links, toggles) |
| `cta` | 48×48px | `#DEAC4B` | `normal` | `data-cursor="cta"` (submit buttons) |
| `card` | 80×80px | `#34418F` | `normal` | `data-cursor="card"` (preview widget) |
| `text` | 2×22px | `#DEAC4B` | `normal` | `data-cursor="text"` (text elements) |

The `default` state uses `mix-blend-mode: difference` — the white dot inverts whatever color sits beneath it (appears black on white backgrounds, white on black backgrounds).

The `card` state uses a `::after` pseudo-element with the text `VIEW →` (8px Geist Mono, weight 700, letter-spacing 0.08em).

**Size/color transitions on the cursor element**:
```css
transition:
  width 0.22s cubic-bezier(0.16, 1, 0.3, 1),
  height 0.22s cubic-bezier(0.16, 1, 0.3, 1),
  background-color 0.18s ease;
```

**Touch devices**: The cursor component is not rendered when `window.matchMedia('(pointer: coarse)').matches` is `true`.

### 6.6 — Confetti Particle System (ParticleCanvas)

An HTML Canvas overlay (fixed, full-screen, `pointer-events: none`) renders colored square confetti particles on mouse hold-click drag.

- **Trigger**: `mousedown` → `mouseup` (hold to stream, not single click)
- **Particle count**: max 100 simultaneous; 3 spawned per animation frame while held
- **Palette**: `['#FF3B30','#FF9500','#FFCC00','#30D158','#007AFF','#BF5AF2','#FF375F','#00C7BE']`
- **Particle physics**: random direction (0–2π), speed `1.5–3.5`, size `4/6/8/10px` square, rotation with `rotationSpeed ±0.09`, `alpha -= 0.016` per frame (~60 frames / ~1s lifetime)
- **Shape**: `fillRect` (axis-aligned square, rotated via canvas transform)
- **Desktop only**: skipped on touch devices

### 6.7 — Slide Panel Transitions

Used for the Edit Sidebar and Analytics Panel:

**Backdrop**: `opacity: 0 → 1` over `0.3s ease`
**Panel**: `translateX(100%) → translateX(0)` over `0.4s cubic-bezier(0.2, 1, 0.3, 1)`

Exit reverses: panel slides back `translateX(100%)` and backdrop fades to `opacity: 0`.

### 6.8 — Navigation Scroll Behavior

```js
function onScroll() {
  const y = window.scrollY
  isScrolled = y > 20              // Adds deeper box-shadow
  isNavVisible = y < lastScrollY || y < 50  // Hides on scroll down, shows on scroll up
  lastScrollY = y
}
```
The nav hides via `translateY(-80px)` + `opacity: 0` (the pill wrapper, not the pill itself).

### 6.9 — Hover Lift Pattern

Several elements use a `translateY(-1px)` to `translateY(-2px)` lift on hover. This is a consistent micro-interaction across:
- Pill nav CTA: `translateY(-1px)`
- Scroll-top button: `translateY(-2px)`
- 404 return CTA: `scale(1.05)`
- Dashboard shorten button: `scale(1.05)`

### 6.10 — Loading / Skeleton States

The Analytics Panel uses `animate-pulse` (Tailwind) on placeholder rectangles while data is fetching:
```
background: gray-200 / dark: slate-800/60
border-radius: 0.75rem
animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite
```

Buttons in loading state use `animate-pulse` on the button itself (combined with reduced opacity).

### 6.11 — Dark Mode Toggle Transition

The icon switches between Moon (light mode) and Sun (dark mode) with a `v-if`/`v-else` swap (no transition — instant icon change). The page-wide color shift uses the `body` transition: `background-color 0.3s ease, color 0.3s ease`.

### 6.12 — Chevron Rotation

The dropdown chevron in the user button rotates on open:
```css
transition-duration: 200ms;   /* Tailwind: duration-200 */
transform: rotate(180deg);    /* When open: .rotate-180 */
```

---

## 7. Accessibility (a11y)

### Focus Management

The system uses `outline: none` on all interactive elements (inputs, buttons). No `focus-visible` ring is explicitly defined — this is a known gap in the current implementation. Interactive elements should have a visible focus indicator added for keyboard users.

Recommended remediation (not yet implemented):
```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: inherit;
}
```

### ARIA Attributes in Use

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

### Semantic Structure

```
<body>
  <AppLoader aria-hidden>       ← z:99998, auto-dismisses
  <AppTransition aria-hidden>   ← z:99997, page wipe overlay
  <AppCursor>                   ← z:99999, decorative
  <ParticleCanvas>              ← z:9997, pointer-events:none
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

### Color Contrast

| Pairing | Ratio (approx.) | Notes |
|---|---|---|
| `#0A0A0A` on `#F5F5F5` (body text, light) | ~18.5:1 | AAA |
| `#F5F5F5` on `#000000` (body text, dark) | ~18.5:1 | AAA |
| `#DEAC4B` on `#34418F` (gold on blue) | ~3.7:1 | Passes AA for large text |
| `#DEAC4B` on `#000000` (gold CTA text) | ~7.8:1 | AAA |
| `#ffffff` on `#DEAC4B` (button label) | ~3.2:1 | Passes AA for large/bold |
| `#6B6B6B` on `#F5F5F5` (muted text) | ~4.8:1 | Passes AA |

### Text Selection

```css
::selection {
  background-color: #DEAC4B;
  color: #000000;
}
```

### Reduced Motion

The system does not currently implement `@media (prefers-reduced-motion: reduce)`. For production-grade a11y, all `transition`, `animation`, and `requestAnimationFrame` loops should respect this preference — particularly the cursor spring loop, the confetti system, and scroll reveal animations.

---

## 8. Z-Index Architecture

A strict z-index hierarchy prevents layering conflicts:

| Layer | Z-Index | Element |
|---|---|---|
| Background dot grid | `-10` | `#base-layer` (fixed) |
| Page content | `10` | `<main>` (relative) |
| Footer | `1` | `<footer>` (relative) |
| Fixed nav | `9990` | Pill nav wrapper |
| Slide panel backdrop | `99990` | Teleported overlay |
| Slide panel | `99991` | Teleported panel |
| Delete modal | `9999` | Inline modal |
| Toast container | `9999` | Fixed bottom-right |
| Particle canvas | `9997` | Fixed, pointer-events:none |
| Scroll-top button | `9998` | Fixed bottom-right |
| Page transition wipe | `99997` | Full-screen clip-path |
| Page load splash | `99998` | Full-screen loader |
| Custom cursor | `99999` | Fixed, pointer-events:none |

---

## Appendix: Quick Reference — Common Patterns

### CTA Button (minimal spec)
```css
background: #DEAC4B;
color: #ffffff;
font-family: 'Geist', 'Geist Mono', sans-serif;
font-weight: 700;
font-size: 0.8125rem–1.25rem;
text-transform: uppercase;
letter-spacing: 0.05em–0.1em;
border-radius: 0.75rem–9999px;
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
