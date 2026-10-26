-- Tix: one email per event, the pass-field allowlist, and the csv row used for a ticket.

ALTER TABLE attendees ADD COLUMN csv_row_id TEXT;

ALTER TABLE events ADD COLUMN pass_fields TEXT DEFAULT '[]';

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendees_event_lower_email
  ON attendees(event_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_check_ins_attendee_actioned
  ON check_ins(attendee_id, actioned_at);
