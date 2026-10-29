-- User avatar: a Lucide icon key and a preset colour key.
-- Additive only. users is never rebuilt (links cascades from it).

ALTER TABLE users ADD COLUMN avatar_icon TEXT;
ALTER TABLE users ADD COLUMN avatar_color TEXT;
