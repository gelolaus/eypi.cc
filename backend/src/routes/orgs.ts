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

// ==========================================
// MY ORGANIZATIONS & MEMBERS
// ==========================================

/**
 * GET /api/orgs
 * Fetch all organizations the user is an active member of or owns.
 */
app.get('/', async (c) => {
  const database = db(c.env)
  const userId = c.var.userId

  try {
    const { rows } = await database.execute({
      sql: `
        SELECT DISTINCT 
          o.id as org_id, 
          o.name as org_name, 
          o.owner_id,
          CASE WHEN o.owner_id = ? THEN 1 ELSE 0 END as is_owner,
          o.created_at
        FROM organizations o
        LEFT JOIN org_members m ON o.id = m.org_id
        WHERE o.owner_id = ? OR (m.user_id = ? AND m.activated_at IS NOT NULL)
      `,
      args: [userId, userId, userId]
    })

    return c.json({ orgs: rows }, 200)
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/orgs
 * Create a new organization. Restricted to arlaus@student.apc.edu.ph.
 */
app.post('/', async (c) => {
  const database = db(c.env)
  const requesterEmail = c.var.userEmail

  // Strict email guard
  if (requesterEmail !== 'arlaus@student.apc.edu.ph') {
    return c.json({ error: 'Forbidden. Admin access required.' }, 403)
  }

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const validation = createOrgSchema.safeParse(body)
  if (!validation.success) {
    return c.json({ error: 'Invalid organization data. Slug must contain only lowercase letters, numbers, and hyphens (min 2, max 50 chars).' }, 400)
  }

  const { id: orgId, name, ownerEmail } = validation.data
  const normalizedOwnerEmail = ownerEmail.toLowerCase().trim()

  try {
    // 1. Look up the owner's user ID by email
    const { rows: userRows } = await database.execute({
      sql: `SELECT id FROM users WHERE email = ? LIMIT 1`,
      args: [normalizedOwnerEmail]
    })

    if (userRows.length === 0) {
      return c.json({ error: `Cannot create organization. The owner email '${normalizedOwnerEmail}' is not registered on eypi.cc.` }, 400)
    }

    const ownerId = userRows[0].id as string

    // 2. Check if the target owner already owns another organization (1 org max)
    const { rows: existingOwnership } = await database.execute({
      sql: `SELECT name FROM organizations WHERE owner_id = ? LIMIT 1`,
      args: [ownerId]
    })

    if (existingOwnership.length > 0) {
      return c.json({ error: `The target owner already owns the organization '${existingOwnership[0].name}'.` }, 400)
    }

    // 3. Check if the organization ID already exists
    const { rows: existingOrg } = await database.execute({
      sql: `SELECT name FROM organizations WHERE id = ? LIMIT 1`,
      args: [orgId]
    })

    if (existingOrg.length > 0) {
      return c.json({ error: `An organization with ID '${orgId}' already exists.` }, 400)
    }

    // 4. Batch transaction: Insert organization and add owner to org_members
    await database.batch([
      {
        sql: `INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)`,
        args: [orgId, name, ownerId]
      },
      {
        sql: `
          INSERT INTO org_members (org_id, email, user_id, invited_at, activated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(org_id, email) DO UPDATE SET user_id = EXCLUDED.user_id, activated_at = EXCLUDED.activated_at
        `,
        args: [orgId, normalizedOwnerEmail, ownerId]
      }
    ])

    return c.json({ success: true, message: `Organization '${name}' successfully registered.` }, 201)

  } catch (error) {
    console.error('Error creating organization:', error)
    return c.json({ error: 'Internal server error while creating the organization.' }, 500)
  }
})

/**
 * GET /api/orgs/:org_id/members
 * Fetch all members of a specific organization. Restricted to the owner.
 */
app.get('/:org_id/members', async (c) => {
  const database = db(c.env)
  const requesterId = c.var.userId
  const orgId = c.req.param('org_id')

  try {
    // 1. Authorization: Verify requester owns the specific org_id
    const { rows: ownerCheck } = await database.execute({
      sql: `
        SELECT 1 
        FROM organizations 
        WHERE id = ? AND owner_id = ? 
        LIMIT 1
      `,
      args: [orgId, requesterId]
    })

    if (ownerCheck.length === 0) {
      return c.json({ error: 'Forbidden. Only the organization owner can view the member list.' }, 403)
    }

    // 2. Fetch all members
    const { rows } = await database.execute({
      sql: `
        SELECT email, user_id, invited_at, activated_at
        FROM org_members
        WHERE org_id = ?
        ORDER BY invited_at DESC
      `,
      args: [orgId]
    })

    return c.json({ members: rows }, 200)
  } catch (error) {
    console.error('Error fetching members:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

const createOrgSchema = z.object({
  id: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(100),
  ownerEmail: z.string().email(),
})

const inviteSchema = z.object({
  email: z.string().email(),
})

const transferSchema = z.object({
  targetEmail: z.string().email(),
})

// ==========================================
// PENDING INVITATIONS
// ==========================================

/**
 * GET /api/orgs/invites
 * Fetch all pending invitations for the logged-in user.
 */
app.get('/invites', async (c) => {
  const database = db(c.env)
  const userEmail = c.var.userEmail
  
  try {
    const { rows } = await database.execute({
      sql: `
        SELECT o.id as org_id, o.name as org_name, m.invited_at 
        FROM org_members m
        JOIN organizations o ON m.org_id = o.id
        WHERE m.email = ? AND m.activated_at IS NULL
      `,
      args: [userEmail]
    })
    
    return c.json({ invites: rows }, 200)
  } catch (error) {
    console.error('Error fetching invites:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/orgs/invites/:org_id/accept
 * Accept a pending invitation.
 */
app.post('/invites/:org_id/accept', async (c) => {
  const database = db(c.env)
  const userEmail = c.var.userEmail
  const userId = c.var.userId
  const orgId = c.req.param('org_id')
  
  try {
    const result = await database.execute({
      sql: `
        UPDATE org_members 
        SET activated_at = CURRENT_TIMESTAMP, user_id = ?
        WHERE email = ? AND org_id = ? AND activated_at IS NULL
      `,
      args: [userId, userEmail, orgId]
    })
    
    if (result.rowsAffected === 0) {
      return c.json({ error: 'Invitation not found or already processed.' }, 404)
    }
    
    return c.json({ success: true, message: 'Invitation accepted.' }, 200)
  } catch (error) {
    console.error('Error accepting invite:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/orgs/invites/:org_id/decline
 * Decline a pending invitation (deletes the row).
 */
app.post('/invites/:org_id/decline', async (c) => {
  const database = db(c.env)
  const userEmail = c.var.userEmail
  const orgId = c.req.param('org_id')
  
  try {
    const result = await database.execute({
      sql: `
        DELETE FROM org_members 
        WHERE email = ? AND org_id = ? AND activated_at IS NULL
      `,
      args: [userEmail, orgId]
    })
    
    if (result.rowsAffected === 0) {
      return c.json({ error: 'Invitation not found or already processed.' }, 404)
    }
    
    return c.json({ success: true, message: 'Invitation declined.' }, 200)
  } catch (error) {
    console.error('Error declining invite:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ==========================================
// ORGANIZATION MANAGEMENT
// ==========================================

/**
 * POST /api/orgs/:org_id/members
 * Handles invitation and silent pre-provisioning of members.
 */
app.post('/:org_id/members', async (c) => {
  const database = db(c.env)
  const requesterId = c.var.userId
  const orgId = c.req.param('org_id')
  
  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const validation = inviteSchema.safeParse(body)
  if (!validation.success) {
    return c.json({ error: 'Missing or invalid required fields: email' }, 400)
  }

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
      args: [orgId, requesterId]
    })

    if (ownerCheck.length === 0) {
      return c.json({ error: 'Forbidden. Only the organization owner can invite new members.' }, 403)
    }

    // 2. Silent Pre-Provisioning Injection
    const result = await database.execute({
      sql: `
        INSERT INTO org_members (org_id, email, user_id, invited_at, activated_at) 
        VALUES (?, ?, NULL, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT(org_id, email) DO NOTHING
      `,
      args: [orgId, targetEmail]
    })
    
    return c.json({ 
      success: true, 
      message: 'Invitation sent. If the user does not possess an account, they have been silently pre-provisioned.',
      changes: result.rowsAffected
    }, 200)

  } catch (error) {
    console.error('Error during invitation:', error)
    return c.json({ error: 'Internal server error while processing the invitation.' }, 500)
  }
})

/**
 * DELETE /api/orgs/:org_id/members
 * Remove a member from the organization. Restricted to the owner.
 */
app.delete('/:org_id/members', async (c) => {
  const database = db(c.env)
  const requesterId = c.var.userId
  const orgId = c.req.param('org_id')

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const validation = inviteSchema.safeParse(body)
  if (!validation.success) {
    return c.json({ error: 'Missing or invalid required fields: email' }, 400)
  }

  const targetEmail = validation.data.email.toLowerCase().trim()

  try {
    // 1. Authorization: Verify requester owns the specific org_id
    const { rows: ownerCheck } = await database.execute({
      sql: `
        SELECT 1 
        FROM organizations 
        WHERE id = ? AND owner_id = ? 
        LIMIT 1
      `,
      args: [orgId, requesterId]
    })

    if (ownerCheck.length === 0) {
      return c.json({ error: 'Forbidden. Only the organization owner can remove members.' }, 403)
    }

    // 2. Prevent the owner from removing themselves
    const { rows: ownerEmailCheck } = await database.execute({
      sql: `SELECT email FROM users WHERE id = ? LIMIT 1`,
      args: [requesterId]
    })

    if (ownerEmailCheck.length > 0 && ownerEmailCheck[0].email === targetEmail) {
      return c.json({ error: 'You cannot remove yourself from the organization. Transfer ownership first.' }, 400)
    }

    // 3. Delete member record
    const result = await database.execute({
      sql: `DELETE FROM org_members WHERE org_id = ? AND email = ?`,
      args: [orgId, targetEmail]
    })

    if (result.rowsAffected === 0) {
      return c.json({ error: 'Member not found in this organization.' }, 404)
    }

    return c.json({ success: true, message: 'Member successfully removed.' }, 200)

  } catch (error) {
    console.error('Error removing member:', error)
    return c.json({ error: 'Internal server error while removing the member.' }, 500)
  }
})

/**
 * POST /api/orgs/:org_id/transfer
 * Transfer ownership of the organization to an existing active member.
 */
app.post('/:org_id/transfer', async (c) => {
  const database = db(c.env)
  const requesterId = c.var.userId
  const orgId = c.req.param('org_id')
  
  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const validation = transferSchema.safeParse(body)
  if (!validation.success) {
    return c.json({ error: 'Missing or invalid required field: targetEmail' }, 400)
  }

  const targetEmail = validation.data.targetEmail.toLowerCase().trim()

  try {
    // 1. Authorization: Verify requester owns the specific org_id
    const { rows: ownerCheck } = await database.execute({
      sql: `
        SELECT 1 
        FROM organizations 
        WHERE id = ? AND owner_id = ? 
        LIMIT 1
      `,
      args: [orgId, requesterId]
    })

    if (ownerCheck.length === 0) {
      return c.json({ error: 'Forbidden. Only the organization owner can transfer ownership.' }, 403)
    }
    
    // 2. Validate Target User is an Active Member
    const { rows: memberCheck } = await database.execute({
      sql: `
        SELECT user_id 
        FROM org_members 
        WHERE org_id = ? AND email = ? AND activated_at IS NOT NULL
        LIMIT 1
      `,
      args: [orgId, targetEmail]
    })
    
    if (memberCheck.length === 0 || !memberCheck[0].user_id) {
      return c.json({ error: 'Cannot transfer ownership. The target user must be an active, registered member of this organization.' }, 400)
    }
    
    const newOwnerId = memberCheck[0].user_id as string
    
    // 3. Prevent transferring to self
    if (newOwnerId === requesterId) {
      return c.json({ error: 'You already own this organization.' }, 400)
    }

    // 4. Check if the target user already owns an organization (Ownership constraint: 1 org max)
    const { rows: existingOwnership } = await database.execute({
      sql: `
        SELECT 1 
        FROM organizations 
        WHERE owner_id = ?
        LIMIT 1
      `,
      args: [newOwnerId]
    })
    
    if (existingOwnership.length > 0) {
      return c.json({ error: 'The target user already owns an organization. Users can only own one organization.' }, 400)
    }

    // 5. Transfer Ownership
    await database.execute({
      sql: `
        UPDATE organizations 
        SET owner_id = ? 
        WHERE id = ?
      `,
      args: [newOwnerId, orgId]
    })
    
    return c.json({ 
      success: true, 
      message: 'Organization ownership has been successfully transferred.'
    }, 200)

  } catch (error) {
    console.error('Error transferring ownership:', error)
    return c.json({ error: 'Internal server error while transferring ownership.' }, 500)
  }
})

export default app
