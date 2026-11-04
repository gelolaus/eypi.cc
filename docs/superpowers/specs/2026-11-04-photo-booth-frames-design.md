# Photo booth frames design

Date: 2026-11-04. Status: draft for owner review.

## Goal

Let organizations publish **photo booth frames** in the existing Frames module. A visitor opens the frame page on their phone, takes 3 shots with the camera, and downloads a 1080×1920 (9:16) strip they can post to an Instagram or Facebook story. It replaces a physical booth at events, with no event registration needed.

Reference: GDG PUP's booth (photo.gdgpup.org): pick a filter, 3 shots with a countdown, retake, download. We do not copy its filter list and we skip stickers and email.

## What the owner decided

- Booth frames live in the same Frames module and the same place (`/manage/frames`, `/frames/:slug`).
- Frames have transparent windows, like existing profile frames. **Window positions are auto-detected from transparency.**
- A campaign has a `kind`, fixed at creation: `profile` or `booth`. A booth campaign holds up to 10 strip frames and the visitor picks one.
- Version 1 is a lean booth plus filters. Filters are ones people actually look for, not GDG's.
- **No sign-in and nothing stored.** Everyone can use the booth. Photos are composed on the device and never uploaded.

## Current state (read from the code)

- `dp_campaigns` and `dp_frames` (`backend/src/routes/dp.ts`). The server validates only PNG header, alpha, size and squareness. It never decodes pixels.
- The public page merges a visitor photo on a canvas in the browser. Caption fields, download and share beacons already exist.
- `shared/` holds pure helpers used by both sides (for example `captionFields.ts`).
- Local development uses the production Turso database, so migrations need owner approval.

## Design

### 1. Data (additive migrations)

- `dp_campaigns.kind TEXT NOT NULL DEFAULT 'profile'`, values `profile` or `booth`.
- `dp_frames.windows TEXT` (nullable JSON): array of `{x, y, w, h}` in frame pixels. Used only by booth frames.
- Existing rows are unchanged. The migrations are owner-run.

### 2. Shared contract: `shared/boothWindows.ts`

Pure, tested in `shared/boothWindows.test.ts`, used by frontend and backend.

- Type `BoothWindow = { x, y, w, h }`.
- `validateBoothWindows(windows, width, height)` requires exactly 3 rectangles, each inside the image, none overlapping, each at least 5% of the image width and height. It returns an error message or `null`.
- `sortWindows` orders them by `y` (top to bottom, then `x`).
- Booth frame size is exactly 1080×1920.

### 3. Window detection (browser, at upload)

A pure function in `src/lib/` takes RGBA pixels and returns connected regions of near-transparent pixels as bounding boxes.

- Threshold: a pixel counts as transparent when alpha is below a low cutoff, so soft shadows and semi-transparent frame art are not windows.
- Regions smaller than about 1% of the frame area are ignored (stray holes).
- Rounded windows: the bounding box is used. The photo is drawn behind the frame, so opaque frame art clips it.
- The uploader shows numbered outlines (1 to 3, top to bottom) with a sample photo in each, and blocks the upload when the count is not 3: "We found N photo windows. A booth frame needs exactly 3 separate transparent areas."

### 4. Backend (`backend/src/routes/dp.ts`)

- `POST /api/dp` accepts `kind` (create only) and per-frame `windows`. `POST /api/dp/:id/frames` accepts `windows`.
- A booth upload must be exactly 1080×1920 with alpha and valid windows (`validateBoothWindows`); the frame's `kind` must match the campaign. Failures are 422 with plain-language messages. Profile validation is unchanged.
- Max 10 frames per campaign, as today.
- `GET /api/dp/:slug` and the edit payload return `kind` and each frame's `windows`.
- `POST /api/dp/:id/duplicate` copies `kind` and `windows`.
- Insights and stats need no change; views and downloads already count booth campaigns.

### 5. Owner editor

- New-frame screen starts with a choice: **Profile picture** or **Photo booth**. The kind is a badge afterwards and cannot change.
- `DpFrameUploader.vue` gets a booth mode: hint "1080×1920 transparent PNG, with 3 photo windows", detection, outline preview.
- `DpEditCampaignView.vue` reuses the booth uploader to add frames. There is no window editor: to fix a detection, fix the PNG and upload again.
- The Frames list shows the kind badge.

### 6. Visitor booth (`DpPublicView.vue`, `kind = 'booth'`)

1. Pick a frame (skipped when the campaign has one).
2. Camera opens (front by default, flip button). The preview is mirrored. The viewfinder crops to the next window's aspect ratio with the window outline over it.
3. Filter chips under the preview, applied live, changeable before the countdown.
4. **Start**: 3-second countdown, 3 shots with a short pause. "Shot N of 3" label, brief white flash, no shutter sound.
5. **Review**: composed strip shown live. Tapping a window retakes that shot with a 3-second countdown.
6. **Download**: 1080×1920 PNG, existing download beacon, then the existing caption-fields form.

Fallbacks:

- Permission denied or no camera: plain message on allowing the camera, plus **Choose photos instead** (gallery fills the windows with the same crop, filter and retake).
- In-app browsers (Instagram, Facebook) that block the camera: detected, with "Open in your browser" guidance.
- The camera stream stops whenever the screen is left or the strip is finished.

### 7. Rendering rules

- One canvas. Each photo is cover-fit into its window, then the frame PNG is drawn on top.
- The export is **not mirrored** (shirt text reads correctly). The live preview is mirrored.
- Captures are at most 1080 px wide and released after export.
- Filters are pure pixel functions, not CSS or `ctx.filter` (uneven Safari support). The live preview uses the same math at low resolution. Set: Normal, Soft, Bright, Warm, Cool, Film, Matte, B&W, Vivid. Tuned on real selfies by the owner, with numbers easy to adjust.
- Accessibility: the countdown is announced to screen readers, every control has a text label, shots can be taken by button, and motion respects `prefers-reduced-motion`.

### 8. Privacy

Photos live in memory only and are never uploaded. The only beacons are the existing `view` and `download`, and no photo data is in any beacon body.

## Out of scope for version 1

Stickers, email, saving to an account, video or GIF output, a window editor, mixed profile and booth campaigns, event-linked booths.

## Risks

- iOS Safari needs HTTPS and a user gesture for the camera. In-app browsers can block it (handled by the fallbacks).
- Memory on low-end phones (handled by the 1080 px capture limit and releasing captures).
- Migrations run against production Turso and need the owner's approval. I will not run them.
- Filter quality needs the owner's eye on real selfies.

## Testing (tests first)

- `shared/boothWindows.test.ts`: count, bounds, overlap, minimum size, ordering.
- Detection: synthetic canvases with 3, 2 and 4 windows, rounded corners, a stray speck, a semi-transparent shadow.
- Filters: alpha preserved, values clamped to 0–255, deterministic, Normal is the identity.
- Composition: cover-fit crop math for several aspect ratios, mirrored preview and unmirrored export.
- Backend: booth create and add-frame validation (wrong size, no alpha, wrong window count, `kind` mismatch). Profile campaigns behave as before. Duplicate keeps `kind` and `windows`.
- `DpPublicView` booth mode: camera success, permission denied, in-app browser, gallery fallback, single-shot retake, stream stops on leave, caption form after download, no photo data in any beacon body.
- `DpFrameUploader` booth mode: outlines and the block on a wrong window count.
- Camera and canvas are injected behind small interfaces so tests need no hardware.
- Done means `npm run typecheck` and `npm test` pass and the change matches `DESIGN_SYSTEM.md`.

## Owner-only steps

Run the two migrations and deploy.
