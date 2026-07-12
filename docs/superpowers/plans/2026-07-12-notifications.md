# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Signal strip toasts, mica Info/Confirm dialogs, and inline field validation per `docs/superpowers/specs/2026-07-12-notifications-design.md`.

**Architecture:** Module-scoped `useToast` + `ToastContainer`; new `useDialog` + `DialogHost` mounted in `App.vue`. Call sites reclassified by channel rules. No new npm deps.

**Tech Stack:** Vue 3, TypeScript, existing `.mica-card` / `g-*` tokens, DESIGN_SYSTEM.md

## Global Constraints

- No em dashes or marketing filler in UI copy
- No `window.confirm` or form-generator `alert()` left in `src/`
- Toast API remains callable as `toast.success(msg)` (string-only call sites keep working)
- Type-to-confirm only for high-stakes deletes listed in the spec

---

### Task 1: Signal strip

**Files:**
- Modify: `src/composables/useToast.ts`
- Modify: `src/components/ToastContainer.vue`

- [ ] Rebuild toast state: detail, duration defaults (4s/7s), stack cap 3, dedup, dismiss, pause on hover
- [ ] Rebuild ToastContainer as Signal strip UI
- [ ] Keep `success`/`error`/`info(msg, dur?)` working; accept opts object as second arg

### Task 2: Mica DialogHost

**Files:**
- Create: `src/composables/useDialog.ts`
- Create: `src/components/DialogHost.vue`
- Modify: `src/App.vue`

- [ ] `dialog.info` / `dialog.confirm` with Promise API and `requireText`
- [ ] Mount DialogHost in App.vue at z-index 10000

### Task 3: Auth + destructive confirms

- [ ] LoginView: `dialog.info` for registration; inline validation
- [ ] Replace all `window.confirm` with `dialog.confirm`
- [ ] LinksView: replace inline delete modal with `dialog.confirm` (no typing)
- [ ] High-stakes: pass `requireText`

### Task 4: Validation + alerts + docs

- [ ] Settings, Links, DP uploader, NewEvent: inline field errors
- [ ] Form generators: Info / Signal strip instead of `alert()`
- [ ] Update DESIGN_SYSTEM.md §6.5–6.6
