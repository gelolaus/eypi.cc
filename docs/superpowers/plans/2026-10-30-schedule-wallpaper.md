# Schedule wallpaper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in APC student pastes a RAMS class schedule at `/wallpaper` and downloads a phone-sized PNG wallpaper.

**Architecture:** A pure parser and layout helpers in `shared/schedule/` turn pasted text into a `ParsedSchedule`. Canvas 2D renderers in `src/lib/wallpaper/` (one per layout) draw it at the phone's pixel size. A lazy Vue view hosts the paste box, live preview and controls. Everything runs in the browser; nothing is stored or uploaded.

**Tech Stack:** Vue 3, TypeScript, Vitest (happy-dom for `src/`), Canvas 2D, existing `file-saver`, shadcn-style UI in `src/components/ui/`.

**Spec:** `docs/superpowers/specs/2026-10-30-schedule-wallpaper-design.md`

## Global Constraints

- No new dependency. Entry bundle budgets stay (JS ≤ 70,000 B, CSS ≤ 22,000 B gzip); the page is a lazy chunk.
- Nothing is sent to the server, stored or logged: not the pasted text, the student's name or number, or the photo.
- Layouts: `grid` (A), `agenda` (B, the default), `cards` (C). Themes: `light`, `dark`, `black`, `apc`.
- Lock-screen safe zone: nothing drawn above 30% of the canvas height (`SAFE_ZONE_RATIO = 0.3`).
- Default size 1170×2532; custom size 320 to 4000 px per side and at most 16,000,000 pixels in area. Dim 0 to 80%. Paste capped at 100,000 characters.
- UI follows `DESIGN_SYSTEM.md` (read sections 2, 5, 6, 7, 9 and 13 first): tokens only, no `dark:` utilities, no mica, no Geist. The product is called "Eypi" in the UI.
- Commits: Conventional Commits, `type(scope): lowercase imperative subject`, then `- bullet` lines. Scope `wallpaper` unless noted. No `Co-Authored-By` or any AI/tool trailer. One commit per task, each green. Tick the task's boxes in this file and include it in that commit.
- Run `npx vitest run <file>` for single files. A task is done when its tests pass and `npm run typecheck` passes.

## Review Focus

Inputs the spec implies but a straight reading would miss, each pinned by a test in the named task:

1. Text copied from a browser has CRLF, tabs and non-breaking spaces (Task 2).
2. Section and room tokens look like subject codes (`AB101`, `XY01`, `1001`) and must not start a row (Task 3).
3. The noon boundary: `12:50PM - 1:30PM` must come out as 770 to 810, not 50 to 810 (Task 4).
4. A 12 MP phone photo and a huge custom size can exceed canvas limits (Tasks 8 and 11).
5. Overlapping classes and a schedule with no timed meetings (all async or empty) (Tasks 7, 12, 13 and 14).

## File Structure

```
shared/schedule/types.ts            Day, Meeting, Subject, ParsedSchedule
shared/schedule/fixtures.ts         the three RAMS samples (Appendix) and a whole-page wrapper
shared/schedule/parseRams.ts        normalizeText, parseTerm, splitRows, parseMeetings, parseRams
shared/schedule/layout.ts           entriesByDay, groupDays, timelineRange, findConflicts
src/lib/wallpaper/types.ts          LayoutId, ThemeName, RenderInput
src/lib/wallpaper/sizes.ts          PRESETS, DEFAULT_SIZE, detectSize, clampSize
src/lib/wallpaper/themes.ts         THEMES, contrastRatio, readableOn
src/lib/wallpaper/safeZone.ts       SAFE_ZONE_RATIO, contentTop
src/lib/wallpaper/text.ts           fitText, ensureFonts
src/lib/wallpaper/format.ts         formatClock, formatRange
src/lib/wallpaper/background.ts     coverRect, loadPhoto, drawBackground, isSmallerThan
src/lib/wallpaper/renderAgenda.ts, renderGrid.ts, renderCards.ts
src/lib/wallpaper/render.ts         render, renderToBlob, wallpaperFilename
src/lib/wallpaper/testContext.ts    recording canvas context for renderer tests
src/composables/useWallpaper.ts     view state: text, parse result, options, debounced redraw
src/components/wallpaper/WallpaperPreview.vue, WallpaperControls.vue
src/views/wallpaper/WallpaperView.vue
```

Each unit has a `.test.ts` beside it. Modified: `shared/reservedSlugs.ts`, `worker/index.ts`, `public/sw-strategies.js`, `src/router/index.ts`, `src/config/nav.ts`, `src/components/layout/appNav.ts`, `CONTEXT.md`, and the tests that list routes, titles and nav.

---

### Task 1: Types and fixtures

**Files:** Create `shared/schedule/types.ts`, `shared/schedule/fixtures.ts`.

**Produces:**
```ts
export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
export type Meeting = { day: Day; start: number; end: number; room: string; async?: boolean } // minutes since midnight
export type Subject = { code: string; section: string; units: number; instructor: string; meetings: Meeting[] }
export type ParsedSchedule = { term: string | null; subjects: Subject[]; warnings: string[] }
// fixtures.ts
export const SAMPLE_TERM3: string; export const SAMPLE_TERM1: string; export const SAMPLE_TERM2: string  // table-only text
export function wholePage(table: string, term: string): string  // adds sidebar, name, term line, Total Units, footer
```

