# Schedule wallpaper design

Date: 2026-10-30. Status: approved design, not built.

## Goal

A signed-in APC student pastes their class schedule from RAMS and gets a phone wallpaper (a PNG sized for their phone) to use as a lock screen. It is the Eypi version of `gelolaus/Scheds`, built for APC and with better output: exact phone sizes, a clear lock-screen safe zone, three layouts, themes and a photo background.

## What the owner decided

- **Stateless in v1, room to grow.** Paste, preview, download. Nothing is saved. The design must let a later version store the parsed schedule on the account (option 2) without rework.
- **Signed-in APC users only.** The route lives in the app shell behind the existing sign-in and consent gates. It is not org-gated: every APC account can use it.
- **Paste only in v1.** No screenshots or OCR. A whole-page select-all and copy must work, because copying only the table is hard on mobile.
- **The student chooses the layout:** A weekly grid, B agenda list, C subject cards. Default B.
- **Auto-detected size** with a dropdown override and a custom size.
- **Themes plus the student's own photo as the background.** No per-subject colours or fonts in v1.
- **Canvas 2D rendering**, the same approach as Frames.

## Out of scope for v1

Saving schedules, sharing or importing classmates' schedules, OCR, per-subject colours, fonts, and usage analytics. The Frames module-event beacon could count downloads later without a schema change.

## Design

### 1. Units

| Unit | Does | Depends on |
|---|---|---|
| `shared/schedule/parseRams.ts` | Pasted text to `{ term, subjects[] }` plus warnings. Pure, no DOM. | nothing |
| `shared/schedule/layout.ts` | Merges identical days, hides empty days, computes the timeline range and conflicts. | parser types |
| `src/lib/wallpaper/` | `renderGrid`, `renderAgenda`, `renderCards`, `background.ts`, `themes.ts`, `sizes.ts`. Draws one layout onto a canvas at a size, theme and optional photo. | `layout.ts`, canvas, fonts |
| `src/views/wallpaper/WallpaperView.vue` | Paste box, live preview and controls. Lazy chunk in the app shell at `/wallpaper`. | the above |

The parser and layout live in `shared/` so a later backend (saved schedules) can reuse them. No backend, schema or migration change in v1. The pasted text and the photo never leave the browser.

### 2. Data shape

```ts
type Meeting = { day: 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun'; start: number; end: number; room: string; async?: boolean }
type Subject = { code: string; section: string; units: number; instructor: string; meetings: Meeting[] }
type ParsedSchedule = { term: string | null; subjects: Subject[]; warnings: string[] }
```

`start` and `end` are minutes since midnight. `units` is parsed but not drawn. `instructor` is drawn as the last name and first given name (`Doe, Jordan`), so a student sees who teaches each class. Real names come only from the student's own paste in the browser; the repository, fixtures and tests use made-up names only. The student's name and number are never parsed into the result.

### 3. Parser

It anchors on patterns, not columns, so a whole-page copy (sidebar, header, footer) works and so does a table-only copy.

- **Term:** `Academic Year & Term:` followed by a year range and `Term N`, for example `2026 -2027, Term 2` (note the stray space). The result is a display title like `2026-2027 · Term 2`. Missing term gives `null`.
- **Table:** starts at the header row (`Subject Code ... Instructor`). It ends at `Total Units` or the end of the text.
- **Row:** begins at a subject code (uppercase letters and digits, 4 to 10 characters) followed by a section token, then a units value like `3.0`. Everything up to the next row start belongs to that subject.
- **Meetings:** collect day names, time ranges (`h:mmAM - h:mmPM`) and room tokens in order, then pair them by position (first day with first time with first room).
- **Cases from the real samples:**
  - Two-day rows (Tue and Fri) give two meetings.
  - ALPHA1 lists Monday twice: `1:30PM - 3:30PM` in room `1001` and `12:50PM - 1:30PM` in room `ASYNC`. Both are kept; the second is marked `async` and drawn as "Async".
  - Merged sections like `AB101/AB102/EF251` stay one string.
  - Rooms may be free text (`Library`, `508-A`).
  - Saturday-only subjects work.
  - The instructor is the remaining text of the row (`Last, First Middle`).
- **Warnings:** any row start with no readable meeting, and any day or time that cannot be paired, adds a human-readable warning. The rows that parsed are still returned.
- **Open item:** one real copy from RAMS on a phone is needed as a fixture. If its text order differs, the pairing step is the part that changes.

### 4. Layout helpers (`layout.ts`)

