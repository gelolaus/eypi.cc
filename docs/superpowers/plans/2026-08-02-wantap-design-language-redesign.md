# Wantap Design Language Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild eypi.cc UI to Wantap shell/density/type parity with APC Gold as interactive primary and APC Blue as brand secondary, dual themes equally polished, Vue + existing backend unchanged.

**Architecture:** Phase 0 introduces CSS tokens + a Vue primitive kit under `src/components/ui/`. Phase 1 replaces pill nav with Wantap-style `AppShell` (desktop sidebar, mobile bottom tabs, role-aware org tools). Later phases migrate marketing, auth, suite modules, and public surfaces onto the kit, then delete gelolaus chrome and rewrite `DESIGN_SYSTEM.md`.

**Tech Stack:** Vue 3, Vue Router, Vite, Tailwind CSS 3, Vitest (node), existing Hono API. Fonts: Syne + Plus Jakarta Sans (Google Fonts). No Next/shadcn port; Vue primitives only.

**Spec:** `docs/superpowers/specs/2026-08-02-wantap-design-language-redesign.md`

## Global Constraints

- Manual commits only: draft Conventional Commit text after each task; do **not** run `git add` / `git commit` / `git push` unless the user explicitly asks in that turn.
- UI only: no API/schema/feature changes; no Vue→Next rewrite.
- Interactive primary = APC Gold `#DEAC4B` (`--color-primary`); brand secondary = APC Blue `#34418F` (`--color-brand`).
- Dual themes first-class: warm paper light + navy-ink dark.
- Drop gelolaus: `AppCursor`, 120px `bg-dot-grid` base layer, `mica-card` / pill-glass, floating `pill-nav`.
- Typography: Syne headings, Plus Jakarta Sans UI/body.
- UI copy: follow `DESIGN_SYSTEM.md` writing rules (no em dashes, no hollow marketing filler).
- Every phase must look intentional in **both** themes before starting the next.
- Prefer small pure-TS tests (node Vitest). Do not add `@vue/test-utils` / happy-dom unless a later task truly needs mount tests.

---

## File structure (locked)

| Path | Responsibility |
|---|---|
| `src/styles/main.css` | Design tokens, base, utilities (`glass-panel`, typography). Remove gelolaus cursor/dot/mica rules as phases complete. |
| `tailwind.config.js` | Map `g-*` tokens; add `fontFamily.display`; radius; drop obsolete mica color crutches when unused. |
| `index.html` | Syne + Plus Jakarta Sans; remove Geist links. |
| `src/lib/cn.ts` | Tiny className joiner. |
| `src/lib/ui/buttonVariants.ts` | Button size/variant class maps (unit-tested). |
| `src/components/ui/*.vue` | Primitive kit: Button, Input, Textarea, Select, Card, Dialog, Switch, Badge, Tabs, Avatar, EmptyState, ThemeToggle. |
| `src/components/layout/app-nav.ts` | Nav item definitions + `isAppNavActive` + `resolveAppNav` (role-aware). |
| `src/components/layout/AppShell.vue` | Sidebar + mobile top/bottom chrome. |
| `src/components/layout/OrgToolsSheet.vue` | Mobile overflow for Forms/Frames/Tix/Orgs. |
| `src/App.vue` | Marketing/public layout vs shell layout switch. |
| `src/composables/useDarkMode.ts` | Keep storage key; ThemeToggle uses it. |
| `DESIGN_SYSTEM.md` | Rewritten in final cleanup task to match shipped system. |

**Locked surface tokens (Phase 0):**

```css
:root {
  --color-bg: #F5F1EA;
  --color-surface: #FFFCF7;
  --color-border: #E5DFD4;
  --color-text: #14110F;
  --color-text-muted: #6F675C;
  --color-primary: #DEAC4B;
  --color-primary-fg: #1A1408;
  --color-brand: #34418F;
  --color-destructive: #DC2626;
  --color-ring: color-mix(in srgb, #DEAC4B 55%, transparent);
  --radius: 0.875rem;
}
html.dark {
  --color-bg: #0A0E18;
  --color-surface: #121826;
  --color-border: rgba(255, 255, 255, 0.10);
  --color-text: #F4F1EA;
  --color-text-muted: #A39E94;
  --color-primary: #DEAC4B;
  --color-primary-fg: #1A1408;
  --color-brand: #34418F;
  --color-destructive: #F87171;
  --color-ring: color-mix(in srgb, #DEAC4B 55%, transparent);
}
```