- [x] **Step 1:** Write the types as above.
- [x] **Step 2:** Write the fixtures from the Appendix verbatim (a tab after the units value, then a newline), and `wholePage` as described in the Appendix.
- [x] **Step 3:** `npm run typecheck` passes.
- [x] **Step 4: Commit** `test(wallpaper): add rams schedule types and sample fixtures`

---

### Task 2: Text normalising and the term line

**Files:** Create `shared/schedule/parseRams.ts`, `shared/schedule/parseRams.test.ts`.

**Produces:**
```ts
export const MAX_PASTE_LENGTH = 100_000
export function normalizeText(raw: string): string  // CRLF to LF, NBSP and tabs to spaces, trims each line, drops blank lines
export function parseTerm(text: string): string | null  // '2026-2027 · Term 2'
```

- [x] **Step 1: Failing tests**
  - `normalizeText` turns `'A B\r\n\tC  \r\n\r\nD'` into `'A B\nC\nD'`.
  - `parseTerm` returns `'2026-2027 · Term 2'` for `'Academic Year & Term: 2026\n -2027, Term 2'` and for the same text on one line with `2026 -2027`; returns `null` when absent.
- [x] **Step 2:** Run `npx vitest run shared/schedule/parseRams.test.ts`; expect FAIL (not defined).
- [x] **Step 3:** Implement both. The term pattern allows any whitespace around the dash and the comma.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): normalize pasted text and read the term line`

---

### Task 3: Splitting rows

**Files:** Modify `shared/schedule/parseRams.ts` and its test.

**Produces:**
```ts
export type RawRow = { code: string; section: string; units: number; lines: string[] } // lines after the units value
export function splitRows(normalized: string): RawRow[]
```
A row starts at a line matching code, section and units on one line: `^([A-Z][A-Z0-9]{2,9})\s+([A-Z0-9][A-Z0-9/-]*)\s+(\d+\.\d)\b`. Rows end at the next row start or at a line starting `Total Units`. The remainder of the start line after the units (if any) is ignored.

- [x] **Step 1: Failing tests**
  - `splitRows` on `normalizeText(SAMPLE_TERM2)` returns codes `['MIKE1','NOVEMBER1','OSCAR1','PAPA1','QUEBEC1']` with sections `AB101`, `AB101`, `AB101/AB102`, `XY01`, `AB101`.
  - On `SAMPLE_TERM3`, section `XYZ01-T` and units `2.0` for ALPHA1 are read.
  - Room and section lines do not start rows: `'1001'`, `'ASYNC'`, `'AB101'`, `'XY01'` alone on a line never produce a row.
  - `wholePage(SAMPLE_TERM1, ...)` returns the same six rows as the table-only text, and nothing from the sidebar text or the `Total Units` line.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement `splitRows`.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): split a pasted schedule into subject rows`

---

### Task 4: Pairing meetings

**Files:** Modify `shared/schedule/parseRams.ts` and its test.

**Produces:**
```ts
export function parseMeetings(row: RawRow): { meetings: Meeting[]; instructor: string; warnings: string[] }
export function toMinutes(h: number, m: number, meridiem: 'AM' | 'PM'): number
```
Collect the day lines (full day names to `Day`), then time lines (`h:mmAM - h:mmPM`), then as many room lines as there are days (the next N lines); the remaining text is the instructor. Pair by position. A room that is `ASYNC` (any case) becomes `room: ''` with `async: true`. If counts differ, return the pairs that exist and a warning naming the subject code.

- [x] **Step 1: Failing tests**
  - `toMinutes(12, 50, 'PM')` is 770, `toMinutes(12, 0, 'AM')` is 0, `toMinutes(9, 30, 'AM')` is 570, `toMinutes(5, 30, 'PM')` is 1050.
  - QUEBEC1 gives `[{day:'Tue',start:810,end:930,room:'203'},{day:'Fri',start:810,end:930,room:'203'}]` and instructor `Ng, Ellis Zoe Ora`.
  - ALPHA1 gives two Monday meetings: `{start:810,end:930,room:'1001'}` and `{start:770,end:810,room:'',async:true}`.
  - OSCAR1 (Saturday, one meeting, 450 to 690, room `502`); HOTEL1 rooms `'Library'`; BRAVO1 room `'508-A'`; KILO1 section kept whole as `AB101/AB102/EF251` (assert at the `parseRams` level in Task 5).
  - A row with two days but one time yields one meeting and a warning containing the code.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): pair days, times and rooms into meetings`

---

### Task 5: `parseRams`

**Files:** Modify `shared/schedule/parseRams.ts` and its test.

**Produces:** `export function parseRams(raw: string): ParsedSchedule`. It truncates input to `MAX_PASTE_LENGTH`, normalises, reads the term, splits rows, parses each row, and collects warnings. It never includes the student's name or number.

- [x] **Step 1: Failing tests**
  - For each of the three samples, table-only and `wholePage(...)` give identical `subjects`, equal to the expected counts in the Appendix (subjects and meetings). The term is `null` for table-only text and the matching term for `wholePage` (`'2025-2026 · Term 3'`, `'2026-2027 · Term 1'`, `'2026-2027 · Term 2'`).
  - `parseRams('hello')` returns `{ term: null, subjects: [], warnings: [] }`; `parseRams('')` likewise.
  - A paste of 150,000 characters of repeated sample text does not throw and reads only the first 100,000.
  - `JSON.stringify(parseRams(wholePage(SAMPLE_TERM2, ...)))` does not contain `DOE`, `2000-000000` or `Jane`.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run `npx vitest run shared/schedule`; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): parse a rams schedule from pasted text`

