# Dark mode design

Date: 2026-10-29. Status: awaiting owner review.

## Goal

Add a dark theme to Eypi that keeps the same wantap layout, the APC blue and gold identity, and the hairline-card look. The theme follows the device by default, and people can override it. A "True black" option serves OLED screens.

## What the owner decided

- Two dark levels: **Dark** (near-black page, cards one step lighter) and **True black** (`#000000` page).
- The picker is **System / Light / Dark**, with a **True black** switch that only appears while Dark is active. The default is **System**.
- Light stays exactly as it is today.

## Current state (read from the code)

- The app is light only on purpose. `src/lightOnly.test.ts` asserts there is no `public/theme-init.js`, no `src/composables/useDarkMode.ts`, no `src/components/ThemeToggle.vue`, `color-scheme` is `light`, `theme-color` is `#f5f5f5`, and `index.html` contains only the module script.
- `DESIGN_SYSTEM.md` sections 1, 2 and 9 state the light-only rule and ban `dark:` utilities. `src/styles/design.test.ts` asserts every token value.
- The whole palette lives in the `:root` block of `src/styles/tokens.css`. Components use token utilities, and only a few colours are hard-coded (QR output in `src/utils/tix-qr.ts` and `renderLinkQr.ts`, and the Microsoft logo in `LoginView.vue`).
- `index.html` allows no inline scripts, so a no-flash theme init must be an external file.

## Design

### 1. Palettes

`tokens.css` keeps `:root` as the light palette and gains two override blocks, selected by classes on `<html>`:

- `.dark` for Dark.
- `.dark.black` for True black. It overrides only the surface tokens listed below it, so Dark and True black share everything else.

Values below are the starting values. The contrast test in section 7 is the authority, and a value that fails it is adjusted before merge.

| Token | Light (unchanged) | Dark | True black (differs from Dark) |
|---|---|---|---|
| `--background` | `#f5f5f5` | `#0a0a0a` | `#000000` |
| `--foreground` | `#0a0a0a` | `#ededed` | |
| `--card` | `#ffffff` | `#141414` | `#0d0d0d` |
| `--card-foreground` | `#0a0a0a` | `#ededed` | |
| `--popover` | `#ffffff` | `#181818` | `#121212` |
| `--popover-foreground` | `#0a0a0a` | `#ededed` | |
| `--primary` | `#35438c` | `#8b97d8` | |
| `--primary-foreground` | `#ffffff` | `#0a0a0a` | |
| `--secondary` | `#ebebeb` | `#1f1f1f` | `#181818` |
| `--secondary-foreground` | `#0a0a0a` | `#ededed` | |
| `--muted` | `#ebebeb` | `#1f1f1f` | `#181818` |
| `--muted-foreground` | `#5c5c5c` | `#a3a3a3` | |
| `--accent` | gold at 25% | gold at 20% | |
| `--accent-foreground` | `#0a0a0a` | `#ededed` | |
| `--destructive` | `#c62828` | `#ef7373` | |
| `--border` | `#e2e2e2` | `#262626` | `#1f1f1f` |
| `--input` | `#8c8c8c` | `#6b6b6b` | |
| `--ring` | `#35438c` | `#8b97d8` | |
| `--chart-1` | `#35438c` | `#8b97d8` | |
| `--chart-2` | `#deac4b` | `#deac4b` | |
| `--chart-3` | `#7783c4` | `#5a68b8` | |
| `--chart-4` | `#a87a1c` | `#f0d08a` | |
| `--chart-5` | `#9aa0b8` | `#9aa0b8` | |
| `--sidebar` | `#ffffff` | `#101010` | `#080808` |
| `--sidebar-foreground` | `#0a0a0a` | `#ededed` | |
| `--sidebar-primary` | `#35438c` | `#8b97d8` | |
| `--sidebar-primary-foreground` | `#ffffff` | `#0a0a0a` | |
| `--sidebar-accent` | `#ebebf2` | `#1b1e30` | `#12141f` |
| `--sidebar-accent-foreground` | `#0a0a0a` | `#ededed` | |
| `--sidebar-border` | `#e2e2e2` | `#262626` | `#1f1f1f` |
| `--sidebar-ring` | `#35438c` | `#8b97d8` | |

