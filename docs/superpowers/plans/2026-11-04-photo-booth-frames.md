# Photo booth frames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let orgs publish photo booth frames (1080×1920 strips with 3 transparent windows) in the Frames module, and let anyone take 3 shots with their phone camera and download the composed strip.

**Architecture:** A campaign gets a `kind` (`profile` or `booth`). Booth frames carry 3 window rectangles that the owner's browser auto-detects from transparency at upload; the server validates and stores them with a shared pure validator. The visitor booth is a new `BoothStudio` component, built from small pure libraries (detection, filters, crop and compose, camera), rendered by `DpPublicView` when `kind = 'booth'`. Photos stay in memory and are never uploaded.

**Tech Stack:** Vue 3, Hono on Cloudflare Workers, Turso/libSQL, R2, Vitest, `@vue/test-utils` (happy-dom), `file-saver`.

**Spec:** [2026-11-04-photo-booth-frames-design.md](../specs/2026-11-04-photo-booth-frames-design.md)

## Global Constraints

- Booth frame PNG is exactly **1080×1920** with alpha, and has **exactly 3 windows**. Profile frames keep the existing rule (square, at least 1080 px).
- A window is `{ x, y, w, h }` in frame pixels, inside the image, **at least 5% of the image width and height**, and **no two windows overlap**. Windows are ordered by `y` (top to bottom, then `x`).
- At most **10 frames** per campaign (`MAX_FRAMES`). `kind` is fixed at creation (`profile` default, or `booth`).
- Detection runs in the browser at upload. A region counts as a window when its pixels have alpha below `ALPHA_CUTOFF = 32` and it covers at least 1% of the frame area.
- Countdown is **3 seconds before every shot**, 3 shots, a **1-second pause** after each. Export is **1080×1920 PNG, not mirrored**. The live preview is mirrored.
- Captures are kept at **no more than 1080 px wide** and released after export.
- Filters (ids and labels): `normal` Normal, `soft` Soft, `bright` Bright, `warm` Warm, `cool` Cool, `film` Film, `matte` Matte, `bw` B&W, `vivid` Vivid. Filters are pure pixel functions (no CSS or `ctx.filter`) and always keep alpha.
- No sign-in. No photo or shot is ever uploaded or put in a beacon, request or log. Beacons stay `view`, `download` and `share` (caption copy) as today.
- Migrations are additive (`ADD COLUMN`) and **owner-run**. Never run a migration against production, never deploy.
- Colours come from design tokens only (dark mode and true black must work). Follow `DESIGN_SYSTEM.md`.
- The camera needs HTTPS (or localhost) and a user gesture. Every camera control has a text label. Motion respects `prefers-reduced-motion`.
- Commits: Conventional Commits, `type(scope): lowercase imperative`, `- bullet` body, no trailers, each commit green (`npm run typecheck` and `npm test`).

## Review Focus

- Frame with a transparent outer margin, a soft semi-transparent shadow, or a speck: only regions over the alpha cutoff and area floor count, and the error says how many windows were found (Task 4).
- Very wide or very tall window versus a portrait or landscape camera or gallery photo: cover-crop with no stretching (Task 6).
- Camera permission denied, no camera, or an in-app browser: a clear message and the gallery fallback, never a blank screen (Tasks 7, 10).
- Double-tapping Start, or tapping a retake during a countdown: only one countdown runs at a time (Task 10).
- A hand-made API request with bad `windows`, the wrong `kind`, or a non-1080×1920 booth PNG: rejected with a 422 and nothing stored in R2 (Task 3).

---

### Task 1: Shared booth window contract

**Files:**
- Create: `shared/boothWindows.ts`
- Test: `shared/boothWindows.test.ts`

**Interfaces:**
- Produces:
  - `type BoothWindow = { x: number; y: number; w: number; h: number }`
  - `const BOOTH_WIDTH = 1080`, `BOOTH_HEIGHT = 1920`, `BOOTH_WINDOW_COUNT = 3`, `BOOTH_MIN_WINDOW_FRACTION = 0.05`
  - `validateBoothWindows(windows: unknown, width: number, height: number): string | null` (a plain-language message, or `null` when valid)
  - `sortWindows(windows: BoothWindow[]): BoothWindow[]` (new array, by `y` then `x`)
  - `parseWindows(raw: unknown): BoothWindow[] | null` (reads the stored JSON string or an array; `null` when absent or invalid)

