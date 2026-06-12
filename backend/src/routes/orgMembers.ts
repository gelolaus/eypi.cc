import { Hono } from 'hono'
import { z } from 'zod'
import { db, getUser } from '../lib/db'
import type { Bindings } from '../lib/db'

type Variables = {
  userId: string;
  userEmail: string;
}

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>()

// Ensure requester is logged in
app.use('*', async (c, next) => {
  const user = await getUser(c as any)
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  c.set('userId', user.sub)
  c.set('userEmail', user.email)
  await next()
})

const inviteSchema = z.object({
  org_id: z.string(),
  email: z.string().email(),
})

/**
 * POST /api/orgs/members
 * Handles invitation and silent pre-provisioning of members.
 */
app.post('/', async (c) => {
  const database = db(c.env)
  const requesterId = c.var.userId
  
  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const validation = inviteSchema.safeParse(body)
  if (!validation.success) {
    return c.json({ error: 'Missing or invalid required fields: org_id, email' }, 400)
  }

  const { org_id } = validation.data
  const targetEmail = validation.data.email.toLowerCase().trim()

  // Strict Domain Validation Guard
  const apcEmailRegex = /^[a-zA-Z0-9._%+-]+@(?:student\.)?apc\.edu\.ph$/
  if (!apcEmailRegex.test(targetEmail)) {
    return c.json({ error: 'Invalid domain. Invitations are strictly restricted to @apc.edu.ph or @student.apc.edu.ph domain emails.' }, 400)
  }

  try {
    // 1. Authorization: Verify requester owns the specific org_id
    const { rows: ownerCheck } = await database.execute({
      sql: `
        SELECT 1 
        FROM organizations 
        WHERE id = ? AND owner_id = ? 
        LIMIT 1
      `,
      args: [org_id, requesterId]
    })

    if (ownerCheck.length === 0) {
      return c.json({ error: 'Forbidden. You do not have ownership access to this organization.' }, 403)
    }

    // 2. Silent Pre-Provisioning Injection
    // Utilizes ON CONFLICT DO NOTHING against a UNIQUE(org_id, email) index to gracefully handle duplicate invites
    const result = await database.execute({
      sql: `
        INSERT INTO org_members (org_id, email, user_id, invited_at, activated_at) 
        VALUES (?, ?, NULL, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT(org_id, email) DO NOTHING
      `,
      args: [org_id, targetEmail]
    })
    
    return c.json({ 
      success: true, 
      message: 'Invitation processed. If the user does not possess an account, they have been silently pre-provisioned.',
      changes: result.rowsAffected
    }, 200)

  } catch (error) {
    console.error('Error during silent pre-provisioning:', error)
    return c.json({ error: 'Internal server error while processing the invitation.' }, 500)
  }
})

export default app
