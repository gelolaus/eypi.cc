---
name: Mechanical Loading States
overview: Add simulated network latency and visual loading states to the "Shorten" and "Save" buttons in DashboardView.vue, with disabled state, pulse animation, and processing text that matches the industrial aesthetic.
todos: []
isProject: false
---

# Mechanical Loading States for Dashboard Buttons

## Target File

`[src/views/DashboardView.vue](src/views/DashboardView.vue)`

---

## 1. Add Loading State Refs (Script Setup)

Add two reactive boolean refs after the existing refs (around line 249):

```typescript
const isShortening = ref(false)
const isSaving = ref(false)
```

---

## 2. Add `handleShorten` and Update Top Bar Logic

**Current behavior:** The top "Shorten" button calls `openSidebar()` directly (line 17). `openSidebar()` without arguments uses `longUrlInput.value` and `hashToSlug(longUrlInput.value)` for the sidebar fields.

**New `handleShorten` function** (add after `openSidebar`):

```typescript
function handleShorten() {
  if (!longUrlInput.value) return
  isShortening.value = true
  setTimeout(() => {
    openSidebar()
    isShortening.value = false
  }, 600)
}
```

**Template change:** Update the top bar button (lines 13-19):

- `@click="handleShorten"` (instead of `openSidebar()`)
- Button text: `{{ isShortening ? 'PROCESSING...' : 'SHORTEN' }}`
- Add `:disabled="isShortening"`
- Add `:class="{ 'opacity-70 cursor-not-allowed animate-pulse': isShortening, 'hover:scale-105': !isShortening }"` (the existing `hover:scale-105` is already present; this keeps it conditional so it only applies when not loading)

---

## 3. Add `handleSave` and Update Sidebar Save Logic

**Current behavior:** `onSave()` (lines 291-315) updates or creates a link in `mockLinks`, shows a toast, and closes the sidebar.

**New `handleSave` function:** Wrap the existing `onSave` logic inside a `setTimeout` with 800ms latency:

```typescript
function handleSave() {
  isSaving.value = true
  setTimeout(() => {
    const short = sidebarSlug.value.trim()
      ? `eypi.cc/${sidebarSlug.value.trim()}`
      : `eypi.cc/${hashToSlug(sidebarOriginalUrl.value)}`
    if (activeLink.value) {
      const idx = mockLinks.value.findIndex((l) => l.id === activeLink.value!.id)
      if (idx !== -1) {
        mockLinks.value[idx] = {
          ...activeLink.value,
          original: sidebarOriginalUrl.value,
          short,
        }
        toast.success('Link successfully updated')
      }
    } else {
      mockLinks.value.push({
        id: Math.max(0, ...mockLinks.value.map((l) => l.id)) + 1,
        original: sidebarOriginalUrl.value,
        short,
        clicks: 0,
      })
      toast.success('New link successfully generated')
    }
    isSidebarOpen.value = false
    isSaving.value = false
  }, 800)
}
```

**Template change:** Update the sidebar Save button (lines 171-177):

- `@click="handleSave"` (instead of `onSave`)
- Button text: `{{ isSaving ? 'ENCRYPTING...' : 'SAVE' }}`
- Add `:disabled="isSaving"`
- Add `:class="{ 'opacity-70 cursor-not-allowed animate-pulse': isSaving, 'hover:bg-[#c5963b]': !isSaving }"` (replacing the current `hover:scale-[1.02]` with the darker gold hover per spec)

---

## 4. Summary of Template Edits


| Location                           | Change                                                        |
| ---------------------------------- | ------------------------------------------------------------- |
| Top bar button (line 14-19)        | `@click="handleShorten"`, dynamic text, `:disabled`, `:class` |
| Sidebar Save button (line 171-177) | `@click="handleSave"`, dynamic text, `:disabled`, `:class`    |


---

## 5. Optional: Keep `onSave` for Reuse

You can either:

- **Option A:** Inline the save logic inside `handleSave` (as shown above) and remove `onSave`.
- **Option B:** Keep `onSave` and call it from inside the `setTimeout` in `handleSave` to avoid duplication.

Option B is cleaner and easier to maintain. The plan above uses Option A for clarity; during implementation, Option B is recommended.

---

## Visual Result

- **Shorten:** When clicked with a valid URL, shows "PROCESSING...", pulses, is disabled for 600ms, then opens the sidebar.
- **Save:** When clicked, shows "ENCRYPTING...", pulses, is disabled for 800ms, then performs the save and closes the sidebar.