- Group days that have identical meetings into one label (`Tue · Fri`) for layout B; layout A and C keep days separate or list days per subject.
- Hide days with no meetings, so Saturday and Sunday show only when a subject meets then.
- Timeline range for layout A: earliest start to latest end, rounded out to whole hours, with a minimum span. The grid borders sit on those whole hours (7:00 AM to 6:00 PM for classes from 7:30 AM to 5:30 PM); the lines and labels sit on the class times, every two hours from 7:30 (7:30, 9:30, 11:30, 1:30, 3:30, 5:30).
- Conflicts: two meetings on the same day that overlap in time are flagged. Renderers draw them side by side with a marker.

### 5. Renderers and the safe zone

- Each renderer takes `{ schedule, size, theme, photo?, dim }` and draws on a canvas. The preview renders at a reduced scale and the download at full size, by the same code path.
- **Safe zone:** nothing is drawn above 30% of the height of the canvas (the lock-screen clock and widgets). Content begins under the title line. A test asserts the rule for all three layouts and a range of aspect ratios (16:9 to 20:9).
- **Text fitting:** subject codes and rooms are short; if a line does not fit its block, the font shrinks to a minimum and then clips with an ellipsis. No overlap with the next block.
- **Fonts:** the renderers wait for the Eypi fonts (`document.fonts.load`) before drawing, and fall back to a system sans if loading fails.
- **Themes:** Light, Dark, True black and APC blue and gold, each a palette of background, text, muted text, accent and a fixed list of block colours (taken from the design tokens, with contrast checked for text on blocks).
- **Photo background:** cover-fit crop to the output size, then a dark or light overlay at the chosen dim level (0 to 80%). If the photo is smaller than the output size, a note is shown (it is still used).

### 6. Page (`WallpaperView.vue`)

- **Desktop:** two columns. Paste box and controls on the left, live phone-shaped preview on the right.
- **Mobile:** one column: paste box, preview, controls. A short tip says to select the whole page, copy, and paste. The page does not read the clipboard automatically (iOS does not allow it); a "Paste from clipboard" button appears only where the browser supports it.
- **Controls, in order:** layout (A, B, C; default B), theme, photo and dim slider, size, Download PNG. On phones that support it, a Share button saves to Photos.
- **Size:** auto-detected from `screen.width × devicePixelRatio` on a phone. On desktop it defaults to 1170×2532, with a list of common sizes and a custom width and height (limits 320 to 4000 px per side).
- **Copy and a11y:** the UI follows `DESIGN_SYSTEM.md` (wantap tokens in all three themes). The preview carries alt text listing the classes. All controls are keyboard-reachable, and the dim slider shows its value.
- **Navigation:** a "Wallpaper" item in the side rail and tab bar. The route and nav entry follow the existing router and `SPA_SEGMENTS` rules in `public/sw-strategies.js` (kept in sync and tested in `worker/sw.test.ts`).

### 7. Errors and edge cases

- **Nothing recognised:** an empty state tells the student to copy the whole schedule page and paste it. No stack trace, no silent failure.
- **Some rows unreadable:** parsed rows are drawn and the warnings list the rest above the preview.
- **No classes in a layout (all async):** the renderer shows the title and an empty-week message.
- **Very long paste:** input is capped (for example 100,000 characters) before parsing.
- **Privacy:** parsing and drawing run in the browser. The name, student number and the photo are not sent anywhere, stored or logged.

### 8. Performance

The page is a lazy chunk, so the entry bundle budgets (JS ≤ 70,000 B, CSS ≤ 22,000 B gzip) are untouched, and `npm run release:check` must still pass. No new dependency is added. The preview redraw is debounced and uses the reduced scale.

## Testing

- **Parser:** the three samples the owner pasted (2025-2026 Term 3, 2026-2027 Term 1 and Term 2) as fixtures, with expected `ParsedSchedule` results, including the ALPHA1 async case, merged sections, `Library` and `508-A`. Plus a whole-page copy (sidebar, header, name, footer) giving the same result, a table-only copy, garbage text, and (when available) a mobile copy.
- **Layout:** day merging, empty-day hiding, timeline range, conflict detection.
- **Renderers:** the safe-zone rule for A, B and C across aspect ratios, and clipping or shrinking for long text (using a stubbed canvas context).
- **View:** paste updates the preview, layout and theme switches, the size options, the warnings and empty states, and the download action.
- `npm run typecheck`, `npm test` and `npm run release:check` pass.
