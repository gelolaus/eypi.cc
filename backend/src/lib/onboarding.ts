import type { Client } from '@libsql/client/web'

/**
 * Maps pending org memberships onto a user after Microsoft sign-in.
 */
export async function handleUserOnboarding(
  user: { id: string; email: string },
  database: Client,
): Promise<void> {
  const normalizedEmail = user.email.toLowerCase().trim()

  try {
    // 1. Check for pending pre-provisioned memberships
    // This read operation is cheap and prevents unnecessary writes
    const { rows } = await database.execute({
      sql: `
        SELECT 1 
        FROM org_members 
        WHERE email = ? AND activated_at IS NULL 
        LIMIT 1
      `,
      args: [normalizedEmail]
    })
    
    if (rows.length === 0) {
      return // No pending invitations. Exit the hook silently.
    }
    
    // 2. Atomic Batch Update: Map the user ID to the pre-provisioned org memberships, but keep them pending (activated_at IS NULL).
    await database.execute({
      sql: `
        UPDATE org_members 
        SET user_id = ? 
        WHERE email = ? AND user_id IS NULL
      `,
      args: [user.id, normalizedEmail]
    })
  } catch {
    // A failed claim must not throw into Microsoft sign-in.
  }
}
