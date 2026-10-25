UPDATE org_members SET user_id = NULL WHERE user_id IN (SELECT id FROM users WHERE COALESCE(is_verified, 0) = 0);

DELETE FROM users WHERE COALESCE(is_verified, 0) = 0;

ALTER TABLE users DROP COLUMN password_hash;
ALTER TABLE users DROP COLUMN verification_token;
ALTER TABLE users DROP COLUMN is_verified;
