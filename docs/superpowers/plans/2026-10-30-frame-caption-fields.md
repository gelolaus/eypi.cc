# Frame caption fields and downloads pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let frame owners write `{{Field}}` placeholders in a caption that visitors fill in through a form after downloading, and make the download count a noticeable pill.

**Architecture:** A pure parser in `shared/` is the single source of truth for what a field is. The backend uses it only to cap the field count; the browser uses it to render inline fields, the details dialog and the copied text. No schema change, and answers never leave the browser.

**Tech Stack:** Vue 3, Hono, Vitest, `@vue/test-utils` (happy-dom), shadcn-vue `Dialog`, `lucide-vue-next`.

**Spec:** [2026-10-30-frame-caption-fields-design.md](../specs/2026-10-30-frame-caption-fields-design.md)

## Global Constraints

- A field is `{{label}}`: label 1 to 40 characters after trimming, no `{`, `}` or line break. Anything else stays literal text.
- Field key is the label trimmed, spaces collapsed, lower-cased. Same key means one field, one answer.
- At most 10 distinct fields per caption. Caption max stays 2000 characters (`CAPTION_MAX`).
- Download is never blocked: the image downloads first, then the dialog opens only when a field is empty.
- Copied text: answered field becomes the trimmed answer; unanswered becomes `[Label]`. Copied text never contains `{{`.
- Answers stay in the browser tab. No answer is sent in a beacon, request or log.
- Caption text is rendered as text, never `v-html`.
- Colours come from design tokens only (dark mode and true black must work). Colour is never the only cue.
- Existing ids, `v-model`, `maxlength="2000"`, `rows="3"` and the `data-download-count` attribute are kept so existing tests and labels keep working.
- Commits: Conventional Commits, no trailers, each commit green (`npm run typecheck` and `npm test`).

## Review Focus

- Caption with `{{` and no closing `}}`, or `{{}}`: stays plain text, no field, no crash (Task 1).
- Same label twice, or differing only by case or spacing (`{{Name}}`, `{{ name }}`): one field, fills every occurrence (Tasks 1, 5).
- Answer containing `{{x}}` or HTML: shown and copied as plain text, never parsed again or injected (Tasks 5, 6).
- Caption with no fields: no dialog, copy identical to today (Tasks 5, 6).
- Download fails or the visitor has no photo: dialog must not open (Task 6).

---

### Task 1: Shared caption parser

**Files:**
- Create: `shared/captionFields.ts`
- Test: `shared/captionFields.test.ts`

**Interfaces:**
- Produces:
  - `type CaptionSegment = { type: 'text'; text: string } | { type: 'field'; key: string; label: string; raw: string }`
  - `type CaptionField = { key: string; label: string }`
  - `const MAX_CAPTION_FIELDS = 10`
  - `parseCaption(template: string): CaptionSegment[]`
  - `listFields(template: string): CaptionField[]` (distinct, order of first appearance, label of first occurrence)
  - `fillCaption(template: string, values: Record<string, string>): string`
  - `captionFieldError(template: string): string | null`

- [ ] **Step 1: Write the failing tests** in `shared/captionFields.test.ts`. Names and assertions:
  - `parses text and fields in order`: `parseCaption('Hi, I am {{Name}} of {{Committee Name}}!')` gives segments `text 'Hi, I am '`, field `{ key: 'name', label: 'Name', raw: '{{Name}}' }`, `text ' of '`, field `{ key: 'committee name', label: 'Committee Name', raw: '{{Committee Name}}' }`, `text '!'`.
  - `trims labels and collapses spaces in the key`: `{{  Full   Name }}` gives `label === 'Full Name'` (trimmed, inner spaces collapsed) and `key === 'full name'`.
  - `leaves invalid brackets as text`: `'{{}}'`, `'{{ }}'`, `'{{open'`, `'close}}'`, `'{{a{b}}'`, a 41-character label, and a label with `\n` each yield exactly one `text` segment equal to the input.
  - `treats repeated labels as one field`: `listFields('{{Name}} and {{ name }}')` has length 1 with `label: 'Name'`.
  - `fills answers and marks missing ones`: `fillCaption('Hi {{Name}} of {{Group}}', { name: ' Ana ' })` equals `'Hi Ana of [Group]'`.
  - `fills every occurrence of a key`: `fillCaption('{{Name}}/{{name}}', { name: 'Ana' })` equals `'Ana/Ana'`.
  - `does not reparse an answer`: `fillCaption('{{Name}}', { name: '{{Other}}' })` equals `'{{Other}}'`.
  - `limits distinct fields`: 10 distinct fields gives `null`; 11 gives the message `A caption can have at most 10 fields.`; 11 placeholders of 10 distinct keys gives `null`.
  - `empty template`: `parseCaption('')` is `[]`, `fillCaption('', {})` is `''`.

- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run shared/captionFields.test.ts` Expected: FAIL, module not found.

- [ ] **Step 3: Implement** the interface above in `shared/captionFields.ts`. Use one global regex `/\{\{([^{}\n]{1,40}?)\}\}/g` on the raw template, then reject matches whose trimmed label is empty (leave them as text). `fillCaption` builds output from segments, so answers are never reparsed.

- [ ] **Step 4: Run to verify pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit** `feat(frames): add the shared caption field parser`.

### Task 2: Backend field limit

**Files:**
- Modify: `backend/src/routes/dp.ts` (create handler near the `CAPTION_MAX` check at `:253`, edit handler near the one at `:520`)
- Test: `backend/src/routes/dp.test.ts`

**Interfaces:**
- Consumes: `captionFieldError(template: string): string | null` from `../../../shared/captionFields` (same import style as `../../../shared/avatars` in `account.ts`).

- [ ] **Step 1: Write the failing tests** in the existing `frame campaigns` describe, reusing the helpers there (`json`, `frameDataUrl`, `seedOrg`, `createTestApp`):
  - `rejects a caption with more than 10 fields on create`: POST `/api/dp` with 11 distinct `{{a1}}`…`{{a11}}` gives status 400 and body message `A caption can have at most 10 fields.`
  - `accepts a caption with fields on create`: 3 fields gives 201 and the stored `caption_template` equals the sent caption.
  - `rejects and accepts the same on edit`: PATCH `/api/dp/:id` with 11 fields gives 400; with 2 fields gives 200.

- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run backend/src/routes/dp.test.ts` (from the repo root; if the repo needs `cd backend`, use that). Expected: the 400 tests FAIL.

- [ ] **Step 3: Implement.** In both handlers, after the length check, `const fieldError = captionFieldError(captionTemplate); if (fieldError) return c.json({ status: 'error', message: fieldError }, 400)`.

- [ ] **Step 4: Run to verify pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit** `feat(frames): cap caption fields at ten on create and edit`.

### Task 3: Downloads pill

**Files:**
- Create: `src/components/dp/DownloadPill.vue`
- Modify: `src/views/dp/DpCampaignsView.vue:77-80`, `src/views/dp/DpPublicView.vue:39-45`
- Test: `src/components/dp/DownloadPill.test.ts`; update `src/views/dp/DpPublicView.test.ts` and `src/views/dp/DpCampaignsView` tests only where they assert the old markup

**Interfaces:**
- Produces: `<DownloadPill :count="number" />`. Renders a rounded-full pill with the lucide `Download` icon (decorative, `aria-hidden`), the count in bold with `tabular-nums` formatted `toLocaleString('en-US')`, and `download` or `downloads`. Root element carries `data-download-count`. Colours: a primary tint background and primary text from tokens.

