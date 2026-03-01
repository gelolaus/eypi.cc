---
name: Redirect Route Engine
overview: Implement the dynamic `/:slug` redirect route that intercepts short link slugs, displays a terminal-style "Resolving Transmission" loading UI for ~800ms, looks up the destination in a mock database, and either redirects the user or sends them to the 404 page.
todos: []
isProject: false
---

# Redirect Route Engine

## Current State

- **Router** ([src/router/index.ts](src/router/index.ts)): Has static routes (`/`, `/login`, `/dashboard`, `/privacy`, `/terms`, `/contact`) and a catch-all `/:pathMatch(.*)`* named `not-found` that renders [NotFoundView.vue](src/views/NotFoundView.vue).
- **404 page**: Exists and uses the "Transmission Failed" industrial aesthetic. Route name is `not-found`.
- **Design system**: APC Blue `#34418F`, Gold `#DEAC4B`, `font-mono`, dot-grid background. The Nothing OS industrial aesthetic is established across views.

## Implementation

### 1. Create RedirectView.vue

**File:** `src/views/RedirectView.vue` (new file)

**Template:** Terminal-style loading screen with:

- Full-height container (`h-screen w-full`) with light gray background `#E5E5E5`
- Animated scan line at top: horizontal bar with `#34418F` glow, sweeping animation
- Lightning bolt icon in a bordered square with corner dots (pulse animation)
- Heading: "Resolving Transmission" (font-mono, uppercase, APC blue)
- Target display: `Target: /{{ currentSlug }}` in a badge

**Script:** Composition API with:

- `useRoute()` and `useRouter()` from Vue Router
- `ref(route.params.slug)` for the current slug
- Mock database: `{ gelo: 'https://facebook.com/gelolaus', apc: 'https://apc.edu.ph' }`
- `onMounted` with 800ms `setTimeout`:
  - If slug found (case-insensitive): `window.location.replace(destination)`
  - If not found: `router.replace({ name: 'not-found' })`

**Animation:** The user's template references `animate-[scan_2s_ease-in-out_infinite]`. The `scan` keyframe does not exist in the project. Add a scoped `@keyframes scan` that moves the scan line (e.g., top-to-bottom or left-to-right pulse) so the arbitrary Tailwind animation works.

**Note:** The user's pasted template contained errant `>` characters at the start of some lines; these will be stripped during implementation.

---

### 2. Register the Dynamic Route

**File:** [src/router/index.ts](src/router/index.ts)

Add the `/:slug` route **immediately before** the catch-all route. Order is critical: if `/:slug` were after the catch-all, it would never match.

```ts
{
  path: '/:slug',
  name: 'redirect',
  component: () => import('@/views/RedirectView.vue'),
},
{
  path: '/:pathMatch(.*)*',
  name: 'not-found',
  component: () => import('@/views/NotFoundView.vue'),
},
```

This ensures:

- `/gelo` → RedirectView (slug = "gelo")
- `/apc` → RedirectView (slug = "apc")
- `/dashboard` → DashboardView (exact match takes precedence)
- `/privacy`, `/terms`, `/contact` → their respective views
- `/this-does-not-exist` → RedirectView mounts, mock lookup fails, router replaces to 404

---

## Flow Diagram

```mermaid
flowchart TD
    User[User visits /gelo or /apc or /invalid] --> Router[Vue Router]
    Router --> Match{Path match?}
    Match -->|/ /login /dashboard etc| Static[Static route]
    Match -->|Single segment e.g. /gelo| Slug[/:slug route]
    Slug --> RedirectView[RedirectView mounts]
    RedirectView --> UI[Terminal UI: Resolving Transmission]
    UI --> Wait[800ms setTimeout]
    Wait --> Lookup{Slug in mock DB?}
    Lookup -->|Yes| Redirect[window.location.replace]
    Lookup -->|No| Replace[router.replace not-found]
    Replace --> NotFound[NotFoundView 404]
```



---

## Testing Checklist

1. **Success (gelo):** `http://localhost:5173/gelo` → Resolving screen ~800ms → Facebook profile
2. **Success (apc):** `http://localhost:5173/apc` → Resolving screen ~800ms → apc.edu.ph
3. **Failure:** `http://localhost:5173/this-does-not-exist` → Resolving screen ~800ms → 404 Transmission Failed page
4. **Static routes unaffected:** `/dashboard`, `/privacy`, `/terms`, `/contact` still resolve correctly (they are defined before `/:slug`)

---

## Notes

- **UX rule** ([.cursor/rules/ux-copy-ctas.mdc](.cursor/rules/ux-copy-ctas.mdc)): "Resolving Transmission" is display/status text, not a CTA; no change needed.
- **Layout:** RedirectView uses `h-screen` for a full-viewport feel during the brief redirect. It renders inside `App.vue`'s `<main>`, so header/footer remain visible unless you later add a layout bypass for this route.
- **Mock DB:** Temporary; will be replaced with Turso/SQLite in a future phase.