- [x] **Step 1: Write the failing tests** in `shared/boothWindows.test.ts`: `accepts three separate windows`; `rejects 2 and 4 windows with a message that names the count`; `rejects a window outside the image`; `rejects overlapping windows` (and accepts windows that only touch edges); `rejects a window under 5% of the width or height`; `rejects non-integer, negative or non-numeric values`; `sortWindows orders by y then x without mutating the input`; `parseWindows reads a JSON string, passes an array, and returns null for garbage`.
- [x] **Step 2: Run** `npx vitest run shared/boothWindows.test.ts`. Expected: FAIL (module not found).
- [x] **Step 3: Implement** the interface above in `shared/boothWindows.ts`. Pure, no DOM. Messages: wrong count `We found N photo windows. A booth frame needs exactly 3 separate transparent areas.`
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Commit** `feat(frames): add shared photo booth window validation`.

---

### Task 2: Migration for `kind` and `windows`

**Files:**
- Create: `backend/migrations/0015_booth_frames.sql`
- Modify: `docs/db/schema-baseline.md` (append a short "Applied after baseline" note for 0015, matching how earlier migrations are noted there if present)

**Interfaces:**
- Produces: `dp_campaigns.kind TEXT NOT NULL DEFAULT 'profile'`, `dp_frames.windows TEXT` (nullable JSON).

- [x] **Step 1: Write** the two `ALTER TABLE ... ADD COLUMN` statements with a header comment in the style of `0014` (additive, owner-run: `npm run migrate --prefix backend -- --yes`; it needs no `--allow-destructive`).
- [x] **Step 2: Check** how the backend test harness (`backend/src/test/createTestApp.ts`) builds its schema. If it applies `backend/migrations/*.sql`, nothing more is needed; if it keeps its own schema, add the two columns there. Run `npx vitest run backend/src/routes/dp.test.ts`. Expected: PASS (no behavior change yet).
- [x] **Step 3: Commit** `feat(db): add migration for photo booth frame kind and windows`. Do not run the migration against Turso.

---

### Task 3: Backend create, add-frame, read and duplicate

**Files:**
- Modify: `backend/src/routes/dp.ts` (`frameMessage`, `storeFrame`, `POST /api/dp`, `GET /api/dp`, `GET /api/dp/:slug/edit`, `POST /api/dp/:id/frames`, `POST /api/dp/:id/duplicate`, `loadFrames`, `GET /api/dp/:slug`)
- Test: `backend/src/routes/dp.test.ts`

**Interfaces:**
- Consumes: `validateBoothWindows`, `parseWindows`, `BOOTH_WIDTH`, `BOOTH_HEIGHT` from Task 1; `pngSize` already in `dp.ts`.
- Produces (JSON): create body `{ kind?: 'profile' | 'booth', frames: [{ imageData, label?, windows? }] }`; add-frame body `{ imageData, label?, windows? }`; every campaign payload (list, edit, public, duplicate result) carries `kind`; every frame in edit and public payloads carries `windows: BoothWindow[] | null`.

- [x] **Step 1: Write failing tests** in `dp.test.ts` (reuse its `framePng`, `frameDataUrl`, `json` helpers; add `boothDataUrl()` for 1080×1920):
  - `creates a booth campaign with 3 windows and returns kind and windows on the public payload`
  - `rejects a booth frame that is not 1080x1920` (422, message `Use a 1080×1920 PNG.`, nothing written to R2)
  - `rejects a booth frame with 2 windows, with the plain-language count message`
  - `rejects windows on a profile campaign` (400) and `rejects a booth frame with no windows` (422)
  - `rejects an unknown kind` (400)
  - `profile campaigns still require square 1080px PNGs and return kind "profile"`
  - `adds a booth frame to a booth campaign and rejects a profile-shaped frame there`
  - `duplicate copies kind and windows`
  - `list returns kind`
