# Notifications — toast, modal, and inline feedback

**Status:** Approved 2026-07-12  
**Scope:** Full migration of frontend feedback channels (~120 toast call sites, 7 `window.confirm` sites, form-generator `alert()`s, one-off auth/delete modals).

## Goal

Replace the current soft, easy-to-miss toast and mixed confirm patterns with two branded surfaces and clear channel rules:

1. **Signal strip** toast for short async / clipboard outcomes
2. **Mica** Info and Confirm dialogs for must-read and destructive flows
3. **Inline field errors** for client-side validation

Update `DESIGN_SYSTEM.md` §6.5–6.6 so the live UI and the spec match.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Migration breadth | Full: reclassify every call site; kill `window.confirm` and form `alert()`s |
| Toast look | Signal strip (equalizer bars + sentence-case message + mono `OK`/`ERR`/`INFO` tag) |
| Modal look | Login mica card (`.mica-card` glass, rounded-2xl); not red-stripe or square “signal panel” |
| Validation | Inline under the field; no validation toasts |
| Confirm friction | Type-to-confirm for high-stakes only; routine deletes use mica + red CTA |
| Architecture | Extend `useToast`; add `useDialog` + `DialogHost`; no third-party toast library |

## Channel rules

| Channel | When | Examples |
|---|---|---|
| Signal strip | Short outcome after async or clipboard work; user keeps working | Link created, copied, saved, API/network error |
| Inline field error | Client validation on a known input | Email, password policy, URL/slug, file type/size |
| Info mica | Must-read before continuing; multi-step next action | Registration “check your inbox”; form-generator success |
| Confirm mica | Destructive or irreversible | Delete link/member (red CTA); org/event/campaign delete, leave org, transfer, re-raffle (type-to-confirm) |
| Leave as-is | Already the right channel | VerifyView banner, QR scan HUD, LocalDevBanner, OrgLockout, slide-over panels |

**Out of channel:** `window.confirm()`, form-generator `alert()`, validation toasts, success toasts that only restate a modal the user already dismissed.

## Signal strip

**Files:** `src/composables/useToast.ts`, `src/components/ToastContainer.vue` (mounted in `App.vue`).

### Visual

- Position: `fixed; bottom: 1.5rem; right: 1.5rem; z-index: 9999`
- Shape: square corners (`border-radius: 0`); width ~320px
- Content row: status equalizer (4 bars in type color) + Geist sentence-case message + Geist Mono type tag (`OK` / `ERR` / `INFO`)
- Colors: success `#10b981`, error `#ef4444`, info `#34418F` (`--color-primary`)
- Surface: white / dark `mica-navy.modal`; border `g-border`; `shadow-xl`
- Motion: existing Quick In-Out `0.3s cubic-bezier(0.2, 1, 0.3, 1)`; respect `prefers-reduced-motion`

### Behavior

| Rule | Value |
|---|---|
| Success / info duration | 4s |
| Error duration | 7s |
| Dismiss | Click strip or ×; Esc dismisses topmost |
| Hover | Pause auto-dismiss timer |
| Stack cap | 3; drop oldest |
| Dedup | Same type + message refreshes timer instead of stacking |
| Optional detail | Second line only when it states a next action |

### API

```ts
toast.success(message: string, opts?: { detail?: string; duration?: number })
toast.error(message: string, opts?: { detail?: string; duration?: number })
toast.info(message: string, opts?: { detail?: string; duration?: number })
```

Call sites that only pass a string keep working. Prefer short concrete copy (`Could not save link. Check the URL.`). No emoji. Message is sentence case, not uppercase mono.

### A11y

- Container: `aria-live="polite"` (errors may use `assertive` when the strip is the only feedback)
- Each item: `role="status"`
- Dismiss control: `aria-label="Dismiss"`

## Mica dialogs

**Files (new):** `src/composables/useDialog.ts`, `src/components/DialogHost.vue` (or `ConfirmDialog.vue` + `InfoDialog.vue` behind one host). Mount host in `App.vue` beside `ToastContainer`.

### Visual

- Same shell as Login verification modal: `.mica-card`, `max-w-md`, `rounded-2xl`, backdrop `bg-slate-900/20` / `dark:bg-slate-900/80` + `backdrop-blur-sm`
- Info primary CTA: APC Gold `#DEAC4B`
- Confirm primary CTA: `#ef4444` (hover `#dc2626`); Abort secondary border button
- Title: Geist sans, neutral `text-g-text` (not red title chrome)
- No red top stripe; no square “signal panel” header

