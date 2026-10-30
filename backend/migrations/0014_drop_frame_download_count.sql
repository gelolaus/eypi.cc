-- Frames: drop the retired per-campaign download counter.
-- DESTRUCTIVE. Downloads and caption copies are counted from module_events now.
-- The counts stored here (including those from before beacons existed) are lost.
-- Apply only after the backend that no longer reads this column is live, and only
-- with the owner's approval: npm run migrate --prefix backend -- --yes --allow-destructive
-- dp_campaigns is never rebuilt (dp_frames and dp_slug_history cascade from it).

ALTER TABLE dp_campaigns DROP COLUMN download_count;
