-- Tix registration: one attendee pool with a status for every admission mode.
-- Additive only. No table is dropped or rebuilt (users cascades to links).

ALTER TABLE events ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE events ADD COLUMN admission_mode TEXT NOT NULL DEFAULT 'import';
ALTER TABLE events ADD COLUMN visibility TEXT NOT NULL DEFAULT 'unlisted';
ALTER TABLE events ADD COLUMN description TEXT;
ALTER TABLE events ADD COLUMN cover_key TEXT;
ALTER TABLE events ADD COLUMN cover_meta TEXT;
ALTER TABLE events ADD COLUMN end_time TEXT;
ALTER TABLE events ADD COLUMN registration_opens_at DATETIME;
ALTER TABLE events ADD COLUMN registration_closes_at DATETIME;
ALTER TABLE events ADD COLUMN waitlist_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE events ADD COLUMN questions TEXT NOT NULL DEFAULT '[]';
ALTER TABLE events ADD COLUMN lottery_drawn_at DATETIME;

ALTER TABLE attendees ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE attendees ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed';
ALTER TABLE attendees ADD COLUMN source TEXT NOT NULL DEFAULT 'import';
ALTER TABLE attendees ADD COLUMN answers TEXT NOT NULL DEFAULT '{}';
-- SQLite cannot add a column with a CURRENT_TIMESTAMP default, so add it nullable and backfill.
ALTER TABLE attendees ADD COLUMN registered_at DATETIME;
ALTER TABLE attendees ADD COLUMN decided_at DATETIME;
ALTER TABLE attendees ADD COLUMN decided_by TEXT;
ALTER TABLE attendees ADD COLUMN guest_token_hash TEXT;

ALTER TABLE users ADD COLUMN tickets_seen_at DATETIME;

UPDATE attendees SET registered_at = CURRENT_TIMESTAMP WHERE registered_at IS NULL;

-- Removal becomes a status change: cancel attendees whose latest check-in action is 'removed'.
UPDATE attendees SET status = 'cancelled'
WHERE id IN (
  SELECT c.attendee_id FROM check_ins c
  WHERE c.action = 'removed'
    AND NOT EXISTS (
      SELECT 1 FROM check_ins n
      WHERE n.attendee_id = c.attendee_id
        AND (n.actioned_at > c.actioned_at
             OR (n.actioned_at = c.actioned_at AND n.rowid > c.rowid))
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendees_event_user
  ON attendees(event_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendees_guest_token_hash
  ON attendees(guest_token_hash) WHERE guest_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendees_event_status_registered
  ON attendees(event_id, status, registered_at);
CREATE INDEX IF NOT EXISTS idx_check_ins_event_attendee_actioned
  ON check_ins(event_id, attendee_id, actioned_at);