---

### Task 6: Days and merging

**Files:** Create `shared/schedule/layout.ts`, `shared/schedule/layout.test.ts`.

**Produces:**
```ts
export type Entry = { code: string; section: string; day: Day; start: number; end: number; room: string; async: boolean }
export const DAY_ORDER: Day[]  // Mon to Sun
export function entriesByDay(s: ParsedSchedule): Partial<Record<Day, Entry[]>>  // only days with timed or async meetings, each sorted by start
export type DayGroup = { days: Day[]; label: string; entries: Entry[] }  // label like 'Tue · Fri'
export function groupDays(s: ParsedSchedule): DayGroup[]  // days whose entries match on code, start, end, room merge; groups in week order
```

- [x] **Step 1: Failing tests**
  - Term 2 sample: `Object.keys(entriesByDay(...))` is `['Tue','Fri','Sat']` (no Mon, Wed, Thu).
  - `groupDays` gives two groups: label `'Tue · Fri'` with four entries sorted by start (NOVEMBER1, MIKE1, QUEBEC1, PAPA1) and `'Sat'` with OSCAR1.
  - Term 3 sample: Monday (it has the two ALPHA1 entries) and Thursday are separate groups, and Tuesday (it has BRAVO1) and Friday are separate groups, because their entries differ; assert the label list is `['Mon','Tue','Thu','Fri']`.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): group schedule days for layout`

---

### Task 7: Timeline range and conflicts

**Files:** Modify `shared/schedule/layout.ts` and its test.

**Produces:**
```ts
export function timelineRange(s: ParsedSchedule): { startHour: number; endHour: number }  // timed meetings only, rounded out to whole hours, minimum span 4 hours, default 8 to 17 when none
export type Conflict = { day: Day; a: Entry; b: Entry }
export function findConflicts(s: ParsedSchedule): Conflict[]  // overlapping on the same day; touching ends (end === start) do not conflict
```

- [x] **Step 1: Failing tests**
  - Term 2 range is `{ startHour: 7, endHour: 18 }` (7:30 start, 5:30 PM end).
  - A schedule with one 9:00 to 10:00 class gives a 4-hour span; a schedule with no timed meetings (only async) gives `{ startHour: 8, endHour: 17 }`.
  - Two Monday classes 9:00 to 11:00 and 10:30 to 12:00 conflict; 9:00 to 10:00 and 10:00 to 11:00 do not.
  - Term 3 sample (ALPHA1 12:50 to 1:30 and 1:30 to 3:30 on Monday): no conflict.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): compute timeline range and detect conflicts`

---

### Task 8: Sizes

**Files:** Create `src/lib/wallpaper/sizes.ts`, `sizes.test.ts`.

**Produces:**
```ts
export type Size = { width: number; height: number }
export type SizePreset = Size & { id: string; label: string }
export const DEFAULT_SIZE: Size  // 1170 x 2532
export const PRESETS: SizePreset[]  // iPhone 15 and 16 (1179x2556), iPhone 13 and 14 (1170x2532), iPhone SE (750x1334), Pixel 8 (1080x2400), Galaxy S24 (1080x2340), Android 20:9 (1080x2400), Android 16:9 (1080x1920)
export function detectSize(env: { screenWidth: number; screenHeight: number; pixelRatio: number; coarsePointer: boolean }): Size | null  // null on desktop
export function clampSize(size: Size): Size  // each side 320 to 4000, area at most 16,000,000 (scale both sides down, keeping the ratio)
```

- [x] **Step 1: Failing tests**
  - `DEFAULT_SIZE` is `{1170, 2532}`.
  - `detectSize({screenWidth:390,screenHeight:844,pixelRatio:3,coarsePointer:true})` is `{1170, 2532}`; landscape input is swapped to portrait; `coarsePointer:false` returns `null`.
  - `clampSize({width:100,height:100})` is `{320,320}`; `clampSize({width:4000,height:4000})` has area ≤ 16,000,000 and the same ratio; `clampSize({width:1080,height:2400})` is unchanged.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): add phone sizes, detection and clamping`

---

### Task 9: Themes

**Files:** Create `src/lib/wallpaper/types.ts`, `themes.ts`, `themes.test.ts`.

**Produces:**
```ts
// types.ts
export type LayoutId = 'grid' | 'agenda' | 'cards'
export type ThemeName = 'light' | 'dark' | 'black' | 'apc'
// themes.ts
export type Theme = { bg: string; text: string; muted: string; accent: string; blocks: string[] }
export const THEMES: Record<ThemeName, Theme>
export function contrastRatio(a: string, b: string): number  // WCAG ratio of two #rrggbb colours
export function readableOn(color: string): string  // '#000000' or '#ffffff', whichever contrasts more
```
Palettes come from `DESIGN_SYSTEM.md` section 2: light (`#f5f5f5` background, `#0a0a0a` text, `#5c5c5c` muted, accent `#35438c`), dark (`#0a0a0a`, `#ededed`, `#a3a3a3`, accent `#8b97d8`), black (`#000000` background, otherwise dark), `apc` (`#35438c` background, `#ffffff` text, `#deac4b` accent). Five block colours per theme from the `--chart-1` to `--chart-5` values of the matching theme.

