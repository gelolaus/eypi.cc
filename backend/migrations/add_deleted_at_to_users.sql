-- Add deleted_at for soft-delete support (enables re-registration after deletion)
-- Run this against your Turso database if re-registration is needed.
ALTER TABLE users ADD COLUMN deleted_at TEXT; -- ISO8601 datetime, NULL = active
