CREATE TABLE rum_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  route TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  rating TEXT NOT NULL,
  device TEXT NOT NULL,
  connection TEXT,
  nav_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_rum_samples_day ON rum_samples(day);

CREATE TABLE rum_daily (
  day TEXT NOT NULL,
  route TEXT NOT NULL,
  metric TEXT NOT NULL,
  device TEXT NOT NULL,
  p75 REAL NOT NULL,
  samples INTEGER NOT NULL,
  PRIMARY KEY (day, route, metric, device)
);

ALTER TABLE organizations ADD COLUMN logo_meta TEXT;
ALTER TABLE organizations ADD COLUMN banner_meta TEXT;
ALTER TABLE dp_frames ADD COLUMN image_meta TEXT;