**Token rename (breaking for class semantics):**

| Old meaning | New |
|---|---|
| `--color-primary` / `g-primary` = Blue | `--color-primary` / `g-primary` = **Gold** |
| `--color-accent` / `g-accent` = Gold | Alias to `g-primary` during migration, then remove |
| (none) | `--color-brand` / `g-brand` = **Blue** |

**Org tools mobile:** bottom sheet (`OrgToolsSheet.vue`), not a top-bar menu.

**Home bento cards:** Links (always); Forms, Frames, Tix, Orgs (when `checkOrgMembership()` is true).

**Hero mock:** phone frame showing a sample short-link card (slug + destination + fake click count), not a Wantap digital card.

---

### Task 1: Tokens, fonts, Tailwind maps

**Files:**
- Modify: `index.html`
- Modify: `src/styles/main.css` (token block + body/heading fonts; keep old utilities temporarily)
- Modify: `tailwind.config.js`
- Test: `src/styles/tokens.test.ts` (assert exported token constants)

**Interfaces:**
- Consumes: none
- Produces: CSS vars above; Tailwind `g-primary`→gold, `g-brand`→blue, `g-accent`→same as primary; `fontFamily.sans` = Plus Jakarta Sans; `fontFamily.display` = Syne

- [ ] **Step 1: Write failing token constant test**

Create `src/lib/ui/tokens.ts`:

```ts
export const TOKENS = {
  light: {
    bg: '#F5F1EA',
    surface: '#FFFCF7',
    border: '#E5DFD4',
    text: '#14110F',
    textMuted: '#6F675C',
    primary: '#DEAC4B',
    primaryFg: '#1A1408',
    brand: '#34418F',
    destructive: '#DC2626',
  },
  dark: {
    bg: '#0A0E18',
    surface: '#121826',
    primary: '#DEAC4B',
    brand: '#34418F',
    destructive: '#F87171',
  },
  radius: '0.875rem',
} as const
```

Create `src/lib/ui/tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TOKENS } from './tokens'

describe('TOKENS', () => {
  it('uses APC gold as interactive primary in both themes', () => {
    expect(TOKENS.light.primary).toBe('#DEAC4B')
    expect(TOKENS.dark.primary).toBe('#DEAC4B')
  })

  it('uses APC blue as brand secondary', () => {
    expect(TOKENS.light.brand).toBe('#34418F')
    expect(TOKENS.dark.brand).toBe('#34418F')
  })

  it('locks friendly radius', () => {
    expect(TOKENS.radius).toBe('0.875rem')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/ui/tokens.test.ts`
Expected: FAIL (module not found) until files exist; if only assert fails, fix values.

- [ ] **Step 3: Add tokens.ts (already written in Step 1) and wire CSS + fonts + Tailwind**

Replace Google Fonts in `index.html` with:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Syne:wght@500;600;700;800&display=swap"
  rel="stylesheet"
