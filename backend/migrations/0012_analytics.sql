-- Analytics: click enrichment, daily rollups and module events.
-- Additive only. No table is dropped or rebuilt (users cascades to links).

ALTER TABLE analytics ADD COLUMN device TEXT;
ALTER TABLE analytics ADD COLUMN browser TEXT;
ALTER TABLE analytics ADD COLUMN app TEXT;

CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at);

CREATE TABLE IF NOT EXISTS analytics_daily (
  link_id TEXT NOT NULL,
  day TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  uniques INTEGER NOT NULL DEFAULT 0,
  qr INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (link_id, day)
);

CREATE TABLE IF NOT EXISTS analytics_daily_dim (
  link_id TEXT NOT NULL,
  day TEXT NOT NULL,
  dim TEXT NOT NULL,
  value TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (link_id, day, dim, value)
);

CREATE TABLE IF NOT EXISTS module_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id TEXT,
  module TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  action TEXT NOT NULL,
  visitor_hash TEXT,
  day TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_module_events_subject_day ON module_events(subject_id, day);

CREATE TABLE IF NOT EXISTS module_daily (
  subject_id TEXT NOT NULL,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  uniques INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_id, module, action, day)
);

-- Day columns are range-scanned by the rollup readers and the retention purge.
CREATE INDEX IF NOT EXISTS idx_analytics_daily_day ON analytics_daily(day);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_dim_day ON analytics_daily_dim(day);
CREATE INDEX IF NOT EXISTS idx_module_events_day ON module_events(day);
CREATE INDEX IF NOT EXISTS idx_module_daily_day ON module_daily(day);
-- The beacon limiter counts one visitor's recent events.
CREATE INDEX IF NOT EXISTS idx_module_events_visitor ON module_events(visitor_hash, created_at);