- [ ] **Step 1: Write the failing tests.** `DownloadPill.test.ts`: `shows 1 download`, `shows 91 downloads`, `formats 1,234 downloads`, `hides the icon from assistive tech` (the svg has `aria-hidden="true"`), `exposes data-download-count`.
- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run src/components/dp/DownloadPill.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement `DownloadPill.vue`** and use it: in `DpCampaignsView.vue` replace the download stat block (shown for every campaign, including 0); in `DpPublicView.vue` replace the `<p data-download-count>` and keep its `v-if="campaign.downloadCount >= 1"`.
- [ ] **Step 4: Run to verify pass.** Run: `npx vitest run src/components/dp src/views/dp` Expected: PASS (fix any old-markup assertions to the new pill).
- [ ] **Step 5: Commit** `feat(frames): show downloads as a pill on the list and public page`.

### Task 4: Caption editor with highlighted placeholders

**Files:**
- Create: `src/components/dp/CaptionEditor.vue`
- Modify: `src/views/dp/DpNewCampaignView.vue:101-112`, `src/views/dp/DpEditCampaignView.vue:128-140`
- Test: `src/components/dp/CaptionEditor.test.ts`; keep `DpEditCampaignView.test.ts` green

**Interfaces:**
- Consumes: `parseCaption`, `captionFieldError`, `MAX_CAPTION_FIELDS` from `@shared/captionFields`.
- Produces: `<CaptionEditor v-model="string" id="string" />`. Forwards `rows="3"`, `maxlength="2000"` and `id` to a real `<textarea>` styled like the existing `Textarea` (`font-mono`, `resize-y`). Behind it a mirror `<div aria-hidden="true">` with identical font, padding, wrapping and scroll position renders the text with each field's `raw` inside `<mark>`. Mark style: token tint plus underline. Below it a hint `Use {{Name}} to ask visitors for their details. Up to 10 fields.`, which turns into the `captionFieldError` message when set. Text is rendered as text.

- [ ] **Step 1: Write the failing tests.** `wraps each valid placeholder in a mark including brackets` (`'Hi {{Name}}'` gives one `mark` with text `{{Name}}`); `does not mark invalid brackets` (`'{{}} {{open'` gives no `mark`); `emits update:modelValue when typing`; `forwards id, rows and maxlength to the textarea`; `shows the field limit message at 11 fields`; `escapes html in the mirror` (`'<b>{{Name}}</b>'` has no `b` element).
- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run src/components/dp/CaptionEditor.test.ts` Expected: FAIL.
- [ ] **Step 3: Implement `CaptionEditor.vue`.** Make the textarea text transparent with a visible caret (`caret-color`), keep scroll in sync on the `scroll` event, and use the same border, radius, focus ring and padding classes on a wrapper so the mirror lines up. Swap it into both campaign views with the same `v-model="form.captionTemplate"`.
- [ ] **Step 4: Run to verify pass.** Run: `npx vitest run src/components/dp src/views/dp` Expected: PASS.
- [ ] **Step 5: Commit** `feat(frames): highlight caption placeholders for owners`.

### Task 5: Inline caption fields and filled copy

**Files:**
- Create: `src/components/dp/CaptionFields.vue`
- Modify: `src/views/dp/DpPublicView.vue` (caption card at `:191-211`, `copyCaption` at `:389`)
- Test: `src/components/dp/CaptionFields.test.ts`, `src/views/dp/DpPublicView.test.ts`

**Interfaces:**
- Consumes: `parseCaption`, `fillCaption` from `@shared/captionFields`.
- Produces: `<CaptionFields :template="string" v-model:answers="Record<string, string>" />`. Renders segments in a `whitespace-pre-wrap font-mono text-sm leading-relaxed` paragraph. Each field is an inline `<input type="text">`: `placeholder` and `aria-label` are the label, width follows content (`field-sizing: content` with a `ch`-based `min-width` fallback), visible border and background from tokens, normal focus ring, `maxlength="200"`. Fields with the same key share one answer.
- `DpPublicView.vue` owns `answers = ref<Record<string, string>>({})` and passes it to `CaptionFields`. `copyCaption` writes `fillCaption(campaign.captionTemplate, answers.value)`. A caption without fields renders exactly the old text.

- [ ] **Step 1: Write the failing tests.** `CaptionFields`: `renders an input per distinct field with the label as placeholder`, `shows plain text around the fields`, `two occurrences of one key share a value`, `typing emits update:answers keyed by field key`, `renders an answer containing html as text`. `DpPublicView`: `copies the filled caption` (answers `Name` then copy gives `writeText` called with the filled text), `copies [Label] for an empty field`, `copies a caption without fields unchanged` (existing `Hello #eypi` test stays green), `never puts an answer in a beacon call`.
- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run src/components/dp/CaptionFields.test.ts src/views/dp/DpPublicView.test.ts` Expected: new tests FAIL.
- [ ] **Step 3: Implement** both pieces as described.
- [ ] **Step 4: Run to verify pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(frames): edit caption fields inline and copy the filled caption`.

