-- Frames: photo booth frames.
-- Additive (two ADD COLUMN statements), safe to apply before the backend that uses them.
-- dp_campaigns.kind is 'profile' (default, existing campaigns) or 'booth'; it is fixed at creation.
-- dp_frames.windows holds the booth photo windows as JSON ([{x,y,w,h}, ...]); null for profile frames.
-- Owner-run: npm run migrate --prefix backend -- --yes (no --allow-destructive needed).

ALTER TABLE dp_campaigns ADD COLUMN kind TEXT NOT NULL DEFAULT 'profile';
ALTER TABLE dp_frames ADD COLUMN windows TEXT;