- [x] **Step 1: Failing tests**
  - Every theme has five blocks; `text` on `bg` and `muted` on `bg` have `contrastRatio ≥ 4.5`; `readableOn(block)` on each block is ≥ 4.5.
  - `contrastRatio('#000000','#ffffff')` is 21 (within 0.01); `readableOn('#35438c')` is `'#ffffff'`.
- [x] **Step 2:** Run; expect FAIL. If a muted colour fails, lighten or darken it until the test passes.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): add wallpaper themes with contrast checks`

---

### Task 10: Safe zone and text fitting

**Files:** Create `src/lib/wallpaper/safeZone.ts`, `text.ts`, `testContext.ts`, `text.test.ts`.

**Produces:**
```ts
export const SAFE_ZONE_RATIO = 0.3
export function contentTop(height: number): number
export function fitText(ctx: Pick<CanvasRenderingContext2D, 'measureText' | 'font'>, text: string, maxWidth: number, font: { size: number; min: number; weight: number; family: string }): { text: string; size: number }  // shrinks to min, then clips with an ellipsis
export function ensureFonts(): Promise<void>  // document.fonts.load for Plus Jakarta Sans 600 and Syne 700; never rejects
export function createRecordingContext(width: number, height: number): RecordingContext  // test helper: measureText = 0.6 * size per char; records { op, x, y, text? } for fillText, fillRect, roundRect, drawImage
```

- [x] **Step 1: Failing tests (`text.test.ts`)**
  - `contentTop(2532)` is 760; `contentTop(1920)` is 576.
  - `fitText` returns the text unchanged and the starting size when it fits; shrinks the size (not below `min`) when it does not; at `min` it clips and ends with `…` and the measured width is ≤ `maxWidth`.
  - `ensureFonts()` resolves when `document.fonts` is missing or its `load` rejects.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): add safe zone, text fitting and font loading`

---

### Task 11: Background photo

**Files:** Create `src/lib/wallpaper/background.ts`, `background.test.ts`.

**Produces:**
```ts
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number): { sx: number; sy: number; sw: number; sh: number }  // centred crop with the destination's aspect ratio
export function isSmallerThan(photo: { width: number; height: number }, width: number, height: number): boolean
export async function loadPhoto(file: File): Promise<ImageBitmap>  // createImageBitmap(file, { imageOrientation: 'from-image' }); if the longest side exceeds 4096, decode again with resizeWidth/resizeHeight so it does; rejects with Error('Choose an image file.') for non-images
export function drawBackground(ctx: CanvasRenderingContext2D, width: number, height: number, theme: Theme, photo: ImageBitmap | null, dim: number): void  // fills theme.bg; with a photo draws the cover crop then an overlay of theme.bg at alpha clamp(dim, 0, 0.8)
```

- [x] **Step 1: Failing tests**
  - `coverRect(4000, 3000, 1080, 2400)` crops width: `sw/sh` equals `1080/2400` and the crop is centred.
  - `coverRect(1000, 3000, 1080, 2400)` crops height instead, centred.
  - `isSmallerThan({width:800,height:600}, 1080, 2400)` is true; a larger photo is false.
  - `loadPhoto` with a stubbed `createImageBitmap` returning a 6000×8000 bitmap calls it a second time with a resize so the longest side is 4096; with a `text/plain` file it rejects with the message above.
  - `drawBackground` with no photo calls `fillRect(0,0,w,h)` once; with a photo and `dim: 2` the overlay alpha is 0.8; with `dim: -1` it is 0.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): add photo background with cover crop and dim`

---

### Task 12: Agenda renderer (layout B)

**Files:** Create `src/lib/wallpaper/format.ts`, `format.test.ts`, `renderAgenda.ts`, `renderAgenda.test.ts`; Modify `types.ts`.

**Produces:**
```ts
// types.ts
export type RenderInput = { schedule: ParsedSchedule; width: number; height: number; theme: ThemeName; layout: LayoutId; photo: ImageBitmap | null; dim: number }
// format.ts
export function formatClock(minutes: number): string  // 770 -> '12:50 PM', 450 -> '7:30 AM', 0 -> '12:00 AM'
export function formatRange(start: number, end: number): string  // '7:30 to 9:30 AM'; across noon '11:30 AM to 1:30 PM'
// renderAgenda.ts
export function renderAgenda(ctx: CanvasRenderingContext2D, input: RenderInput): void
```
Draws the background, then the term title at `contentTop(height)`, then each `groupDays` group as a day label (accent, uppercase) followed by rows of start time (`formatClock`, muted) and `CODE · room` (`Async` when async); a conflict marker (`!`) before the code. Scale all sizes from `width`. Rows that would pass the bottom margin (4% of height) are dropped and a final `+N more` line is drawn instead. An empty week draws the title and `No classes to show.`.

- [x] **Step 1: Failing tests (using `createRecordingContext`)**
  - `formatClock(770)` is `'12:50 PM'`, `formatClock(0)` is `'12:00 AM'`; `formatRange(450, 570)` is `'7:30 to 9:30 AM'`; `formatRange(690, 810)` is `'11:30 AM to 1:30 PM'`.
  - For `parseRams(SAMPLE_TERM2)` at 1170×2532, 1080×1920 and 1080×2400: every recorded `fillText` has `y ≥ contentTop(height)`, and the texts include `TUE · FRI`, `SAT`, `MIKE1 · 318` and `OSCAR1 · 502`.
  - An async meeting draws `ALPHA1 · Async`.
  - An empty schedule draws `No classes to show.` and no day labels.
  - Overlapping classes draw the `!` marker.
  - Nothing is drawn below `height * 0.96`.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): add the agenda wallpaper layout`

