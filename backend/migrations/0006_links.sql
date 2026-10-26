ALTER TABLE links ADD COLUMN expires_at DATETIME;
ALTER TABLE links ADD COLUMN disabled_at DATETIME;
ALTER TABLE links ADD COLUMN disabled_reason TEXT;
ALTER TABLE links ADD COLUMN password_hash TEXT;
ALTER TABLE links ADD COLUMN updated_at DATETIME;
ALTER TABLE analytics ADD COLUMN visitor_hash TEXT;
ALTER TABLE analytics ADD COLUMN source TEXT;
CREATE INDEX IF NOT EXISTS idx_links_user_created ON links(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_link_created ON analytics(link_id, created_at);
CREATE TABLE link_reports (
  id TEXT PRIMARY KEY,
  link_id TEXT REFERENCES links(id) ON DELETE CASCADE,
  slug TEXT,
  reason TEXT,
  details TEXT,
  reporter_ip_hash TEXT,
  reporter_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT,
  resolved_by TEXT,
  resolution TEXT
);