/>
```

In `src/styles/main.css` `:root` / `html.dark`, set the locked token block (including `--color-primary-fg`, `--color-brand`, `--color-destructive`, `--radius`). Change body `font-family` to `'Plus Jakarta Sans', system-ui, sans-serif`. Add:

```css
h1, h2, h3, .font-display, .text-page-title, .text-section-title {
  font-family: 'Syne', ui-sans-serif, sans-serif;
}
```

Update `tailwind.config.js` `theme.extend`:

```js
colors: {
  'apc-blue': '#34418F',
  'apc-gold': '#DEAC4B',
  'g-bg': 'var(--color-bg)',
  'g-surface': 'var(--color-surface)',
  'g-border': 'var(--color-border)',
  'g-text': 'var(--color-text)',
  'g-muted': 'var(--color-text-muted)',
  'g-primary': 'var(--color-primary)',
  'g-primary-fg': 'var(--color-primary-fg)',
  'g-brand': 'var(--color-brand)',
  'g-accent': 'var(--color-primary)',
  'g-destructive': 'var(--color-destructive)',
},
fontFamily: {
  sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
  display: ['Syne', 'ui-sans-serif', 'sans-serif'],
  mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
},
borderRadius: {
  lg: 'var(--radius)',
  xl: 'calc(var(--radius) * 1.4)',
  '2xl': 'calc(var(--radius) * 1.8)',
},
```

Keep temporary `mica-*` keys until DialogHost migration removes them.

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/ui/tokens.test.ts`
Expected: PASS

- [ ] **Step 5: Draft commit (do not commit unless user asks)**

```text
feat(ui): retokenize for Wantap blue/gold dual themes

- Add Syne + Plus Jakarta Sans
- Map g-primary to gold and g-brand to blue
```

---

### Task 2: `cn` + Button variants + Button component

**Files:**
- Create: `src/lib/cn.ts`
- Create: `src/lib/ui/buttonVariants.ts`
- Create: `src/lib/ui/buttonVariants.test.ts`
- Create: `src/components/ui/Button.vue`

**Interfaces:**
- Consumes: Tailwind `g-*` tokens from Task 1
- Produces:
  - `cn(...parts: Array<string | false | null | undefined>): string`
  - `buttonVariants({ variant?, size? }): string`
  - `Button.vue` props: `variant: 'primary' | 'secondary' | 'ghost' | 'destructive'`, `size: 'default' | 'lg' | 'sm'`, native button attrs via `$attrs`

- [ ] **Step 1: Write failing variant tests**

```ts
// src/lib/ui/buttonVariants.test.ts
import { describe, expect, it } from 'vitest'
import { buttonVariants } from './buttonVariants'

describe('buttonVariants', () => {
  it('primary uses gold fill and dark foreground', () => {
    const cls = buttonVariants({ variant: 'primary', size: 'default' })
    expect(cls).toContain('bg-g-primary')
    expect(cls).toContain('text-g-primary-fg')
    expect(cls).toContain('h-11')
  })

  it('lg is h-12', () => {
    expect(buttonVariants({ size: 'lg' })).toContain('h-12')
  })

  it('destructive uses destructive token', () => {
    expect(buttonVariants({ variant: 'destructive' })).toContain('bg-g-destructive')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- src/lib/ui/buttonVariants.test.ts`
Expected: FAIL module not found

- [ ] **Step 3: Implement cn + buttonVariants + Button.vue**

```ts
// src/lib/cn.ts
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
```

```ts
// src/lib/ui/buttonVariants.ts
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive'
export type ButtonSize = 'default' | 'lg' | 'sm'

const variantClass: Record<ButtonVariant, string> = {
  primary:
    'bg-g-primary text-g-primary-fg hover:brightness-110 border border-transparent',
  secondary:
    'border border-g-border bg-transparent text-g-text hover:bg-g-bg',
  ghost: 'bg-transparent text-g-muted hover:text-g-text hover:bg-g-bg',
  destructive: 'bg-g-destructive text-white hover:brightness-110 border border-transparent',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm rounded-full',
  default: 'h-11 px-5 text-base rounded-full',
  lg: 'h-12 px-6 text-base rounded-full',
}

export function buttonVariants(opts: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}): string {
  const variant = opts.variant ?? 'primary'
  const size = opts.size ?? 'default'
  return cn(
    'inline-flex items-center justify-center gap-2 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:opacity-55 disabled:pointer-events-none',
    variantClass[variant],
    sizeClass[size],
    opts.className,
  )
}
```

