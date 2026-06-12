import type { Bindings } from './db'
import { db } from './db'

/**
 * Registration Auto-Claim Hook
 * Executes asynchronously upon a user's first login or verification.
 */
export async function handleUserOnboarding(userEmail: string, userId: string, env: Bindings): Promise<void> {
  const normalizedEmail = userEmail.toLowerCase().trim()
  const database = db(env)
  
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
    const result = await database.execute({
      sql: `
        UPDATE org_members 
        SET user_id = ? 
        WHERE email = ? AND user_id IS NULL
      `,
      args: [userId, normalizedEmail]
    })
    
    console.log(`[Auto-Claim] Successfully mapped ${result.rowsAffected} pre-provisioned org memberships for: ${normalizedEmail}`)
    
  } catch (error) {
    // We catch and log to prevent throwing errors into the critical authentication path
    console.error(`[Auto-Claim] Critical failure during auto-claim hook for ${normalizedEmail}:`, error)
  }
}
