# DP Blast — multi-frame + custom slugs + editing

**Status:** Approved 2026-06-12
**Builds on:** the shipped minimal DP Blast module (migration `0003`, `dp.ts`, `DpCampaignsView`/`DpNewCampaignView`/`DpPublicView`, `useDpCanvas`).

## Goal
Grow DP Blast into a Twibbonize-style generator (no public gallery): a campaign owns
**multiple frames**, lives at a **custom slug**, and is **editable** after creation.
Anyone can open the public link, drop in a headshot, switch between frames, position
it, and download a merged PNG.

## Decisions (locked)
- **Many frames per campaign** — one campaign = one public page + one shareable link
  holding N frames; visitors switch between frames under their photo.
- **Custom, editable slug** — public URL is `eypi.cc/dp/<slug>`; unique, reserved-word
  and format validated (mirrors links/events); blank → auto-derived from title.
- **One caption per campaign** — shared across all frames (unchanged field).

## Unchanged constraints
Base64 data-URL storage in Turso · zero server-side image processing (client Canvas
only) · no new dependencies · strict `DESIGN_SYSTEM.md` tokens.

## Data model — migration `0004_dp_frames_slug.sql` (additive, idempotent)
Applied after `0003`; does not touch existing applied migrations.

- `dp_campaigns` **+ `slug TEXT`** → backfill `slug = id` for existing rows →
  `CREATE UNIQUE INDEX idx_dp_slug`. `frame_image_url` is retained but no longer used.
- **`dp_frames`** (new): `id PK, campaign_id FK, image_url (data:image/png;base64,…),
  label, position INTEGER, created_at`; index on `campaign_id`.
- Migrate each existing `dp_campaigns.frame_image_url` into a `dp_frames` row
  (`position 0`), guarded so re-running is safe.

**Caps:** ≤10 frames/campaign; each frame ≤2 MB PNG (client + server validated).

## Backend API (`backend/src/routes/dp.ts`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/dp` | ✔ | Create `{title, slug, description, captionTemplate, frames:[{imageData,label?}]}` (≥1 frame) |
| GET | `/api/dp` | ✔ | List creator campaigns: `id, title, slug, description, frameCount, downloadCount, createdAt` |
| GET | `/api/dp/:slug` | ✗ public | Public payload: `id, title, slug, description, captionTemplate, frames:[{id,imageUrl,label,position}]` |
| GET | `/api/dp/:id/edit` | ✔ owner | Full campaign incl. frames, for the editor |
| PATCH | `/api/dp/:id` | ✔ owner | Edit `title/description/captionTemplate/slug` (re-validate slug) |
| POST | `/api/dp/:id/frames` | ✔ owner | Add a frame `{imageData,label?}` (enforces ≤10) |
| DELETE | `/api/dp/:id/frames/:frameId` | ✔ owner | Remove a frame (blocks removing the last remaining) |
| PATCH | `/api/dp/:id/frames/order` | ✔ owner | Reorder: `{orderedIds}` (must list every frame once) → rewrites `position` |
| DELETE | `/api/dp/:id` | ✔ owner | Delete campaign + all its frames |
| POST | `/api/dp/:id/download` | ✗ public | `download_count + 1` |

**Slug rules:** `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤60 chars, unique across `dp_campaigns`;
blank → slugify(title) with numeric suffix on collision. Ownership: `creator_id !==
user.sub → 403` (mirrors `events.ts`). The top-level `'dp'` reserved-slug guard in
`links.ts`/`LinksView.vue` stays as-is.

**Routing note:** `GET /api/dp/:slug` (one segment, public) and `GET /api/dp/:id/edit`
(two segments, owner) do not collide; sub-resource paths (`/frames`, `/download`) are
deeper still.

## Frontend
**Routes (`src/router/index.ts`):** rename `/dp/:campaignId` → `/dp/:slug`; add
`/manage/dp-blast/:id/edit` (auth). Static `/manage/dp-blast[/new]` stay declared before
`/manage/:id`.

- **`DpFrameUploader.vue`** (new, shared presentational component): dashed drop-zone +
  thumbnail strip with add / remove / **drag-to-reorder** (HTML5 DnD, grip affordance),
  transparency preview over a checkerboard. Emits `add`/`remove`/`reorder(from,to)`; the
  parent decides whether to mutate in-memory (create) or call the API (edit).
- **`DpNewCampaignView.vue`** (modify): add slug field (`eypi.cc/dp/` prefix, sanitized)
  + `DpFrameUploader`; submit creates the campaign with its frame array in one POST.
- **`DpEditCampaignView.vue`** (new): load via `GET /api/dp/:id/edit`; edit
  title/description/caption/slug (`PATCH`); add/remove/reorder frames via the frame
  endpoints (persisted instantly; reorder is optimistic with revert-on-failure).
- **`DpPublicView.vue`** (modify): fetch by slug; **frame switcher** (◁ ● ● ● ▷) under the
  headshot; selected frame redraws over the photo (canvas fixed at the first frame's
  native resolution); download merged PNG; copy caption. Reuses `useDpCanvas`.
- **`DpCampaignsView.vue`** (modify): show `eypi.cc/dp/<slug>`, frame count, download
  count, copy-link, **Edit** button → edit view, delete.

## Trade-off recorded
Granular frame endpoints (`POST`/`DELETE …/frames`) over "replace the whole frames array
on save" — avoids re-uploading untouched multi-MB base64 and keeps edits cheap.

## Verification
Backend `npx tsc --noEmit`; frontend `npm run build`; preview the public frame-switcher
and edit flows. Live DB + deploy are the owner's (migration `0004` applied on turso.tech;
both Workers deployed by the owner).