```vue
<!-- src/components/ui/Button.vue -->
<template>
  <button
    :type="type"
    :class="buttonVariants({ variant, size, className })"
    :disabled="disabled"
    v-bind="attrsWithoutClass"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { buttonVariants, type ButtonSize, type ButtonVariant } from '@/lib/ui/buttonVariants'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    className?: string
  }>(),
  { variant: 'primary', size: 'default', type: 'button', disabled: false },
)

const attrs = useAttrs()
const attrsWithoutClass = computed(() => {
  const { class: _c, ...rest } = attrs as Record<string, unknown>
  return rest
})
</script>
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/lib/ui/buttonVariants.test.ts`

- [ ] **Step 5: Draft commit**

```text
feat(ui): add Button primitive with Wantap control scale
```

---

### Task 3: Input, Textarea, Card, Badge, EmptyState

**Files:**
- Create: `src/lib/ui/fieldClasses.ts`
- Create: `src/lib/ui/fieldClasses.test.ts`
- Create: `src/components/ui/Input.vue`
- Create: `src/components/ui/Textarea.vue`
- Create: `src/components/ui/Card.vue`
- Create: `src/components/ui/Badge.vue`
- Create: `src/components/ui/EmptyState.vue`

**Interfaces:**
- Consumes: `cn`
- Produces: `fieldClasses()` → `h-11 w-full rounded-xl border border-g-border bg-g-surface px-4 text-base text-g-text ...`; Card default `rounded-2xl border border-g-border bg-g-surface p-7 md:p-8`

- [ ] **Step 1: Failing fieldClasses test**

```ts
import { describe, expect, it } from 'vitest'
import { fieldClasses } from './fieldClasses'

describe('fieldClasses', () => {
  it('uses h-11 and surface tokens', () => {
    const cls = fieldClasses()
    expect(cls).toContain('h-11')
    expect(cls).toContain('border-g-border')
    expect(cls).toContain('bg-g-surface')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement fieldClasses + components**

```ts
// src/lib/ui/fieldClasses.ts
import { cn } from '@/lib/cn'

export function fieldClasses(className?: string): string {
  return cn(
    'h-11 w-full rounded-xl border border-g-border bg-g-surface px-4 text-base text-g-text placeholder:text-g-muted outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
    className,
  )
}

export function textareaClasses(className?: string): string {
  return cn(
    'min-h-[6rem] w-full rounded-xl border border-g-border bg-g-surface px-4 py-3 text-base text-g-text placeholder:text-g-muted outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
    className,
  )
}
```

`Input.vue` / `Textarea.vue`: thin wrappers applying those classes + `v-bind="$attrs"`.

`Card.vue`:

```vue
<template>
  <div :class="cn('rounded-2xl border border-g-border bg-g-surface p-7 md:p-8', className)">
    <slot />
  </div>
</template>
<script setup lang="ts">
import { cn } from '@/lib/cn'
defineProps<{ className?: string }>()
</script>
```

`Badge.vue`: small pill; props `tone: 'default' | 'brand' | 'success' | 'danger'`.

`EmptyState.vue`: props `title: string`, `description?: string`; default slot for action button.

Also add utility to `main.css`:

```css
@layer utilities {
  .glass-panel {
    background-color: color-mix(in srgb, var(--color-surface) 88%, transparent);
    backdrop-filter: blur(16px);
    border: 1px solid var(--color-border);
  }
}
```

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Draft commit**

```text
feat(ui): add Input, Card, Badge, and EmptyState primitives
```

---

### Task 4: Dialog kit + migrate DialogHost

**Files:**
- Create: `src/components/ui/Dialog.vue` (presentational panel + backdrop; controlled by props)
- Modify: `src/components/DialogHost.vue` (use Dialog + Button + Input; remove mica)

**Interfaces:**
- Consumes: `Button`, `Input`, `useDialog` (`current`, `close` API unchanged)
- Produces: DialogHost visually Wantap-parity; `useDialog` API unchanged for callers

- [ ] **Step 1: Write a pure test for dialog confirm gate (existing behavior)**

If no existing test, add `src/composables/useDialog.test.ts` covering: confirm with `requireText` resolves false until match. Keep API identical.

- [ ] **Step 2: Run — fail or pass depending on coverage; implement test first if missing**

- [ ] **Step 3: Restyle DialogHost**

Replace mica panel with:

```vue
<div class="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
  <div class="w-full max-w-md rounded-2xl border border-g-border bg-g-surface p-8 shadow-2xl" role="dialog" ...>
    <h3 class="font-display text-xl font-bold text-g-text">...</h3>
    <!-- use Input + Button primary/secondary/destructive -->
  </div>
