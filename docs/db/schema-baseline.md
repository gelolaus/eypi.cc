# Production schema baseline

Read-only dump of `sqlite_master` from production Turso, captured 2026-10-25. Schema only; no row data.

Use this as the source for the first versioned migration (overhaul plan, WS1). `.gitignore` currently ignores `*.sql`, which is why it is stored as Markdown.

## Facts the plan depends on

- `PRAGMA foreign_keys` is **on** for the libSQL connection.
- `users.password_hash` is `NOT NULL CHECK (length(password_hash) >= 60)`. Microsoft sign-in needs a table rebuild to drop it.
- Trigger `enforce_apc_email_insert` blocks non-APC emails at the database.
- `links.slug` and `events.slug` are UNIQUE; `analytics` cascades on link delete; `links` cascades on user delete.
- `org_members`, `organizations`, `events`, `dp_campaigns`, `attendees`, `check_ins`, `event_*` reference parents **without** cascade.
- `board_*` tables have no code that uses them (leftover from a removed feature).
- `users.deleted_at` does not exist.
- `users.avatar_icon` and `users.avatar_color` (both nullable TEXT) were added by migration `0013_user_avatar.sql` after this baseline was captured. They hold a Lucide icon key and a preset colour key, and the DDL below does not show them. Both are null until the user picks an avatar.

## DDL