### Behavior

| Variant | API shape | Returns |
|---|---|---|
| Info | `dialog.info({ title, body, confirmLabel? })` | `Promise<void>` on dismiss |
| Confirm | `dialog.confirm({ title, body, confirmLabel, requireText? })` | `Promise<boolean>` |

- Esc and backdrop click = abort (`false` / dismiss)
- Focus trap; restore focus to opener
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- Z-index: DialogHost above toasts (`10000`); slide panels (`99990+`) stay above when open

### Type-to-confirm (`requireText`)

Required when the prompt includes `requireText` (exact string the user must type; slug or resource title). Confirm button stays disabled until the input matches.

**High-stakes (typing required):**

- Delete org, delete event, delete campaign
- Leave org
- Transfer ownership
- Re-raffle cluster

**Routine (mica + red CTA, no typing):**

- Delete link
- Remove member

## Inline field errors

Replace client-side validation toasts (~25 sites) with error text under the failing control.

- Show on submit (or blur if the form already does)
- Clear on edit
- Wire `aria-invalid` and `aria-describedby` to the error element
- Prefer one shared pattern (small component or consistent class + message binding); do not invent a second toast channel for “fix the highlighted fields”

## Migration map

### Stay on Signal strip (restyle only)

CRUD success/error, clipboard copy, session expired, org switch label, list load failures that already toast, EventDetail check-in dynamic messages, Settings password update success/error, login/register API failures (server-side), email-verified redirect toast on Login.

### Validation toast → inline

LoginView / register fields, SettingsView password fields, LinksView URL/slug/logo checks, DpFrameUploader file rules, NewEventView CSV gate, and any other client `toast.error` before an API call.

### Info mica

- LoginView registration success: replace one-off modal with `dialog.info` (same copy intent: check APC inbox)
- Form generators (`LetterOfIntentView`, `VisitorsPassView`, `ConcessionaireView`): replace success `alert()` with Info; replace failure `alert()` with Signal strip error (user remains on the page)

### Confirm mica

| Site | Typing? |
|---|---|
| `LinksView` delete (replace inline delete modal) | No |
| `OrgModifyView` remove member | No |
| `OrgModifyView` leave org | Yes |
| `OrgModifyView` / `OrgManagementEditView` transfer | Yes (already modal; unify shell + typing where needed) |
| `OrgManagementEditView` delete org | Yes |
| `EventsView` / `EventDetailView` delete event | Yes |
| `EventDetailView` re-raffle | Yes |
| `DpCampaignsView` / `DpEditCampaignView` delete campaign | Yes |

### Docs

Rewrite `DESIGN_SYSTEM.md`:

- §6.6 → Signal strip anatomy, durations, stack/dedup, API
- Modal section → mica Info/Confirm; channel table; type-to-confirm rules
- Remove red-stripe delete modal as the canonical destructive pattern

## Copy rules

From DESIGN_SYSTEM §2 and no-ai-slop:

- Errors state the next action
- No em dashes, hollow intensifiers, marketing filler, or emoji in strips
- Confirm titles name the action (`Delete this link?`)
- Info titles name the gate (`Check your inbox`)
- Type-to-confirm copy names the exact string (`Type abc to confirm.`)

## Out of scope

- QR scan HUD, LocalDevBanner, OrgLockout, VerifyView page banner
- Slide-over edit / analytics panels
- New toast/dialog npm dependency
- Sound / haptics
- Backend email content (except surfacing existing registration messaging via Info modal if useful)

## Implementation order (for the plan)

1. Signal strip UI + `useToast` behavior (durations, dismiss, stack, dedup)
2. `useDialog` + mica DialogHost; migrate Login registration Info
3. Confirm: Links delete + replace all `window.confirm`
4. High-stakes `requireText` on org/event/campaign/leave/transfer/re-raffle
5. Inline validation migration across forms
6. Form-generator `alert()` → Info / Signal strip
7. `DESIGN_SYSTEM.md` update + sweep remaining toast copy for §2 compliance

## Success criteria

- No `window.confirm` or form-generator `alert()` in `src/`
- No client validation toast; those errors sit on the field
- One toast visual (Signal strip) and one modal shell (mica) in production UI
- Destructive high-stakes flows require typing the resource identifier
- DESIGN_SYSTEM §6.5–6.6 matches shipped components