---

### Task 13: Grid renderer (layout A)

**Files:** Create `src/lib/wallpaper/renderGrid.ts`, `renderGrid.test.ts`.

**Produces:** `export function renderGrid(ctx: CanvasRenderingContext2D, input: RenderInput): void`. Visible days from `entriesByDay` become equal-width columns with a day header; hour lines and labels on the left from `timelineRange`; each timed entry is a rounded block (theme block colour by subject code order, text from `readableOn`) at its time position, with the code and room via `fitText`. Overlapping entries on a day split the column width. Async entries are listed as a line of text under the grid. The grid sits between `contentTop + title` and the bottom margin.

- [x] **Step 1: Failing tests**
  - Term 2 at three sizes: all `fillText` y ≥ `contentTop(height)`; three day headers `TUE`, `FRI`, `SAT` and no `MON`; five distinct subject codes drawn.
  - A block for a 7:30 to 9:30 class starts above one for a 9:30 to 11:30 class (smaller y), and its height equals the block for another 2-hour class.
  - Two overlapping entries on one day are drawn with half-width blocks (each `roundRect` width ≤ half the column).
  - Term 3 (ALPHA1 async) draws `Async` below the grid; an empty schedule draws `No classes to show.`.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): add the weekly grid wallpaper layout`

---

### Task 14: Cards renderer (layout C)

**Files:** Create `src/lib/wallpaper/renderCards.ts`, `renderCards.test.ts`.

**Produces:** `export function renderCards(ctx: CanvasRenderingContext2D, input: RenderInput): void`. One rounded card per subject in the order pasted, each with the code (bold), then lines of `Tue Fri · 7:30 to 9:30 AM · 208` per distinct time and room (days with the same time and room joined). Card height is shared so up to 7 subjects fit; more than fit becomes `+N more`.

- [x] **Step 1: Failing tests**
  - Term 2: five cards, texts include `NOVEMBER1`, `Tue Fri · 7:30 to 9:30 AM · 208`, `OSCAR1`, `Sat · 7:30 to 11:30 AM · 502`; all y ≥ `contentTop(height)` at three sizes.
  - ALPHA1 draws two lines: `Mon · 1:30 to 3:30 PM · 1001` and `Mon · 12:50 to 1:30 PM · Async`.
  - A schedule with 9 subjects draws 7 cards and `+2 more`; an empty schedule draws `No classes to show.`.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement, using `formatRange` from Task 12.
- [x] **Step 4:** Run `npx vitest run src/lib/wallpaper`; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): add the subject cards wallpaper layout`

---

### Task 15: Render entry and export

**Files:** Create `src/lib/wallpaper/render.ts`, `render.test.ts`.

**Produces:**
```ts
export async function render(canvas: HTMLCanvasElement, input: RenderInput): Promise<void>  // awaits ensureFonts, sizes the canvas to input.width x height, dispatches by layout
export async function renderToBlob(input: RenderInput): Promise<Blob>  // draws on a new canvas; canvas.toBlob('image/png'); rejects with Error('Could not render the image. Try again.') when toBlob gives null
export function wallpaperFilename(schedule: ParsedSchedule, layout: LayoutId): string  // 'eypi-schedule-2026-2027-term-2.png' or 'eypi-schedule.png' without a term
```

- [x] **Step 1: Failing tests** (stub `getContext` and `toBlob` as `DpPublicView.test.ts` does)
  - `render` calls only the renderer for the chosen layout and sets `canvas.width/height`.
  - `renderToBlob` resolves a PNG blob and rejects with the message above when `toBlob` yields null.
  - `wallpaperFilename` returns the two names above.
- [x] **Step 2:** Run; expect FAIL.
- [x] **Step 3:** Implement.
- [x] **Step 4:** Run; expect PASS.
- [x] **Step 5: Commit** `feat(wallpaper): add render dispatch, png export and file names`

---

### Task 16: Reserve the path

**Files:** Modify `shared/reservedSlugs.ts`, `worker/index.ts` (`SPA_EXACT_PATHS`).