- [x] **Step 2: Run** `npx vitest run backend/src/routes/dp.test.ts`. Expected: new tests FAIL.
- [x] **Step 3: Implement.** `storeFrame(env, campaignId, bytes, label, booth: boolean)`: for booth, call `putImage` without `requireSquare` and `minSize`, and before storing check `pngSize` equals 1080×1920, else `ApiError(422, 'wrong_size', 'Use a 1080×1920 PNG.')`; add `wrong_size` to `frameMessage`. Validate `windows` with `validateBoothWindows` **before** any R2 write so a rejected request stores nothing. Insert `kind` into `dp_campaigns` and `windows` (JSON string, sorted with `sortWindows`) into `dp_frames`. `POST /api/dp/:id/frames` reads the campaign's `kind` to pick the rules. Add `kind` to the SELECTs and payloads; `loadFrames` returns `windows: parseWindows(row.windows)`. Duplicate selects and re-inserts both.
- [x] **Step 4: Run** the same command plus `npm run typecheck`. Expected: PASS.
- [x] **Step 5: Commit** `feat(frames): accept photo booth kind and validated windows in the dp api`.

---

### Task 4: Window detection (browser)

**Files:**
- Create: `src/lib/booth/detectWindows.ts`
- Test: `src/lib/booth/detectWindows.test.ts`

**Interfaces:**
- Consumes: `BoothWindow`, `sortWindows` (Task 1).
- Produces:
  - `const ALPHA_CUTOFF = 32`, `const MIN_REGION_FRACTION = 0.01`
  - `findTransparentRegions(rgba: Uint8ClampedArray, width: number, height: number): BoothWindow[]` (pure; connected 4-neighbour regions of alpha < cutoff, bounding boxes, area floor applied, sorted)
  - `detectWindowsFromDataUrl(dataUrl: string): Promise<{ width: number; height: number; windows: BoothWindow[] }>` (loads the image, reads pixels on a canvas, calls `findTransparentRegions`)

- [x] **Step 1: Write failing tests** with synthetic RGBA buffers (small sizes, e.g. 100×180): `finds 3 separate windows`; `finds 2 windows when two are merged by a transparent bridge`; `finds 4 windows`; `ignores a speck under 1% of the area`; `ignores a soft shadow whose alpha is at or above the cutoff`; `uses the bounding box of a window with rounded corners`; `counts a transparent outer margin as a region` (so the owner is told the real count); `returns windows sorted top to bottom`; `handles a fully opaque image` (empty list) and `a fully transparent image` (one region, no crash).
- [x] **Step 2: Run** `npx vitest run src/lib/booth/detectWindows.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement** with an iterative flood fill (explicit stack or queue, no recursion, so a 1080×1920 image cannot overflow the call stack) over a visited `Uint8Array`.
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Commit** `feat(frames): detect photo booth windows from frame transparency`.

---

### Task 5: Filters

**Files:**
- Create: `src/lib/booth/filters.ts`
- Test: `src/lib/booth/filters.test.ts`

**Interfaces:**
- Produces:
  - `type BoothFilterId = 'normal' | 'soft' | 'bright' | 'warm' | 'cool' | 'film' | 'matte' | 'bw' | 'vivid'`
  - `const BOOTH_FILTERS: readonly { id: BoothFilterId; label: string }[]` (the order and labels in Global Constraints)
  - `applyFilter(id: BoothFilterId, data: Uint8ClampedArray, width: number, height: number): void` (in place)

- [x] **Step 1: Write failing tests**, looped over every id: `keeps alpha unchanged`; `is deterministic (same input, same output)`; `keeps values in 0-255`. Plus `normal leaves pixels identical`, `bw makes r, g and b equal`, `warm raises red relative to blue`, `cool raises blue relative to red`, `bright raises mean luminance`, `matte raises the darkest value (lifted blacks)`, `vivid raises saturation of a muted pixel`, `film grain is the same for the same pixel index across runs`, `BOOTH_FILTERS lists the nine ids in order`.
- [x] **Step 2: Run** `npx vitest run src/lib/booth/filters.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement.** One small function per filter operating on the buffer. `soft` is a light brightness lift plus contrast reduction (no blur, to stay cheap). `film` adds hash-based grain from the pixel index (no `Math.random`). Keep the strengths as named constants at the top so the owner can tune them on real selfies.
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Commit** `feat(frames): add photo booth filters`.

