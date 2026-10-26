# APC light theme: design spec

**Status:** Decided by the agent on 2026-10-27 while the owner was away (the owner delegated the design). Review it in the PR.
**Supersedes:** the "dark only" rule in `DESIGN_SYSTEM.md` section 1 and the wantap port plan's Global Constraints.

## Intent

The owner finds the light APC palette more appropriate than the dark coral one. Success means: light only, APC blue and APC gold as the brand, mobile-first, and no regression in layout, fonts, motion, copy or behaviour. Nothing else about the wantap port changes.

## Decisions

| # | Decision | Why |
|---|---|---|
| 1 | Light only. No dark theme and no toggle. `<html>` carries no `dark` class, `color-scheme` is `light`. | Owner request. A single palette keeps the token set small. |
| 2 | Keep the wantap token names and the Tailwind v4 `@theme inline` mapping. Only the values in `tokens.css` change, and the palette moves from `.dark` to `:root`. | Every primitive keeps working untouched. |
| 3 | `--primary` is APC blue `#35438c`; `--primary-foreground` is white. | White on `#35438c` is 9.0:1. |
| 4 | APC gold `#deac4b` is `--chart-2` and the source of the `--accent` wash. Gold is never used for text on a light surface (about 2:1) and never carries white text. | Gold is for fills and washes. Text on it is `--foreground`. |
| 5 | Surfaces are the pre-redesign neutrals: page `#f5f5f5`, cards and popovers `#ffffff`, text `#0a0a0a`, muted text a little darker than the old `#6b6b6b` so it stays AA on `#f5f5f5`. | Matches the look the owner preferred. |
| 6 | Input borders (`--input`) are at least 3:1 against white. Hairlines (`--border`) stay light. `--ring` is solid APC blue, because the focus halo is `ring-ring/50` and a translucent ring token would leave it too faint. | WCAG 1.4.11 for control boundaries and focus. |
| 7 | Remove every `dark:` utility. Tailwind v4's default `dark` variant follows the OS setting, so leaving them or deleting the custom variant would darken parts of the UI for dark-mode users. | Prevents a half-dark UI. |
| 8 | The toaster is `theme="light"`. The dialog scrim goes from 10% to 30% black so it reads on a light page. Chart.js reads the live tokens, so only its fallbacks change. | Dark assumptions found by audit. |
| 9 | `theme-color` and the manifest colours become the page background `#f5f5f5`. | Browser chrome matches the page. |
| 10 | Mobile first: no layout, size or touch-target change. Verify at 375 px for contrast and overflow. | Owner priority. |

## Out of scope

Fonts, layout, motion, copy, routes, API, migrations. The QR rules stay: dark modules on a light background.

## Verification

`design.test.ts` asserts every token value and WCAG contrast for text, links (primary on page), destructive text, the input border and the gold wash. Other guards ban `class="dark"`, `dark:` utilities, `theme="dark"` and brand hex outside `tokens.css`. Then typecheck, tests, lint, build, the release gate, and Chromium screenshots at 375, 768 and 1280 px.