</div>
```

Primary info button: `<Button variant="primary">`. Confirm destructive: `<Button variant="destructive">`. Cancel: `<Button variant="secondary">`.

- [ ] **Step 4: Manual check in `npm run dev:local`**: open any confirm dialog; both themes.

- [ ] **Step 5: Draft commit**

```text
feat(ui): restyle dialogs to Wantap card chrome
```

---

### Task 5: Switch, Tabs, Select, Avatar, ThemeToggle

**Files:**
- Create: `src/components/ui/Switch.vue`
- Create: `src/components/ui/Tabs.vue` (simple prop-driven tab list; or `UiTabs` + `UiTab`)
- Create: `src/components/ui/Select.vue` (native `<select>` styled)
- Create: `src/components/ui/Avatar.vue`
- Create: `src/components/ui/ThemeToggle.vue`
- Create: `src/lib/ui/switchClasses.test.ts` (active track uses `bg-g-primary`)

**Interfaces:**
- `ThemeToggle` consumes `useDarkMode()` → `{ isDark, toggle }`
- `Switch` v-model: `boolean`
- `Avatar` props: `src?: string`, `name: string` → initials fallback

- [ ] **Step 1–4:** Test switch active class includes `bg-g-primary`; implement components; ThemeToggle is icon button using ghost Button styles; run tests; draft commit `feat(ui): complete Wantap primitive kit controls`

---

### Task 6: App nav config (role-aware)

**Files:**
- Create: `src/components/layout/app-nav.ts`
- Create: `src/components/layout/app-nav.test.ts`

**Interfaces:**
- Produces:

```ts
export type AppNavItem = {
  id: string
  label: string
  href: string
  icon: 'home' | 'links' | 'orgs' | 'forms' | 'frames' | 'tix' | 'orgTools'
  mobileSlot: 'primary' | 'orgTools' | 'never'
}

export function resolveAppNav(opts: { hasOrgTools: boolean }): {
  desktop: AppNavItem[]
  mobilePrimary: AppNavItem[]
  orgTools: AppNavItem[]
}

export function isAppNavActive(href: string, path: string): boolean
export function isDenseEditorPath(path: string): boolean
```

Locked behavior:
- Always desktop+mobile: Home `/dashboard`, Links `/links`
- If `hasOrgTools`: desktop adds Orgs `/orgs`, Forms `/forms`, Frames `/manage/frames`, Tix `/manage/tix`
- Mobile: Home, Links, and if org tools → synthetic item `Org tools` (`id: 'org-tools'`, `mobileSlot: 'orgTools'`); org destinations only in `orgTools` array
- `isDenseEditorPath`: true for `/manage/frames/**` edit/new and `/manage/tix/**/select` (icon-only rail)

- [ ] **Step 1: Write tests for resolveAppNav personal vs org and isAppNavActive prefix matching**

```ts
import { describe, expect, it } from 'vitest'
import { isAppNavActive, resolveAppNav } from './app-nav'

describe('resolveAppNav', () => {
  it('keeps mobile lean without org tools', () => {
    const nav = resolveAppNav({ hasOrgTools: false })
    expect(nav.mobilePrimary.map((i) => i.id)).toEqual(['home', 'links'])
    expect(nav.orgTools).toEqual([])
  })

  it('adds org tools overflow on mobile when membership active', () => {
    const nav = resolveAppNav({ hasOrgTools: true })
    expect(nav.mobilePrimary.map((i) => i.id)).toContain('org-tools')
    expect(nav.orgTools.map((i) => i.id)).toEqual(['orgs', 'forms', 'frames', 'tix'])
  })
})