---

### Task 6: Crop and compose

**Files:**
- Create: `src/lib/booth/compose.ts`
- Test: `src/lib/booth/compose.test.ts`

**Interfaces:**
- Consumes: `BoothWindow` (Task 1), `BoothFilterId`, `applyFilter` (Task 5).
- Produces:
  - `coverCrop(srcW: number, srcH: number, destW: number, destH: number): { sx: number; sy: number; sw: number; sh: number }` (centered crop with the destination's aspect ratio)
  - `composeStrip(ctx: CanvasRenderingContext2D, input: { frame: CanvasImageSource; windows: BoothWindow[]; shots: (CanvasImageSource | null)[]; shotSize: (shot: CanvasImageSource) => { width: number; height: number }; filter: BoothFilterId; makeScratch: (w: number, h: number) => CanvasRenderingContext2D }): void` (clears, draws each non-null shot cover-cropped and filtered into its window, then draws the frame over everything at 1080×1920; never mirrors)

- [x] **Step 1: Write failing tests**: `coverCrop for a square source into a tall window crops the sides equally`; `... a wide source into a wide window crops nothing`; `... a very wide window from a portrait source crops top and bottom`; `crop never exceeds the source and keeps the destination aspect ratio` (several cases, within 1px); and with a recording stub context: `draws shots first and the frame last`, `skips a null shot`, `draws into each window rectangle`, `does not flip the canvas (no negative scale)`.
- [x] **Step 2: Run** `npx vitest run src/lib/booth/compose.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement.** Draw each shot into the scratch context at window size with `coverCrop`, `getImageData`, `applyFilter`, `putImageData`, then `drawImage` the scratch into the window on the main context. The caller passes `makeScratch` so tests need no real canvas.
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Commit** `feat(frames): add photo booth crop and strip composition`.

---

### Task 7: Camera helper

**Files:**
- Create: `src/lib/booth/camera.ts`
- Test: `src/lib/booth/camera.test.ts`

**Interfaces:**
- Produces:
  - `type CameraFailure = 'denied' | 'none' | 'insecure' | 'unsupported' | 'other'`
  - `isInAppBrowser(userAgent: string): boolean` (Instagram, Facebook/FBAN/FBAV, Messenger, TikTok, Line, Snapchat)
  - `classifyCameraError(err: unknown): CameraFailure`
  - `openCamera(facing: 'user' | 'environment', deps?: { mediaDevices?: Pick<MediaDevices, 'getUserMedia'> }): Promise<MediaStream>`
  - `stopStream(stream: MediaStream | null): void`

- [x] **Step 1: Write failing tests**: `detects Instagram, Facebook and TikTok user agents and not Safari or Chrome`; `maps NotAllowedError to denied, NotFoundError and OverconstrainedError to none, SecurityError to insecure, a missing mediaDevices to unsupported`; `openCamera requests video with the facing mode and ideal 1080 width, no audio`; `stopStream stops every track and accepts null`.
- [x] **Step 2: Run** `npx vitest run src/lib/booth/camera.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement** as above. `openCamera` throws the original error so callers can `classifyCameraError` it.
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Commit** `feat(frames): add photo booth camera helpers`.

---

### Task 8: Owner editor (new, edit, list, uploader)

**Files:**
- Modify: `src/types/dp.ts` (`DpKind = 'profile' | 'booth'`; `kind` on `DpCampaignSummary`; `windows: BoothWindow[] | null` on `DpFrame`; `windows?: BoothWindow[]` on `DpUploaderFrame`)
- Modify: `src/components/dp/DpFrameUploader.vue` (new prop `mode?: DpKind`; `add` event becomes `(dataUrl: string, file?: File, windows?: BoothWindow[])`)
- Modify: `src/views/dp/DpNewCampaignView.vue`, `src/views/dp/DpEditCampaignView.vue`, `src/views/dp/DpCampaignsView.vue`
- Test: `src/components/dp/DpFrameUploader.test.ts`, `src/views/dp/DpNewCampaignView.test.ts`, `src/views/dp/DpEditCampaignView.test.ts`, `src/views/dp/DpCampaignsView.test.ts`

**Interfaces:**
- Consumes: `detectWindowsFromDataUrl` (Task 4), `BOOTH_WIDTH`, `BOOTH_HEIGHT`, `BOOTH_WINDOW_COUNT` (Task 1), the API shapes from Task 3.
- Produces: the owner can create a booth campaign and add booth frames; list shows a kind badge.

- [x] **Step 1: Write failing tests** (mock `detectWindowsFromDataUrl`):
  - Uploader booth mode: `shows the 1080x1920 hint`, `emits add with the detected windows when exactly 3 are found`, `blocks the upload and shows "We found 2 photo windows..." for 2`, `blocks a PNG that is not 1080x1920 with "Use a 1080×1920 PNG."`, `draws three numbered outlines over each thumbnail`, `profile mode is unchanged`.
  - New view: `asks Profile picture or Photo booth first`, `sends kind and per-frame windows on submit`, `locks the kind once a frame is added`.
  - Edit view: `shows the kind badge`, `uses booth mode for a booth campaign and posts windows with the frame`.
  - List: `shows a "Photo booth" badge only for booth campaigns`.
- [x] **Step 2: Run** `npx vitest run src/components/dp src/views/dp`. Expected: new tests FAIL.
- [x] **Step 3: Implement.** In the uploader, booth mode runs detection after the size and type checks and before `emit('add')`. Booth thumbnails use a 9:16 aspect box with percentage-positioned outline `div`s (numbers 1 to 3) over a placeholder tint; use design tokens only. The kind choice is a two-option radio group built from the existing UI primitives. The existing `emitAdd` handler-forwarding in the uploader must pass the third argument through.
- [x] **Step 4: Run** the same command plus `npm run typecheck`. Expected: PASS.
- [x] **Step 5: Commit** `feat(frames): let orgs create and edit photo booth campaigns`.

---

### Task 9: Booth session state (pure core)

**Files:**
- Create: `src/lib/booth/session.ts`
- Test: `src/lib/booth/session.test.ts`

**Interfaces:**
- Produces: a small framework-free state machine so the UI component stays thin and the timing is testable with fake timers.
  - `const COUNTDOWN_SECONDS = 3`, `SHOT_PAUSE_MS = 1000`, `SHOT_COUNT = 3`
  - `createBoothSession(deps: { capture: () => Promise<ImageBitmap | HTMLCanvasElement | null>; onChange: (state: BoothState) => void }): BoothSession`
  - `type BoothState = { phase: 'idle' | 'counting' | 'flash' | 'review'; shots: (CanvasImageSource | null)[]; currentIndex: number; secondsLeft: number }`
  - `BoothSession`: `startAll(): void`, `retake(index: number): void`, `setShot(index: number, source: CanvasImageSource): void` (gallery fallback), `reset(): void`, `dispose(): void`

- [x] **Step 1: Write failing tests** with fake timers: `startAll runs 3 shots, each after a 3-2-1 countdown, then reaches review`; `a second startAll while counting is ignored`; `retake during a countdown is ignored`; `retake replaces only that shot and returns to review`; `a capture that returns null leaves the slot empty and does not advance past it silently` (the session stays in review with that slot empty so the UI can show it); `dispose cancels pending timers and later ticks do nothing`; `setShot fills a slot without a countdown`; `shots are kept when the owner switches frames` (state is independent of the frame).
- [x] **Step 2: Run** `npx vitest run src/lib/booth/session.test.ts`. Expected: FAIL.
- [x] **Step 3: Implement** with `setTimeout` chains guarded by a generation token so `reset` and `dispose` invalidate pending steps.
- [x] **Step 4: Run** the same command. Expected: PASS.
- [x] **Step 5: Commit** `feat(frames): add photo booth session timing`.

---

### Task 10: Visitor `BoothStudio` and public page

**Files:**
- Create: `src/components/dp/booth/BoothStudio.vue`
- Modify: `src/views/dp/DpPublicView.vue` (Campaign `kind` and frame `windows`; booth branch; Download and Share use the studio's PNG)
- Test: `src/components/dp/booth/BoothStudio.test.ts`, `src/views/dp/DpPublicView.test.ts`

**Interfaces:**
- Consumes: Tasks 5 to 7 and 9; `DpFrame.windows` (Task 8).
- Produces: `BoothStudio` props `{ frame: HTMLImageElement; windows: BoothWindow[] }`; emits `update:ready: boolean`; exposes `renderPng(): Promise<Blob | null>` (1080×1920, unmirrored, filter applied, null when fewer than 3 shots).

- [x] **Step 1: Write failing tests** (inject a fake `openCamera`, fake timers, stub canvas):
  - Studio: `shows the live preview and window outline once the camera opens`, `Start runs the countdown and fills 3 windows`, `tapping a window retakes only that shot`, `Start is ignored while a countdown runs`, `filter chips change the filter and the label of the active one is announced`, `denied permission shows the allow-camera message and the Choose photos button`, `an in-app browser shows Open in your browser guidance`, `Choose photos instead fills windows from picked files`, `leaving the page stops every camera track`, `flip button switches facing`, `the countdown is announced in an aria-live region`, `renderPng returns null before 3 shots and a PNG blob after`.
  - Public view: `a booth campaign shows the studio and no profile upload controls`, `Download is disabled until the strip is ready`, `after Download the caption form opens when a required field is empty`, `switching frames keeps the shots`, `no beacon body ever contains photo data`, `a profile campaign renders exactly as before`.
- [x] **Step 2: Run** `npx vitest run src/components/dp/booth src/views/dp/DpPublicView.test.ts`. Expected: new tests FAIL.
- [x] **Step 3: Implement.** `BoothStudio` wires `createBoothSession` to a `<video>` (mirrored with CSS only) and captures into a canvas at most 1080 px wide, unmirrored. Preview is a viewfinder with the next window's aspect ratio and the window outline over it. Strip review shows `composeStrip` output on a canvas. In `DpPublicView`, wrap the profile-only preview, hint and controls in `v-if="campaign.kind !== 'booth'"`, render `BoothStudio` in the `v-else`, make `renderPng` call the studio's, and keep the frame switcher, Download, Share, caption card and beacons as they are. Treat a missing `kind` (older cached payload) as `profile`.
- [x] **Step 4: Run** the same command plus `npm run typecheck` and `npm run lint`. Expected: PASS.
- [x] **Step 5: Commit** `feat(frames): add the photo booth to public frame pages`.

---

### Task 11: Docs and full verification

**Files:**
- Modify: `CONTEXT.md` (glossary: **booth frame**, **photo window**, `kind`; Frames module note), `AGENTS.md` (add the spec and plan rows), `docs/superpowers/plans/2026-11-04-photo-booth-frames.md` (tick every checkbox)

- [x] **Step 1: Update** the docs above in the existing voice and table style.
- [x] **Step 2: Run** `npm run typecheck`, `npm run lint` and `npm test`. Expected: all pass.
- [ ] **Step 3: Verify in the browser** with `npm run dev:local`: create a booth campaign with a real 1080×1920 transparent PNG, check the detection outlines, open the public page, take 3 shots (desktop webcam on localhost), retake one, change filters, download, and check the exported PNG is 1080×1920 and not mirrored. Report anything that could not be checked (a real phone over HTTPS and an in-app browser are owner-side checks).
  Not run by the agent: local dev uses the production Turso database and migration 0015 is not applied there, so the owner verifies this after migrating.
- [x] **Step 4: Commit** `docs(frames): record the photo booth frames feature`.

## Owner-only steps

1. Review and approve running migration `0015_booth_frames.sql`, then run it: `npm run migrate --prefix backend -- --yes`. Apply it **before** deploying the backend that reads `kind` and `windows`.
2. Deploy.
3. Try the booth on a real iPhone and Android phone over HTTPS, and from an Instagram in-app link.
4. Tune the filter strengths (constants at the top of `src/lib/booth/filters.ts`) on real selfies.
