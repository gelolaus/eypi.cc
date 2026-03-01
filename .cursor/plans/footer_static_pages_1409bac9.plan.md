---
name: Footer Static Pages
overview: Create Privacy, Terms, and Contact static pages with an industrial document-style aesthetic, register routes, and wire footer links to the new pages.
todos: []
isProject: false
---

# Footer Static Pages Implementation

## Current State

- **Router** ([src/router/index.ts](src/router/index.ts)): Has home, login, dashboard, and a catch-all 404 route. New routes must be added **before** the `/:pathMatch(.*)`* route.
- **Footer** ([src/components/TheFooter.vue](src/components/TheFooter.vue)): Privacy, Terms, and Contact links currently use `href="#"` and need to point to the new routes.
- **Views**: Existing views use Vue 3 Composition API with `<script setup>`. No Tailwind Typography plugin is installed; the template uses manual spacing (`mb-6`, `mt-8`, etc.) instead of `prose` classes.

## Implementation Plan

### 1. Create the Three View Files

All three views share the same layout structure. Use the project's existing `apc-blue` color (`#34418F`) from [tailwind.config.js](tailwind.config.js) for consistency.

**File: [src/views/PrivacyView.vue](src/views/PrivacyView.vue)**

- Header: `[ PRIVACY PROTOCOL ]`
- Last Updated: `System Time 2026.03.01`
- Content: Telemetry collection and data handling boilerplate (as specified)
- Replace `prose prose-gray` with a simple `div` and manual spacing (no typography plugin needed)

**File: [src/views/TermsView.vue](src/views/TermsView.vue)**

- Header: `[ TERMS OF SERVICE ]`
- Same layout structure, boilerplate terms-of-service text (acceptable use, liability, etc.)

**File: [src/views/ContactView.vue](src/views/ContactView.vue)**

- Header: `[ SECURE COMMUNIQUÉ ]`
- Body text with `mailto:` link: `Direct inquiries to: support@eypi.cc`

### 2. Universal Template Structure (All Three Files)

```html
<template>
  <div class="min-h-screen bg-[#E5E5E5] text-gray-800 flex justify-center py-24 px-6 relative z-10">
    <div class="w-full max-w-3xl bg-white border border-gray-300 p-12 md:p-16 shadow-2xl relative">
      <div class="absolute top-0 left-0 w-full h-2 bg-[#34418F]"></div>
      
      <div class="border-b-2 border-gray-200 pb-8 mb-12">
        <h1 class="font-mono text-3xl font-black text-[#34418F] uppercase tracking-widest mb-2">[ TITLE ]</h1>
        <p class="font-mono text-xs text-gray-500 uppercase tracking-widest">Last Updated: System Time 2026.03.01</p>
      </div>

      <div class="max-w-none font-mono text-sm leading-relaxed">
        <!-- Page-specific content -->
      </div>
  
      <div class="mt-16 pt-8 border-t border-gray-200">
        <router-link to="/dashboard" class="font-mono text-sm font-bold text-[#34418F] hover:text-black uppercase tracking-wider transition-colors">
          ← Return to Console
        </router-link>
      </div>
    </div>
  </div>
</template>
```

### 3. Register Routes

Add the three routes in [src/router/index.ts](src/router/index.ts) **before** the catch-all route (lines 23–27):

```typescript
{ path: '/privacy', name: 'privacy', component: () => import('@/views/PrivacyView.vue') },
{ path: '/terms', name: 'terms', component: () => import('@/views/TermsView.vue') },
{ path: '/contact', name: 'contact', component: () => import('@/views/ContactView.vue') },
```

### 4. Update Footer Links

In [src/components/TheFooter.vue](src/components/TheFooter.vue), change the three `<a href="#">` elements to `<router-link>` for SPA navigation:

- Privacy → `to="/privacy"`
- Terms → `to="/terms"`
- Contact → `to="/contact"`

---

## File Summary


| Action | File                                        |
| ------ | ------------------------------------------- |
| Create | `src/views/PrivacyView.vue`                 |
| Create | `src/views/TermsView.vue`                   |
| Create | `src/views/ContactView.vue`                 |
| Edit   | `src/router/index.ts` (add 3 routes)        |
| Edit   | `src/components/TheFooter.vue` (wire links) |


## Notes

- **Prose classes**: The original template used `prose prose-gray`; the project does not have `@tailwindcss/typography`. The plan uses manual spacing (`mb-6`, `mt-8`, `mb-4`) instead, which matches the existing structure.
- **Cursor rule**: [.cursor/rules/ux-copy-ctas.mdc](.cursor/rules/ux-copy-ctas.mdc) advises against bracketed text for CTAs. The bracketed headers (`[ PRIVACY PROTOCOL ]`) are document titles, not buttons, so they align with the requested industrial aesthetic.