- [ ] **Step 1:** Add `'wallpaper'` to the "Suite modules" line of `RESERVED_SLUGS` and `'/wallpaper'` to `SPA_EXACT_PATHS`.
- [ ] **Step 2:** In `shared/reservedSlugs.test.ts` add `expect(isReservedSlug('wallpaper')).toBe(true)` to the "blocks known reserved slugs" test.
- [ ] **Step 3:** Run `npx vitest run shared/reservedSlugs.test.ts worker/index.test.ts`; expect PASS.
- [ ] **Step 4: Commit** `feat(wallpaper): reserve the wallpaper path for short links`
  - add `wallpaper` to the reserved slugs and the worker SPA paths

---

### Task 17: Route, nav and a placeholder page

**Files:** Create `src/views/wallpaper/WallpaperView.vue` (an `AppPage` titled "Wallpaper" with no content yet); Modify `src/router/index.ts`, `src/config/nav.ts`, `src/components/layout/appNav.ts`, `public/sw-strategies.js` (add `'wallpaper'` to `SPA_SEGMENTS`), `src/router/documentTitle.test.ts`, `src/components/layout/appNav.test.ts`.

- [ ] **Step 1: Failing tests**
  - `documentTitle.test.ts`: add `wallpaper: 'Wallpaper'` to `pages`.
  - `appNav.test.ts`: `APP_NAV` labels become `Dashboard, Links, Tix, My tickets, Frames, Forms, Wallpaper, Orgs, Invites` with `/wallpaper` after `/forms`; the overflow list gains `Wallpaper`; tabs are unchanged.
  - Run `npx vitest run src/router src/components/layout worker/sw.test.ts shared/reservedSlugs.test.ts`; expect FAIL.
- [ ] **Step 2:** Add the route after Forms: `{ path: '/wallpaper', name: 'wallpaper', component: () => import('@/views/wallpaper/WallpaperView.vue'), meta: { requiresAuth: true, title: 'Wallpaper' } }`. Add `'wallpaper'` to `NavIconName`, the nav item `{ to: '/wallpaper', label: 'Wallpaper', icon: 'wallpaper' }` after Forms in `APP_ITEMS`, and map `wallpaper` to lucide `Smartphone` in `appNav.ts`.
- [ ] **Step 3:** Run the same command; expect PASS. Then `npm test` and fix any other test that lists nav items or routes.
- [ ] **Step 4: Commit** `feat(wallpaper): add the wallpaper route and nav entry`
  - add `/wallpaper` as a signed-in route with a placeholder page
  - add `wallpaper` to the service worker SPA segments, the side rail and the tab overflow

---

### Task 18: View state

**Files:** Create `src/composables/useWallpaper.ts`, `useWallpaper.test.ts`.

**Produces:**
```ts
export function useWallpaper(): {
  text: Ref<string>; parsed: ComputedRef<ParsedSchedule>  // parseRams on text, debounced 150 ms
  layout: Ref<LayoutId>  // 'agenda'
  theme: Ref<ThemeName>  // 'dark'
  size: Ref<Size>  // detectSize(...) ?? DEFAULT_SIZE, always through clampSize
  photo: Ref<ImageBitmap | null>; dim: Ref<number>  // 0.45
  photoNotice: ComputedRef<string | null>  // 'This photo is smaller than the wallpaper, so it may look soft.'
  hasSchedule: ComputedRef<boolean>
  setPhoto(file: File): Promise<void>; clearPhoto(): void
}
```

- [ ] **Step 1: Failing tests** (fake timers)
  - Setting `text` to `SAMPLE_TERM2` updates `parsed` only after 150 ms; `hasSchedule` is true; clearing text makes it false.
  - Defaults are `agenda`, `dark`, dim 0.45; `size` is clamped when set to `{width: 99999, height: 99999}`.
  - `setPhoto` with a stubbed `loadPhoto` sets `photo`; a rejected load keeps the previous photo and exposes the error message through a `photoError` ref; `photoNotice` shows when the photo is smaller than `size`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5: Commit** `feat(wallpaper): add the wallpaper view state`

---

### Task 19: Preview component

**Files:** Create `src/components/wallpaper/WallpaperPreview.vue`, `WallpaperPreview.test.ts`.

**Interfaces:** Consumes `render`, `RenderInput`. Props: `input: RenderInput`. Draws a canvas scaled to fit the column (a phone-shaped frame, max 320 px wide) and redraws when `input` changes (debounced to the next animation frame). Alt text: an `aria-label` on the canvas reading `Wallpaper preview. ` plus the classes grouped by day (from `groupDays`), or `No classes to show.`.

- [ ] **Step 1: Failing tests** (stub `render`)
  - Mounting calls `render` once with the input; changing `layout` calls it again.
  - `aria-label` contains `Tue · Fri` and `MIKE1` for the Term 2 sample, and `No classes to show.` for an empty schedule.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5: Commit** `feat(wallpaper): add the live wallpaper preview`

---

### Task 20: Controls component

**Files:** Create `src/components/wallpaper/WallpaperControls.vue`, `WallpaperControls.test.ts`.