Gold is still never used as text on a light surface. On dark surfaces it is allowed as text only where the contrast test passes. `--radius` is shared.

Components do not change to support this, because they already use token utilities. `dark:` utilities stay banned: the theme is applied through tokens only.

### 2. Preference model and picker

- The stored preference is `{ mode: 'system' | 'light' | 'dark', black: boolean }`, saved in `localStorage` under one key. A missing, invalid or unreadable value means `{ mode: 'system', black: false }`. Every read and write is wrapped in try/catch.
- Resolution: `light` resolves to light; `dark` resolves to dark; `system` follows `prefers-color-scheme` and updates live when the device setting changes. True black applies only when the resolved theme is dark, whether chosen or from the system.
- A composable, `src/composables/useTheme.ts`, owns the preference, the resolved theme and the class application.
- A component, `src/components/ThemeToggle.vue`, is the picker: a three-option control (System, Light, Dark) and a True black switch that renders only when the resolved theme is dark. It is keyboard accessible, with visible focus, labelled for screen readers, and has 44px targets per `DESIGN_SYSTEM.md`.

### 3. No flash on load

- `public/theme-init.js` is a small classic script, loaded from `index.html` with a plain `<script src="/theme-init.js"></script>` in `<head>` before the stylesheet. It reads the stored preference, resolves the theme, sets the `dark` and `black` classes on `<html>`, and updates the `color-scheme` and `theme-color` meta tags.
- It makes no network calls, uses no inline code, and must work if storage is blocked (it falls back to system).
- Implementation must confirm the Worker's Content Security Policy allows a same-origin script (`script-src 'self'`). If it does not, that header is adjusted in `worker/` as part of the work, not worked around with inline code.

### 4. Browser chrome and manifest

- `index.html` declares `color-scheme` as `light dark` and a default `theme-color` of `#f5f5f5`.
- `theme-init.js` and `useTheme.ts` set `theme-color` to the active page background (`#f5f5f5`, `#0a0a0a` or `#000000`) and keep it in sync on change.
- `manifest.webmanifest` keeps its light `theme_color` and `background_color`, since a manifest has a single value. This is documented in the spec's test notes.

### 5. Placement

- A theme control goes in the account area of the app shell (`src/components/layout/AppShell.vue`), in the existing menu, and on the login screen so signed-out visitors can choose too.
- The exact component placement is confirmed in the implementation plan after reading `AppShell.vue` and `LoginView.vue`.

### 6. Stays unchanged

- **QR codes** stay dark on white in every theme so they scan reliably. Their surrounding card follows the theme.
- **The Microsoft sign-in logo** is unchanged (Microsoft brand rules).
- **Emails** are unchanged. Email clients apply their own dark mode and the invite already declares a light scheme.
- **Images** such as the mascot are unchanged. The mascot has its own gold background and reads on dark.

### 7. Testing

- Replace `lightOnly.test.ts` with a theme test: `theme-init.js` exists and is the only added script, the HTML has no inline script, and the meta tags are as in section 4.
- `design.test.ts` keeps asserting the light values and additionally asserts every token is defined in the `.dark` palette and that `.dark.black` overrides only the tokens listed in section 1.
- A contrast test computes WCAG ratios for text on page and card, muted text, borders, the input border (3:1), the primary on both page backgrounds, `primary-foreground` on `primary`, the destructive colour, and the chart colours against the card, in Dark and True black.
- Composable tests cover: the default is system, each mode resolves correctly, true black applies only to a dark result, a live system change updates, blocked storage falls back to system, and `theme-color` follows the theme.
- A component test covers the picker's options, the True black switch visibility, and keyboard use.
- `DESIGN_SYSTEM.md` sections 1, 2 and 9 are updated in the same change as the code, and any statement that the app is light only is removed.
- `npm run typecheck` and `npm test` pass. The owner also checks both dark themes in a browser at desktop and phone width.

## Out of scope

Per-user server-side theme storage, scheduled auto-switching, a dark email, and recolouring the mascot.

## Risks

- **Contrast:** the APC blue must be lighter on dark. The contrast test enforces this.
- **Flash of the wrong theme:** mitigated by the external script before first paint.
- **CSP:** an external script must be allowed (section 3).
- **Hard-coded colours:** the three places in "Current state" must be checked so nothing renders black on black.