```sql

-- table: analytics
CREATE TABLE analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT NOT NULL,
    os TEXT,
    country TEXT,
    referrer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- table: attendees
CREATE TABLE attendees (
  id            TEXT PRIMARY KEY,
  event_id      TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT,
  email         TEXT NOT NULL,
  qr_token      TEXT NOT NULL UNIQUE,
  cluster_value TEXT DEFAULT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

-- table: board_boards
CREATE TABLE board_boards (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- table: board_card_assignees
CREATE TABLE board_card_assignees (
  card_id TEXT NOT NULL,
  assignee_id TEXT NOT NULL,
  PRIMARY KEY (card_id, assignee_id)
);

-- table: board_card_labels
CREATE TABLE board_card_labels (
  card_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  PRIMARY KEY (card_id, label_id)
);

-- table: board_cards
CREATE TABLE board_cards (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  column_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL
, archived INTEGER NOT NULL DEFAULT 0);

-- table: board_checklist_items
CREATE TABLE board_checklist_items (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL
);

-- table: board_columns
CREATE TABLE board_columns (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL
);

-- table: board_comments
CREATE TABLE board_comments (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- table: board_labels
CREATE TABLE board_labels (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  name TEXT NOT NULL,
  tone TEXT NOT NULL
);

-- table: check_ins
CREATE TABLE check_ins (
  id          TEXT PRIMARY KEY,
  attendee_id TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  action      TEXT NOT NULL,  -- 'checked_in' | 'checked_out' | 'removed'
  actioned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attendee_id) REFERENCES attendees(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

-- table: dp_campaigns
CREATE TABLE dp_campaigns (
  id               TEXT PRIMARY KEY,
  creator_id       TEXT NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT,
  frame_image_url  TEXT NOT NULL,
  caption_template TEXT,
  download_count   INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, slug TEXT, org_id TEXT,
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

-- table: dp_frames
CREATE TABLE dp_frames (
  id          TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  image_url   TEXT NOT NULL,
  label       TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES dp_campaigns(id)
);

-- table: event_clusters
CREATE TABLE event_clusters (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL,
  cluster_col TEXT NOT NULL,
  value       TEXT NOT NULL,
  max_count   INTEGER NOT NULL,
  filters     TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (event_id) REFERENCES events(id)
);

-- table: event_column_mappings
CREATE TABLE event_column_mappings (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL UNIQUE,
  first_name_col  TEXT,
  last_name_col   TEXT,
  full_name_col   TEXT,
  email_col       TEXT NOT NULL,
  cluster_col     TEXT,
  criteria_cols   TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (event_id) REFERENCES events(id)
);

-- table: event_csv_rows
CREATE TABLE event_csv_rows (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL,
  row_index   INTEGER NOT NULL,
  raw_data    TEXT NOT NULL,
  is_selected INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

-- table: events
CREATE TABLE events (
  id               TEXT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  lead_user_id     TEXT NOT NULL,
  name             TEXT NOT NULL,
  event_date       TEXT NOT NULL,
  event_time       TEXT NOT NULL,
  location         TEXT NOT NULL,
  max_attendees    INTEGER DEFAULT NULL,
  selection_locked INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, org_id TEXT,
  FOREIGN KEY (lead_user_id) REFERENCES users(id)
);

-- table: links
CREATE TABLE links (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  
  -- Must be a valid web URL starting with http or https
  original_url TEXT NOT NULL CHECK (original_url LIKE 'http://%' OR original_url LIKE 'https://%'),
  
  -- Slug cannot be completely empty
  slug TEXT UNIQUE NOT NULL CHECK (length(slug) > 0),
  
  -- Clicks can never be a negative number
  clicks INTEGER DEFAULT 0 CHECK (clicks >= 0),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, qr_config TEXT,
  
  -- If you delete a user, automatically delete their links
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- table: org_members
CREATE TABLE org_members (
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  user_id TEXT,
  invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  activated_at DATETIME,
  PRIMARY KEY (org_id, email),
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- table: organizations
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, is_public_catalog INTEGER NOT NULL DEFAULT 0, tagline TEXT, about_markdown TEXT, banner_url TEXT, logo_url TEXT, social_links TEXT, org_type TEXT,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- table: users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  
  -- Must have text, an @ symbol, a dot, and text after it
  email TEXT UNIQUE NOT NULL CHECK (email LIKE '%_@_%._%'),
  
  -- Must be a valid hash length (bcrypt/argon2 are usually 60-97 chars)
  password_hash TEXT NOT NULL CHECK (length(password_hash) >= 60),
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, verification_token TEXT, is_verified BOOLEAN DEFAULT 0, name TEXT);

-- index: idx_analytics_link_id
CREATE INDEX idx_analytics_link_id ON analytics(link_id);

-- index: idx_attendees_event
CREATE INDEX idx_attendees_event ON attendees(event_id);

-- index: idx_attendees_qr
CREATE INDEX idx_attendees_qr ON attendees(qr_token);

-- index: idx_board_boards_org_id
CREATE INDEX idx_board_boards_org_id ON board_boards(org_id);

-- index: idx_board_cards_board_id
CREATE INDEX idx_board_cards_board_id ON board_cards(board_id);

-- index: idx_board_cards_column_id
CREATE INDEX idx_board_cards_column_id ON board_cards(column_id);

-- index: idx_board_columns_board_id
CREATE INDEX idx_board_columns_board_id ON board_columns(board_id);

-- index: idx_checkins_attendee
CREATE INDEX idx_checkins_attendee ON check_ins(attendee_id);

-- index: idx_checkins_event
CREATE INDEX idx_checkins_event ON check_ins(event_id);

-- index: idx_dp_creator
CREATE INDEX idx_dp_creator ON dp_campaigns(creator_id);

-- index: idx_dp_slug
CREATE UNIQUE INDEX idx_dp_slug ON dp_campaigns(slug);

-- index: idx_dp_frames_campaign
CREATE INDEX idx_dp_frames_campaign ON dp_frames(campaign_id);

-- index: idx_clusters_event
CREATE INDEX idx_clusters_event ON event_clusters(event_id);

-- index: idx_csv_rows_event
CREATE INDEX idx_csv_rows_event ON event_csv_rows(event_id);

-- index: idx_events_lead
CREATE INDEX idx_events_lead ON events(lead_user_id);

-- index: idx_events_slug
CREATE UNIQUE INDEX idx_events_slug ON events(slug);

-- index: idx_links_slug_unique
CREATE UNIQUE INDEX idx_links_slug_unique ON links(slug);

-- index: idx_organizations_public_catalog
CREATE INDEX idx_organizations_public_catalog
  ON organizations(is_public_catalog) WHERE is_public_catalog = 1;

-- trigger: enforce_apc_email_insert
CREATE TRIGGER enforce_apc_email_insert
BEFORE INSERT ON users
FOR EACH ROW
WHEN (NEW.email NOT LIKE '%@student.apc.edu.ph' AND NEW.email NOT LIKE '%@apc.edu.ph')
BEGIN
    SELECT RAISE(ABORT, 'Database Error: Only APC emails are permitted.');
END;

```