**Interfaces:** Props and `v-model`s for `layout`, `theme`, `dim`, `size`; props `photoName: string | null`, `photoNotice`, `photoError`; emits `photo(file)`, `clearPhoto`. Uses `Tabs` (layout: "Grid", "Agenda", "Cards"), `Tabs` or a radio group (theme: "Light", "Dark", "True black", "APC"), a file `Input` with a "Choose photo" button and "Remove photo", `Slider` for dim with a visible percent value and `thumbLabel="Photo dimming"`, `Select` for size presets plus "Custom" revealing width and height `Input`s (numbers, clamped on blur through `clampSize`).

- [ ] **Step 1: Failing tests**
  - Clicking "Cards" emits `update:layout` with `'cards'`; the default selected tab matches the prop.
  - Choosing a preset emits its size; choosing Custom shows two number inputs, and entering `99999` for both emits the clamped size.
  - The dim slider shows `45%` for `0.45`; the file input emits `photo` with the chosen file; "Remove photo" appears only with a `photoName` and emits `clearPhoto`; `photoNotice` and `photoError` render as text.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement following the component catalogue in `DESIGN_SYSTEM.md` section 7 (sizes `h-11`, tab keyboard behaviour from the primitives).
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5: Commit** `feat(wallpaper): add layout, theme, photo and size controls`

---

### Task 21: Paste box and the page

**Files:** Modify `src/views/wallpaper/WallpaperView.vue`; Create `src/views/wallpaper/WallpaperView.test.ts`.

**Interfaces:** Consumes `useWallpaper`, `WallpaperPreview`, `WallpaperControls`. Layout: `AppPage` titled "Wallpaper" with a one-line description; two columns from `lg` up (paste box and controls left, preview right), one column below (paste box, preview, controls). Paste box: a `Textarea` labelled "Your schedule" with help text "In RAMS, open My Class Schedules/Assessments. Select the whole page, copy, and paste it here." and, on phones, "Tip: tap and hold, choose Select all, then Copy."; a "Paste from clipboard" button shown only when `navigator.clipboard?.readText` exists; a "Clear" button. Empty state (no text): "Paste your schedule to see your wallpaper." Text but no schedule: "We could not find a class schedule in that text. Copy the whole page from RAMS and paste it again." Parser warnings listed in a `role="status"` region above the preview. `maxlength` of `MAX_PASTE_LENGTH`.

- [ ] **Step 1: Failing tests** (stub the preview)
  - Pasting `SAMPLE_TERM2` shows no empty state and passes five subjects to the preview; clearing shows the empty state.
  - Pasting `hello` shows the "could not find" message.
  - A paste with a broken row (two days, one time) shows the warning text in the status region while the other rows still render.
  - The "Paste from clipboard" button is absent when `navigator.clipboard` is undefined and, when present, fills the box from `readText`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5: Commit** `feat(wallpaper): add the paste box and wallpaper page`

---

### Task 22: Download and share

**Files:** Modify `src/views/wallpaper/WallpaperView.vue` and its test.

**Behaviour:** A "Download PNG" button (disabled until `hasSchedule`) calls `renderToBlob` with the current options at full `size`, then `saveAs(blob, wallpaperFilename(...))` and toasts `Downloaded. Set it as your lock screen.`. Where `navigator.canShare({ files })` is true (detected once, as in `DpPublicView.vue`), a "Share" button calls `navigator.share({ files })`; an `AbortError` is ignored; other failures toast `Could not share. Try Download instead.`. A failed render toasts `Could not render the image. Try again.`. While exporting, both buttons are disabled.

- [ ] **Step 1: Failing tests** (stub `renderToBlob`, `file-saver`, `useToast`)
  - Download is disabled with no schedule; with one it calls `saveAs` with the blob and `eypi-schedule-2026-2027-term-2.png`.
  - Share is hidden when `canShare` is missing; when present it calls `navigator.share` with a `File` named like the download; an `AbortError` shows no toast.
  - A rejected `renderToBlob` shows the render error toast and re-enables the buttons.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5: Commit** `feat(wallpaper): add download and share for the wallpaper`

---

### Task 23: Docs

**Files:** Modify `CONTEXT.md`, `AGENTS.md` (add the plan beside the spec row).

- [ ] **Step 1:** In `CONTEXT.md` add glossary terms **schedule wallpaper** and **safe zone**, a frontend route row (`Wallpaper | /wallpaper`), the module in the Product table and module map (`shared/schedule/`, `src/lib/wallpaper/`), and a seam row: RAMS text is parsed in the browser only; saved schedules, if added, store the parsed `ParsedSchedule` and not the raw paste.
- [ ] **Step 2:** In `AGENTS.md` add `| Schedule wallpaper, task-by-task | docs/superpowers/plans/2026-10-30-schedule-wallpaper.md |` under the spec row.
- [ ] **Step 3: Commit** `docs(wallpaper): document the wallpaper module in context`

---

### Task 24: Whole-suite check and manual pass

- [ ] **Step 1:** Run `npm run typecheck`, `npm test`, `npm run build` and `npm run release:check`; expect all to pass and the entry budgets unchanged. Fix anything that fails in a separate `fix(wallpaper)` commit.
- [ ] **Step 2:** Run `npm run dev:local`, sign in, open `/wallpaper`, paste the whole RAMS page text (and the three samples), and check all three layouts, four themes, a photo background, a custom size, Download, and the preview at phone width (375 px) and desktop. Record anything off in `docs/superpowers/plans/2026-10-30-schedule-wallpaper.md` under "Manual findings" and fix it with small commits.
- [ ] **Step 3: Commit** `docs(wallpaper): record the wallpaper manual check` (only if findings were added)