describe('isAppNavActive', () => {
  it('matches nested forms routes', () => {
    expect(isAppNavActive('/forms', '/forms/concessionaire')).toBe(true)
  })
})
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `app-nav.ts` to satisfy tests**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Draft commit**

```text
feat(ui): add role-aware Wantap app nav config
```

---

### Task 7: AppShell + OrgToolsSheet + wire authenticated layout

**Files:**
- Create: `src/components/layout/AppShell.vue`
- Create: `src/components/layout/OrgToolsSheet.vue`
- Create: `src/components/layout/NavIcon.vue` (simple SVG switch on icon id)
- Modify: `src/App.vue` (conditional shell vs marketing chrome)
- Modify: `src/components/TheHeader.vue` / `NavSidebar.vue` (stop using for authenticated suite; keep minimal marketing header or replace)
- Create: `src/components/layout/MarketingHeader.vue` (logo + Log in / Get started + ThemeToggle)

**Interfaces:**
- `AppShell` props: `userName: string`, `userEmail: string`, `hasOrgTools: boolean`, `orgs`, `activeOrg`, emits/select-org, logout
- Uses `resolveAppNav`, `ThemeToggle`, `Avatar`, router-link
- Dense path: sidebar `w-16` icon-only; else `w-56`
- Mobile: top bar + bottom tabs + `OrgToolsSheet` when org-tools tapped

- [ ] **Step 1: Implement AppShell structure matching Wantap dashboard-shell**

Desktop aside + mobile header + main slot + bottom nav. Bottom nav `pb-[env(safe-area-inset-bottom)]`, grid columns = `mobilePrimary.length`.

Active item: `bg-g-primary/15 text-g-text` + icon `text-g-primary`.

- [ ] **Step 2: App.vue layout split**

```ts
const route = useRoute()
const isPublicMarketing = computed(() =>
  ['home', 'privacy', 'terms', 'contact', 'login', 'verify', 'reset-password'].includes(String(route.name)),
)
const isAppShell = computed(() =>
  Boolean(route.meta.requiresAuth) || ['dashboard', 'links'].includes(String(route.name)),
)
// Public frames/tix/orgs: no shell, no marketing footer chrome dump — simple minimal header optional
```

For `requiresAuth` routes: render `<AppShell>...</AppShell>` around `<router-view />`. Remove `<AppCursor />` and `#base-layer.bg-dot-grid`. Remove `TheHeader` pill nav from app-shell routes. Marketing routes use `MarketingHeader` + footer.

- [ ] **Step 3: Org membership for nav**

In AppShell `onMounted`, call `checkOrgMembership()` once; pass `hasOrgTools`. Re-check after org fetch if needed.

- [ ] **Step 4: Manual verify**

- Logged out `/`: marketing header only
- Logged in `/dashboard` desktop: sidebar
- Logged in mobile width: bottom tabs
- Org member: Org tools sheet lists four destinations
- `/manage/frames/.../edit`: icon-only rail on desktop

- [ ] **Step 5: Draft commit**

```text
feat(ui): add Wantap AppShell with role-aware mobile nav
```

---

### Task 8: Marketing homepage (Wantap structure)

**Files:**
- Modify: `src/views/HomeView.vue`
- Create: `src/components/marketing/MarketingHero.vue`
- Create: `src/components/marketing/ProductMockup.vue`
- Create: `src/components/marketing/ProofSection.vue`
- Create: `src/components/marketing/FinalCta.vue`
- Delete usage of: `StatsStrip`, `FeaturesCarousel`, `WhyEypi`, old `HeroSection` (delete files once unused)
- Modify: `src/components/TheFooter.vue` (Wantap quiet footer)

**Locked copy direction (adjust only if product factually wrong):**
- Headline: short, factual about APC short links / suite (no hollow intensifiers)
- Support: one sentence
- Primary CTA: `Get started` → `/login`
- Secondary: text link Continue → `/login` if logged out, `/dashboard` if logged in
- Proof: QR / share / analytics one-liner
- Mock: phone frame + sample link card (`eypi.cc/demo` → example.edu, clicks)

