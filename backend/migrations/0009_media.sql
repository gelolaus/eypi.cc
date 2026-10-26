CREATE TABLE dp_slug_history (
  old_slug TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES dp_campaigns(id) ON DELETE CASCADE
);
