# Frame caption fields and downloads pill design

Date: 2026-10-30. Status: awaiting owner review.

## Goal

1. Let frame owners write `{{Field}}` placeholders in a campaign caption. When a visitor downloads the frame, a small form asks for those details and fills the caption, so each person copies a caption that is already personal.
2. Make the download count easier to notice, on the Frames list and on the public frame page.

## What the owner decided

- Placeholders are written as `{{Name}}` or `{{Committee Name}}`. The text inside the brackets is the field's label and placeholder.
- **Download is never blocked.** The image downloads immediately. Then the page scrolls to the caption and opens the form (option A, chosen by the owner).
- The form is an overlay with the caption below it and an "x" to close. A visitor can skip it and fill the caption inline later.
- In the caption card every field is an editable box inside the paragraph, with the label as its placeholder, so a visitor can change an answer after the form.
- When a field has an answer, its brackets are gone from the caption.
- Owners editing the caption see the bracketed text (brackets included) in a highlight colour.

## Current state (read from the code)

- `dp_campaigns.caption_template` holds the raw caption, at most 2000 characters (`CAPTION_MAX` in `backend/src/routes/dp.ts`). Create and edit already validate and store it; the public payload returns it as `captionTemplate`.
- The public page (`src/views/dp/DpPublicView.vue`) shows the caption as one `<p>` and copies it verbatim with `copyCaption`, which sends a `share` beacon.
- Owners edit it in a plain `Textarea` in `DpNewCampaignView.vue` and `DpEditCampaignView.vue`.
- The download count is plain text at `DpPublicView.vue:40` (muted mono) and a number plus small label at `DpCampaignsView.vue:78`.
- `shared/` already holds pure, tested helpers used by both frontend and backend (for example `slugRules.ts`).

## Design

### 1. No schema change

`caption_template` keeps the raw `{{...}}` text. Answers are never sent to or stored on the server: they live in the visitor's browser tab only, and the `share` and `download` beacons are unchanged. This keeps visitors' details out of the database and logs.

### 2. Shared parser: `shared/captionFields.ts`

Pure functions, no DOM, unit-tested in `shared/captionFields.test.ts`.

- `parseCaption(template)` returns an ordered list of segments: `{ type: 'text', text }` or `{ type: 'field', key, label }`.
- A field matches `{{label}}` where the label is 1 to 40 characters after trimming, with no `{`, `}` or line break. Anything else (`{{}}`, an unclosed `{{`, a 41-character label) stays literal text.
- `key` is the label trimmed, with runs of spaces collapsed, lower-cased. Two placeholders with the same key are **one field**: it is asked once and fills every occurrence. The label shown is the first occurrence's.
- `listFields(template)` returns the distinct fields in order of first appearance.
- `fillCaption(template, values)` returns the plain caption text. A field with an answer is replaced by that answer (trimmed). A field with no answer is replaced by `[Label]`, so copied text never contains `{{}}` and clearly shows what is missing.
- A caption may have at most **10 distinct fields**. `captionFieldError(template)` returns a message when it has more, and `null` otherwise.

### 3. Backend

`POST /api/dp` and `PATCH` for a campaign call `captionFieldError` next to the existing length check and answer `400` with its message. No other backend change for this feature. The public and editor payloads already carry `captionTemplate`.

### 4. Owner editing: `CaptionEditor.vue`

Replaces the plain `Textarea` in the new and edit campaign views, with the same `v-model`, `maxlength`, rows and id (so existing labels and tests keep working).

- One real `<textarea>` stays on top, so typing, undo, spellcheck and screen readers behave as before. Its text is transparent only while a mirror layer below shows the same text with each valid `{{...}}` wrapped in a `<mark>`. The mirror copies the textarea's font, padding, wrapping and scroll position.
- The highlight uses a theme token (a tint of the primary or accent colour that meets contrast in light, dark and true black), never a fixed hex. It also gets an underline, so colour is not the only cue.
- A hint line sits under the box: `Use {{Name}} to ask visitors for their details. Up to 10 fields.` A caption with more than 10 fields shows the same message the backend would return.

### 5. Visitor view

**`CaptionFields.vue`** renders the caption card's paragraph from `parseCaption`. Text is plain text (never `v-html`). Each distinct field is an inline `<input>`:

- the placeholder and `aria-label` are the field's label;
- the width follows the content (`field-sizing: content`, with a `ch`-based fallback), so it sits in the sentence like a fill-in-the-blank;
- it looks like an editable box: a visible border and background from the design tokens, with the normal focus ring;
- every occurrence of one key shares one value.

The answers live in one reactive map in `DpPublicView.vue`, keyed by field key. Neither the inline boxes nor the form is a `<form>` that submits anywhere.

**`CaptionFormDialog.vue`** is the overlay, built on the app's existing dialog primitive (confirmed in the plan):

- title `Add your details`, one labelled input per distinct field, the caption preview below, and a `Done` button;
- an "x" close button with an accessible name, and `Esc` closes it as well;
- typing updates the answers live, so the preview below fills as they type;
- closing it, by "x", `Esc`, or `Done`, keeps whatever was typed and leaves the inline boxes editable.

### 6. When the form opens

After `downloadFrame` succeeds (the existing path at `DpPublicView.vue:378`, which fires the `download` beacon), if the caption has at least one field **and** at least one field is still empty:

1. scroll the caption card into view (smooth, or instant when `prefers-reduced-motion` is set);
2. open the form and move focus to its first empty input.

If every field already has an answer, nothing opens. A caption with no `{{}}` behaves exactly as today, with no form and no extra step. If the download itself fails, the form does not open.

### 7. Copy

`copyCaption` copies `fillCaption(captionTemplate, answers)` instead of the raw template and still sends the `share` beacon. The toast text is unchanged.

### 8. Downloads pill: `DownloadPill.vue`

One small component, used by `DpCampaignsView.vue` and `DpPublicView.vue`.

- A rounded pill with the lucide `Download` icon, the count in bold with tabular numerals, and the word `download` or `downloads`, using a primary tint background and primary text from the tokens (no fixed colours, so dark mode and true black work).
- The public page keeps hiding it when the count is 0 and keeps the `data-download-count` attribute. The Frames list shows it for every campaign, including 0.
- The count is read with the pill's text, so screen readers announce `91 downloads` and the icon is decorative.

## Out of scope

- Field types (dropdown, date, required), conditional fields, or saving a visitor's answers anywhere.
- Remembering answers between visits.
- Changing the old `download_count` column or endpoint.

## Open questions for the owner

1. **Empty field on copy.** If a visitor copies without filling a field, the copied text shows `[Name]`. Is that right, or should it copy the label alone, or block copying until it is filled?
2. **Pill on the public page.** I plan to restyle both pills. Say so if you want only the Frames list.

## Testing

- `shared/captionFields.test.ts`: parsing, trimming, repeated labels, invalid brackets, `fillCaption` with and without answers, the 10-field limit.
- Backend: create and edit reject more than 10 fields and accept a caption with fields.
- `CaptionEditor`: highlights valid placeholders and leaves literal text alone, `v-model` round-trips.
- `DpPublicView`: the form opens after a successful download only when a field is empty, `x` and `Esc` close it, answers update the inline boxes and the copied text, a caption without fields shows no form, no answer ever reaches a beacon body.
- `DownloadPill`: singular and plural, hidden at 0 on the public page, shown at 0 in the list.
- Done means `npm run typecheck` and `npm test` pass and the change matches `DESIGN_SYSTEM.md`.