- [ ] **Step 1: Build HomeView as four sections only (nav is MarketingHeader in App)**

- [ ] **Step 2: ProductMockup with optional 2–3 motion bits (accent crossfade on gold/blue swatch optional; keep one composition)

- [ ] **Step 3: Remove dead marketing components; ensure no imports remain (`rg StatsStrip FeaturesCarousel WhyEypi HeroSection`)

- [ ] **Step 4: Visual check both themes mobile+desktop

- [ ] **Step 5: Draft commit**

```text
feat(marketing): rebuild homepage to Wantap product-stage layout
```

---

### Task 9: Auth views

**Files:**
- Modify: `src/views/LoginView.vue`
- Modify: `src/views/VerifyView.vue`
- Modify: `src/views/ResetPasswordView.vue`

- [ ] **Step 1: Restyle LoginView**

Quiet bordered `Card` (`max-w-md`), warm gold wash behind panel:

```vue
<div class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_srgb,var(--color-primary)_18%,transparent),transparent_70%)]" />
```

Use `Input` + `Button`. Remove corner screws / mono gimmicks. Syne title: `Welcome back` / `Create account` based on mode. Keep APC email validation and API calls unchanged.

- [ ] **Step 2: Same treatment for Verify + ResetPassword**

- [ ] **Step 3: Manual auth smoke (local API)**

- [ ] **Step 4: Draft commit**

```text
feat(auth): apply Wantap quiet auth panel styling
```

---

### Task 10: Home dashboard + Settings

**Files:**
- Modify: `src/views/DashboardView.vue`
- Modify: `src/views/SettingsView.vue`
- Modify: `src/views/settings/SettingsLayout.vue`
- Modify: `src/views/settings/OrgManagementView.vue`
- Modify: `src/views/settings/OrgManagementEditView.vue`

- [ ] **Step 1: Dashboard greeting + Card bento**

```vue
<h1 class="font-display text-3xl font-bold text-g-text">Good {{ period }}, {{ userName }}</h1>
<p class="mt-2 text-g-muted">Jump into a module.</p>
<div class="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
  <Card v-for="mod in visibleModules" :key="mod.id" class="cursor-pointer ..." @click="router.push(mod.route)">
    <h2 class="font-display text-xl font-semibold">{{ mod.title }}</h2>
    <p class="mt-2 text-sm text-g-muted">{{ mod.description }}</p>
  </Card>
</div>
```

Gate org modules with membership (reuse `checkOrgMembership`).

- [ ] **Step 2: Settings pages use Card + Button + Input; Syne H1; remove mica**

- [ ] **Step 3: Both themes check**

- [ ] **Step 4: Draft commit**

```text
feat(ui): restyle dashboard home and settings
```

---

### Task 11: Links module

**Files:**
- Modify: `src/views/links/LinksView.vue`
- Modify: `src/components/AnalyticsPanel.vue`
- Modify: `src/components/LinkVisualization.vue` (if present chrome)

- [ ] **Step 1: Page chrome**

Syne title `Links`, support line about short URLs + analytics. Wrap create form and list in `Card`. Replace raw buttons with `Button` / `Input`. Chart colors → gold (`#DEAC4B`).

- [ ] **Step 2: Replace remaining `mica-card`, `bg-g-primary` meaning-blue, hard-coded `#34418F` CTA fills with kit tokens (`rg "mica-card|#34418F|eypi-gold|font-mono text-2xl" src/views/links`)

- [ ] **Step 3: Manual: create link, open analytics, export QR still works**

- [ ] **Step 4: Draft commit**

```text
feat(links): migrate Links UI to Wantap primitives
```

---

### Task 12: Forms, Frames admin, Tix admin, Orgs manage