**Owner-only:** (a) confirm no existing link uses the slug `wallpaper` (read-only: `SELECT id, user_id FROM links WHERE lower(slug) = 'wallpaper'`); if one does, tell the owner before deploying. (b) Deploy is the owner's step (`docs/RELEASE.md`). (c) One real phone copy of the RAMS page is still wanted as a fixture; if its text order differs, only `parseMeetings` should need changing.

---

## Appendix: fixtures

Each row's first line is `CODE<TAB>SECTION<TAB>UNITS<TAB>` followed by a newline, then the day lines, time lines, room lines and the instructor, one per line. The three header lines (`Subject Code ...`) are not part of the fixtures.

`SAMPLE_TERM3` (2025-2026, Term 3): 6 subjects, 11 meetings
```
ALPHA1	AB101	2.0	
Monday
Monday
1:30PM - 3:30PM
12:50PM - 1:30PM
1001
ASYNC
Doe, Jordan Ray
BRAVO1	XYZ01-T	3.0	
Tuesday
1:30PM - 3:30PM
508-A
Smith, Pat Jr. Lee
CHARLIE1	AB101	3.0	
Tuesday
Friday
7:30AM - 9:30AM
7:30AM - 9:30AM
208
208
Cruz, Sam Dee Park
DELTA1	AB101	3.0	
Tuesday
Friday
3:30PM - 5:30PM
3:30PM - 5:30PM
205
205
Tan, Robin Kay Lim
ECHO1	XY01	3.0	
Monday
Thursday
3:30PM - 5:30PM
3:30PM - 5:30PM
314
314
Lopez, Casey-Lou Bay
FOXTROT1	AB101/AB102	3.0	
Monday
Thursday
9:30AM - 11:30AM
9:30AM - 11:30AM
502
502
Rivera, Morgan Vale
```

`SAMPLE_TERM1` (2026-2027, Term 1): 6 subjects, 11 meetings
```
GOLF1	CD243	3.0	
Tuesday
Friday
9:30AM - 11:30AM
9:30AM - 11:30AM
206
206
Garcia, Drew Eli Kent
HOTEL1	AB101	3.0	
Monday
Thursday
7:30AM - 9:30AM
7:30AM - 9:30AM
Library
Library
Santos, Jamie Lane Ray
INDIA1	AB101/AB102	3.0	
Saturday
7:30AM - 11:30AM
502
Reed, Taylor Jay Moss
JULIET1	AB101	3.0	
Tuesday
Friday
1:30PM - 3:30PM
1:30PM - 3:30PM
318
318
Park, Avery Wed Lee
KILO1	AB101/AB102/EF251	3.0	
Monday
Thursday
9:30AM - 11:30AM
9:30AM - 11:30AM
502
502
Rivera, Morgan Vale
LIMA1	XY01	3.0	
Tuesday
Friday
3:30PM - 5:30PM
3:30PM - 5:30PM
314
314
Lopez, Casey-Lou Bay
```

`SAMPLE_TERM2` (2026-2027, Term 2): 5 subjects, 9 meetings
```
MIKE1	AB101	3.0	
Tuesday
Friday
9:30AM - 11:30AM
9:30AM - 11:30AM
318
318
Lopez, Casey-Lou Bay
NOVEMBER1	AB101	3.0	
Tuesday
Friday
7:30AM - 9:30AM
7:30AM - 9:30AM
208
208
Smith, Pat Jr. Lee
OSCAR1	AB101/AB102	3.0	
Saturday
7:30AM - 11:30AM
502
Reed, Taylor Jay Moss
PAPA1	XY01	3.0	
Tuesday
Friday
3:30PM - 5:30PM
3:30PM - 5:30PM
314
314
Lopez, Casey-Lou Bay
QUEBEC1	AB101	3.0	
Tuesday
Friday
1:30PM - 3:30PM
1:30PM - 3:30PM
203
203
Ng, Ellis Zoe Ora
```

`wholePage(table, term)` returns, in order: the sidebar lines (`FINANCE TRANSACTIONS`, `Online Payment`, `Promissory Note`, `Payment Records`, `SOA`, `REGISTRATION/ENROLLMENT`, `Masterlist of Subject Offering`, `Registration Confirmation`, `Clearance Issues`, `RAM Enrollment Lane`, `Enrollment`, `Load Revision`, `STUDENT RECORDS`, `Current Registration`, `Student Information`, `My Class Schedules/Assessments`, `My Grades`, `My Vaccination`), `Class Schedule`, `Academic Year & Term: <term, for example 2026 -2027, Term 2>`, `Student No: 2000-000000`, `Student Name: DOE, JANE SAMPLE`, the course and scholarship lines, the table header (`Subject Code`, `Section`, `Units`, `Day`, `Time`, `Room`, `Instructor` each on its own line), the table, `Total Units: 15.0`, `You are officially enrolled as of Oct 22 2026 1:34 PM`, `Course Flowchart`, `Assessment`, and `Copyright © 2020 Asia Pacific College. All rights reserved.`
