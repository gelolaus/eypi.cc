-- Users who signed in with Microsoft during the cutover window have an identity
-- row and is_verified = 0 (the column default). Keep them.
UPDATE org_members SET user_id = NULL WHERE user_id IN (
  SELECT id FROM users u
  WHERE COALESCE(u.is_verified, 0) = 0
    AND NOT EXISTS (SELECT 1 FROM user_identities i WHERE i.user_id = u.id)
);

DELETE FROM users
WHERE COALESCE(is_verified, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM user_identities i WHERE i.user_id = users.id);

ALTER TABLE users DROP COLUMN password_hash;
ALTER TABLE users DROP COLUMN verification_token;
ALTER TABLE users DROP COLUMN is_verified;