**Files:**
- Modify all under:
  - `src/views/forms/**`
  - `src/views/dp/DpCampaignsView.vue`, `DpNewCampaignView.vue`, `DpEditCampaignView.vue`, `FramesManageLayout.vue`
  - `src/views/tix/**` (except public ticket if deferred to Task 13 — include admin layouts here)
  - `src/views/orgs/OrgModifyView.vue`, `OrgsManageLayout.vue`
  - `src/components/OrgSwitcher.vue`, `OrgLockout.vue`

- [ ] **Step 1: Per-module pass**

For each view: Syne H1, Card sections, Button/Input, gold primary, stack on mobile. Dense editors keep canvas/table logic; only chrome changes. Ensure AppShell dense rail paths still usable.

- [ ] **Step 2: `rg mica-card|pill-nav|data-cursor` in those trees → zero**

- [ ] **Step 3: Smoke each module logged-in**

- [ ] **Step 4: Draft commit**

```text
feat(ui): migrate org suite modules to Wantap chrome
```

---

### Task 13: Public + legal surfaces

**Files:**
- Modify: `src/views/dp/DpPublicView.vue`
- Modify: `src/views/tix/TicketLookupView.vue` (+ any public ticket view)
- Modify: `src/views/orgs/OrgCatalogView.vue`, `OrgProfileView.vue`
- Modify: `src/views/PrivacyView.vue`, `TermsView.vue`, `ContactView.vue`, `NotFoundView.vue`
- Modify: `src/views/RedirectView.vue` only if it shows UI chrome

- [ ] **Step 1: Apply kit fonts/radius/buttons; no AppShell bottom tabs**

- [ ] **Step 2: Theme toggle available via minimal public header or inherit `html.dark`**

- [ ] **Step 3: Smoke public frame + org profile + ticket lookup**

- [ ] **Step 4: Draft commit**

```text
feat(ui): apply Wantap visual pass to public and legal pages
```

---

### Task 14: Remove gelolaus leftovers + rewrite DESIGN_SYSTEM.md

**Files:**
- Delete (once unused): `src/components/AppCursor.vue`, unused marketing leftovers, obsolete CSS in `main.css` (`.mica-card`, `.pill-nav*`, `.bg-dot-grid` 120px body usage, `has-custom-cursor`)
- Modify: `src/App.vue` (ensure removals)
- Modify: `DESIGN_SYSTEM.md` (full rewrite to this system; keep UI writing rules)
- Modify: `CONTEXT.md` only if it references gelolaus visuals
- Modify: `tailwind.config.js` remove dead `mica-navy` if unused (`rg mica-navy`)

- [ ] **Step 1: `rg "AppCursor|mica-card|pill-nav|bg-dot-grid|data-cursor|Geist" src` → clean or document intentional leftovers**

- [ ] **Step 2: Rewrite DESIGN_SYSTEM.md sections 1,3–7 to Syne/PJS, gold primary, brand blue, AppShell, dual themes; keep §2 UI writing rules**

- [ ] **Step 3: Full `npm test` + `npm run build`**

Expected: tests pass; production build succeeds.

- [ ] **Step 4: Draft commit**

```text
chore(ui): remove gelolaus chrome and document Wantap design system
```

---

## Spec coverage checklist

| Spec requirement | Task |
|---|---|
| Dual themes warm paper + navy-ink | 1 |
| Gold interactive / Blue brand | 1–2 |
| Syne + Plus Jakarta Sans | 1 |
| Primitive kit | 2–5 |
| AppShell sidebar + bottom tabs | 7 |
| Role-aware org tools sheet | 6–7 |
| Marketing Wantap structure | 8 |
| Auth quiet panel | 9 |
| Modules + public full pass | 10–13 |
| Drop gelolaus + DESIGN_SYSTEM | 14 |
| Vue only / no backend rewrite | Global Constraints |

## Placeholder / consistency self-review

- No TBD steps; open spec items locked above (tokens, org sheet, home bento, hero mock).
- `g-primary` = gold everywhere after Task 1; blue only via `g-brand`.
- `resolveAppNav` / `AppShell` interfaces consistent across Tasks 6–7.
- Commit steps are drafts only (manual commits rule).

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-02-wantap-design-language-redesign.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with checkpoints  

Which approach?