### Task 6: Details dialog after download

**Files:**
- Create: `src/components/dp/CaptionFormDialog.vue`
- Modify: `src/views/dp/DpPublicView.vue` (`download` at `:366`, caption card ref)
- Test: `src/components/dp/CaptionFormDialog.test.ts`, `src/views/dp/DpPublicView.test.ts`

**Interfaces:**
- Consumes: `listFields`, `fillCaption`, `CaptionField` from `@shared/captionFields`; `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` from `@/components/ui/dialog`; `Button`, `Input`, `Label` from the existing ui folders.
- Produces: `<CaptionFormDialog v-model:open="boolean" :template="string" v-model:answers="Record<string, string>" />`. Title `Add your details`. One labelled `Input` per distinct field, first empty one focused on open. Under them, the caption preview as text from `fillCaption`. An "x" close button with accessible name `Close` (reuse the one `DialogContent` already renders if it has one; otherwise add it), `Esc` closes, and a `Done` button closes. Typing updates `answers` live. Closing keeps the answers.
- In `DpPublicView.vue`: a `captionCardRef`, and after `download()` succeeds (after the `download` beacon), when `listFields(template)` has a field with no answer: `captionCardRef.value?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })` where `reduced` is `matchMedia('(prefers-reduced-motion: reduce)').matches`, then `open = true`.

- [ ] **Step 1: Write the failing tests.** `CaptionFormDialog`: `lists one input per distinct field`, `typing updates the answers and the preview`, `the x button closes and keeps answers`, `Done closes`, `Escape closes`. `DpPublicView`: `opens the details dialog after a successful download when a field is empty`, `does not open when every field is answered`, `does not open for a caption without fields`, `does not open when the download fails or there is no photo`, `scrolls the caption card into view before opening`, `skipping with the x leaves the inline fields editable`, `the download and download-count requests still fire when the dialog opens`.
- [ ] **Step 2: Run to verify failure.** Run: `npx vitest run src/components/dp/CaptionFormDialog.test.ts src/views/dp/DpPublicView.test.ts` Expected: new tests FAIL.
- [ ] **Step 3: Implement** the dialog and the trigger. Teleported dialog content is queried through `document.body` in tests; stub `scrollIntoView` (happy-dom has none) on `Element.prototype`.
- [ ] **Step 4: Run to verify pass.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(frames): ask visitors for caption details after they download`.

### Task 7: Docs, full check, live look

**Files:**
- Modify: `AGENTS.md` (table row for the spec and this plan), `CONTEXT.md` (one line defining "caption field" in the product vocabulary, only if it lists frames terms)
- Modify: this plan (tick the boxes)

- [ ] **Step 1:** Add the two rows to the `AGENTS.md` "Where the truth lives" table and the `CONTEXT.md` term.
- [ ] **Step 2: Run the full check.** Run: `npm run typecheck && npm test` Expected: both pass with no failures.
- [ ] **Step 3: Look at it in the browser.** Run `npm run dev:local`, open a frame campaign editor and the public page. Check the highlight in the editor, then the public page in light, dark and true black: download, form opens, inline fields update, copy gives the filled text. Report anything not checked.
- [ ] **Step 4: Commit** `docs(frames): index the caption fields spec and plan`.
