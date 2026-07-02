import { Hono } from 'hono'
import { z } from 'zod'
import { db, getUser } from '../lib/db'
import type { Bindings } from '../lib/db'
import type { Client } from '@libsql/client/web'

type Variables = {
  userId: string
  userEmail: string
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const TAGLINE_MAX = 160
const ABOUT_MAX = 8000
const URL_MAX = 2048
const IMAGE_DATA_URL_MAX = 2_800_000
const SUPER_ADMIN_EMAIL = 'arlaus@student.apc.edu.ph'

function isSuperAdmin(email: string): boolean {
  return email === SUPER_ADMIN_EMAIL
}

function validateImageUrl(value: string): boolean {
  if (!value) return true
  if (value.length <= URL_MAX && /^https?:\/\//i.test(value)) return true
  const prefix = value.slice(0, 40).toLowerCase()
  const okPrefix =
    prefix.startsWith('data:image/jpeg;base64,')
    || prefix.startsWith('data:image/png;base64,')
    || prefix.startsWith('data:image/webp;base64,')
  return okPrefix && value.length <= IMAGE_DATA_URL_MAX
}

const imageUrlField = z.literal('').or(z.string().refine(validateImageUrl, 'Invalid image URL or data URL.'))

const emptyUrl = z.literal('').or(z.string().url().max(URL_MAX))

const socialLinksSchema = z.object({
  website: emptyUrl.optional(),
  facebook: emptyUrl.optional(),
  instagram: emptyUrl.optional(),
  twitter: emptyUrl.optional(),
  linkedin: emptyUrl.optional(),
  github: emptyUrl.optional(),
})

const profilePatchSchema = z.object({
  isPublicCatalog: z.boolean().optional(),
  tagline: z.string().max(TAGLINE_MAX).nullable().optional(),
  aboutMarkdown: z.string().max(ABOUT_MAX).nullable().optional(),
  bannerUrl: imageUrlField.nullable().optional(),
  logoUrl: imageUrlField.nullable().optional(),
  socialLinks: socialLinksSchema.optional(),
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

const adminOrgPatchSchema = z.object({
  id: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(2).max(100).optional(),
  ownerEmail: z.string().email().optional(),
  isPublicCatalog: z.boolean().optional(),
})

const DEFAULT_SOCIAL_LINKS = {
  website: '',
  facebook: '',
  instagram: '',
  twitter: '',
  linkedin: '',
  github: '',
}

function parseSocialLinks(raw: unknown): Record<string, string> {
  if (typeof raw !== 'string' || !raw.trim()) return { ...DEFAULT_SOCIAL_LINKS }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      website: typeof parsed.website === 'string' ? parsed.website : '',
      facebook: typeof parsed.facebook === 'string' ? parsed.facebook : '',
      instagram: typeof parsed.instagram === 'string' ? parsed.instagram : '',
      twitter: typeof parsed.twitter === 'string' ? parsed.twitter : '',
      linkedin: typeof parsed.linkedin === 'string' ? parsed.linkedin : '',
      github: typeof parsed.github === 'string' ? parsed.github : '',
    }
  } catch {
    return { ...DEFAULT_SOCIAL_LINKS }
  }
}

function mapPublicEvent(row: Record<string, unknown>) {
  return {
    slug: row.slug as string,
    name: row.name as string,
    eventDate: row.event_date as string,
    eventTime: row.event_time as string,
    location: row.location as string,
  }
}

function mapOrgProfileRow(row: Record<string, unknown>) {
  return {
    slug: row.id as string,
    name: row.name as string,
    tagline: (row.tagline as string | null) ?? null,
    aboutMarkdown: (row.about_markdown as string | null) ?? null,
    bannerUrl: (row.banner_url as string | null) ?? null,
    logoUrl: (row.logo_url as string | null) ?? null,
    socialLinks: parseSocialLinks(row.social_links),
    isPublicCatalog: Number(row.is_public_catalog ?? 0) === 1,
  }
}

async function requireOrgCoordinator(
  client: Client,
  orgId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; status: 403 | 404; message: string }> {
  const orgRes = await client.execute({
    sql: 'SELECT id, owner_id FROM organizations WHERE id = ? LIMIT 1',
    args: [orgId],
  })
  if (orgRes.rows.length === 0) {
    return { ok: false, status: 404, message: 'Organization not found.' }
  }
  const org = orgRes.rows[0]
  if (org.owner_id === userId) return { ok: true }

  const memberRes = await client.execute({
    sql: `
      SELECT 1 FROM org_members
      WHERE org_id = ? AND user_id = ? AND activated_at IS NOT NULL
      LIMIT 1
    `,
    args: [orgId, userId],
  })
  if (memberRes.rows.length === 0) {
    return { ok: false, status: 403, message: 'Forbidden. Coordinator access required.' }
  }
  return { ok: true }
}

// ==========================================
// PUBLIC CATALOG (no auth)
// ==========================================

/**
 * GET /api/orgs/public
 * List organizations opted into the public catalog.
 */
app.get('/public', async (c) => {
  const database = db(c.env)
  try {
    const { rows } = await database.execute({
      sql: `
        SELECT id, name, tagline, logo_url
        FROM organizations
        WHERE is_public_catalog = 1
        ORDER BY name ASC
      `,
      args: [],
    })
    return c.json({
      orgs: rows.map((row) => ({
        slug: row.id as string,
        name: row.name as string,
        tagline: (row.tagline as string | null) ?? null,
        logoUrl: (row.logo_url as string | null) ?? null,
      })),
    })
  } catch (error) {
    console.error('Error fetching public org catalog:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/orgs/public/:slug
 * Public organization profile with upcoming/past events.
 */
app.get('/public/:slug', async (c) => {
  const database = db(c.env)
  const slug = c.req.param('slug')

  try {
    const orgRes = await database.execute({
      sql: `
        SELECT id, name, tagline, about_markdown, banner_url, logo_url, social_links, is_public_catalog
        FROM organizations
        WHERE id = ? AND is_public_catalog = 1
        LIMIT 1
      `,
      args: [slug],
    })
    if (orgRes.rows.length === 0) {
      return c.json({ error: 'Organization not found.' }, 404)
    }

    const orgRow = orgRes.rows[0]
    const orgId = orgRow.id as string

    const [upcomingRes, pastRes] = await Promise.all([
      database.execute({
        sql: `
          SELECT slug, name, event_date, event_time, location
          FROM events
          WHERE org_id = ? AND event_date >= date('now')
          ORDER BY event_date ASC, event_time ASC
        `,
        args: [orgId],
      }),
      database.execute({
        sql: `
          SELECT slug, name, event_date, event_time, location
          FROM events
          WHERE org_id = ? AND event_date < date('now')
          ORDER BY event_date DESC, event_time DESC
        `,
        args: [orgId],
      }),
    ])

    const { isPublicCatalog: _omit, ...org } = mapOrgProfileRow(orgRow)

    return c.json({
      org,
      events: {
        upcoming: upcomingRes.rows.map(mapPublicEvent),
        past: pastRes.rows.map(mapPublicEvent),
      },
    })
  } catch (error) {
    console.error('Error fetching public org profile:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Ensure requester is logged in for all routes below
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
          o.logo_url as logo_url,
          o.owner_id,
          o.is_public_catalog,
          CASE WHEN o.owner_id = ? THEN 1 ELSE 0 END as is_owner,
          o.created_at
        FROM organizations o
        LEFT JOIN org_members m ON o.id = m.org_id
        WHERE o.owner_id = ? OR (m.user_id = ? AND m.activated_at IS NOT NULL)
      `,
      args: [userId, userId, userId],
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

  if (!isSuperAdmin(requesterEmail)) {
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
    const { rows: userRows } = await database.execute({
      sql: `SELECT id FROM users WHERE email = ? LIMIT 1`,
      args: [normalizedOwnerEmail],
    })

    if (userRows.length === 0) {
      return c.json({ error: `Cannot create organization. The owner email '${normalizedOwnerEmail}' is not registered on eypi.cc.` }, 400)
    }

    const ownerId = userRows[0].id as string

    const { rows: existingOwnership } = await database.execute({
      sql: `SELECT name FROM organizations WHERE owner_id = ? LIMIT 1`,
      args: [ownerId],
    })

    if (existingOwnership.length > 0) {
      return c.json({ error: `The target owner already owns the organization '${existingOwnership[0].name}'.` }, 400)
    }

    const { rows: existingOrg } = await database.execute({
      sql: `SELECT name FROM organizations WHERE id = ? LIMIT 1`,
      args: [orgId],
    })

    if (existingOrg.length > 0) {
      return c.json({ error: `An organization with ID '${orgId}' already exists.` }, 400)
    }

    await database.batch([
      {
        sql: `INSERT INTO organizations (id, name, owner_id) VALUES (?, ?, ?)`,
        args: [orgId, name, ownerId],
      },
      {
        sql: `
          INSERT INTO org_members (org_id, email, user_id, invited_at, activated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(org_id, email) DO UPDATE SET user_id = EXCLUDED.user_id, activated_at = EXCLUDED.activated_at
        `,
        args: [orgId, normalizedOwnerEmail, ownerId],
      },
    ])

    return c.json({ success: true, message: `Organization '${name}' successfully registered.` }, 201)
  } catch (error) {
    console.error('Error creating organization:', error)
    return c.json({ error: 'Internal server error while creating the organization.' }, 500)
  }
})

// ==========================================
// PENDING INVITATIONS
// ==========================================

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
      args: [userEmail],
    })

    return c.json({ invites: rows }, 200)
  } catch (error) {
    console.error('Error fetching invites:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

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
      args: [userId, userEmail, orgId],
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
      args: [userEmail, orgId],
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
// SUPER ADMIN — ORG MANAGEMENT
// ==========================================

function requireSuperAdmin(email: string): { ok: true } | { ok: false } {
  if (!isSuperAdmin(email)) return { ok: false }
  return { ok: true }
}

/**
 * GET /api/orgs/admin
 * List all organizations (super admin).
 */
app.get('/admin', async (c) => {
  if (!requireSuperAdmin(c.var.userEmail).ok) {
    return c.json({ error: 'Forbidden. Admin access required.' }, 403)
  }

  const database = db(c.env)
  try {
    const { rows } = await database.execute({
      sql: `
        SELECT o.id as org_id, o.name as org_name, o.is_public_catalog, o.created_at, u.email as owner_email
        FROM organizations o
        JOIN users u ON o.owner_id = u.id
        ORDER BY o.name ASC
      `,
      args: [],
    })
    return c.json({ orgs: rows })
  } catch (error) {
    console.error('Error fetching admin org list:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/orgs/admin/:org_id
 */
app.get('/admin/:org_id', async (c) => {
  if (!requireSuperAdmin(c.var.userEmail).ok) {
    return c.json({ error: 'Forbidden. Admin access required.' }, 403)
  }

  const database = db(c.env)
  const orgId = c.req.param('org_id')

  try {
    const { rows } = await database.execute({
      sql: `
        SELECT o.id as org_id, o.name as org_name, o.is_public_catalog, o.created_at, u.email as owner_email
        FROM organizations o
        JOIN users u ON o.owner_id = u.id
        WHERE o.id = ?
        LIMIT 1
      `,
      args: [orgId],
    })
    if (rows.length === 0) return c.json({ error: 'Organization not found.' }, 404)
    return c.json({ org: rows[0] })
  } catch (error) {
    console.error('Error fetching admin org:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * PATCH /api/orgs/admin/:org_id
 */
app.patch('/admin/:org_id', async (c) => {
  if (!requireSuperAdmin(c.var.userEmail).ok) {
    return c.json({ error: 'Forbidden. Admin access required.' }, 403)
  }

  const database = db(c.env)
  const orgId = c.req.param('org_id')

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const validation = adminOrgPatchSchema.safeParse(body)
  if (!validation.success) {
    return c.json({ error: 'Invalid organization data.' }, 400)
  }

  const data = validation.data

  try {
    const existing = await database.execute({
      sql: 'SELECT id, owner_id FROM organizations WHERE id = ? LIMIT 1',
      args: [orgId],
    })
    if (existing.rows.length === 0) {
      return c.json({ error: 'Organization not found.' }, 404)
    }

    let newOrgId = orgId
    let newOwnerId = existing.rows[0].owner_id as string

    if (data.ownerEmail) {
      const normalized = data.ownerEmail.toLowerCase().trim()
      const userRes = await database.execute({
        sql: 'SELECT id FROM users WHERE email = ? LIMIT 1',
        args: [normalized],
      })
      if (userRes.rows.length === 0) {
        return c.json({ error: `Owner email '${normalized}' is not registered.` }, 400)
      }
      newOwnerId = userRes.rows[0].id as string

      const owned = await database.execute({
        sql: 'SELECT id FROM organizations WHERE owner_id = ? AND id != ? LIMIT 1',
        args: [newOwnerId, orgId],
      })
      if (owned.rows.length > 0) {
        return c.json({ error: 'Target owner already owns another organization.' }, 400)
      }
    }

    if (data.id && data.id !== orgId) {
      const taken = await database.execute({
        sql: 'SELECT 1 FROM organizations WHERE id = ? LIMIT 1',
        args: [data.id],
      })
      if (taken.rows.length > 0) {
        return c.json({ error: 'That org slug is already taken.' }, 409)
      }
      newOrgId = data.id
    }

    const statements: { sql: string; args: unknown[] }[] = []

    if (newOrgId !== orgId) {
      statements.push(
        { sql: 'UPDATE events SET org_id = ? WHERE org_id = ?', args: [newOrgId, orgId] },
        { sql: 'UPDATE dp_campaigns SET org_id = ? WHERE org_id = ?', args: [newOrgId, orgId] },
        { sql: 'UPDATE org_members SET org_id = ? WHERE org_id = ?', args: [newOrgId, orgId] },
      )
    }

    const updates: string[] = []
    const updateArgs: unknown[] = []

    if (newOrgId !== orgId) {
      updates.push('id = ?')
      updateArgs.push(newOrgId)
    }
    if (data.name !== undefined) {
      updates.push('name = ?')
      updateArgs.push(data.name.trim())
    }
    if (data.ownerEmail !== undefined) {
      updates.push('owner_id = ?')
      updateArgs.push(newOwnerId)
    }
    if (data.isPublicCatalog !== undefined) {
      updates.push('is_public_catalog = ?')
      updateArgs.push(data.isPublicCatalog ? 1 : 0)
    }

    if (updates.length > 0) {
      updateArgs.push(orgId)
      statements.push({
        sql: `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`,
        args: updateArgs,
      })
    }

    if (data.ownerEmail && newOwnerId) {
      const ownerEmail = data.ownerEmail.toLowerCase().trim()
      statements.push({
        sql: `
          INSERT INTO org_members (org_id, email, user_id, invited_at, activated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT(org_id, email) DO UPDATE SET user_id = EXCLUDED.user_id, activated_at = EXCLUDED.activated_at
        `,
        args: [newOrgId, ownerEmail, newOwnerId],
      })
    }

    if (statements.length > 0) {
      await database.batch(statements)
    }

    const { rows } = await database.execute({
      sql: `
        SELECT o.id as org_id, o.name as org_name, o.is_public_catalog, o.created_at, u.email as owner_email
        FROM organizations o
        JOIN users u ON o.owner_id = u.id
        WHERE o.id = ?
        LIMIT 1
      `,
      args: [newOrgId],
    })

    return c.json({ success: true, org: rows[0] })
  } catch (error) {
    console.error('Error updating admin org:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * DELETE /api/orgs/admin/:org_id
 */
app.delete('/admin/:org_id', async (c) => {
  if (!requireSuperAdmin(c.var.userEmail).ok) {
    return c.json({ error: 'Forbidden. Admin access required.' }, 403)
  }

  const database = db(c.env)
  const orgId = c.req.param('org_id')

  try {
    const childEvents = await database.execute({
      sql: 'SELECT COUNT(*) as c FROM events WHERE org_id = ?',
      args: [orgId],
    })
    const childDp = await database.execute({
      sql: 'SELECT COUNT(*) as c FROM dp_campaigns WHERE org_id = ?',
      args: [orgId],
    })
    if (Number(childEvents.rows[0]?.c ?? 0) > 0 || Number(childDp.rows[0]?.c ?? 0) > 0) {
      return c.json({
        error: 'Cannot delete an org with existing events or frame campaigns. Remove those first.',
      }, 409)
    }

    await database.batch([
      { sql: 'DELETE FROM org_members WHERE org_id = ?', args: [orgId] },
      { sql: 'DELETE FROM organizations WHERE id = ?', args: [orgId] },
    ])

    return c.json({ success: true, message: 'Organization deleted.' })
  } catch (error) {
    console.error('Error deleting org:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ==========================================
// ORGANIZATION PROFILE (coordinator)
// ==========================================

/**
 * GET /api/orgs/:org_id/profile
 */
app.get('/:org_id/profile', async (c) => {
  const database = db(c.env)
  const userId = c.var.userId
  const orgId = c.req.param('org_id')

  const access = await requireOrgCoordinator(database, orgId, userId)
  if (!access.ok) return c.json({ error: access.message }, access.status)

  try {
    const { rows } = await database.execute({
      sql: `
        SELECT id, name, tagline, about_markdown, banner_url, logo_url, social_links, is_public_catalog
        FROM organizations
        WHERE id = ?
        LIMIT 1
      `,
      args: [orgId],
    })
    if (rows.length === 0) {
      return c.json({ error: 'Organization not found.' }, 404)
    }

    return c.json({ profile: mapOrgProfileRow(rows[0]) })
  } catch (error) {
    console.error('Error fetching org profile:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * PATCH /api/orgs/:org_id/profile
 */
app.patch('/:org_id/profile', async (c) => {
  const database = db(c.env)
  const userId = c.var.userId
  const orgId = c.req.param('org_id')

  const access = await requireOrgCoordinator(database, orgId, userId)
  if (!access.ok) return c.json({ error: access.message }, access.status)

  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const validation = profilePatchSchema.safeParse(body)
  if (!validation.success) {
    return c.json({ error: 'Invalid profile data.' }, 400)
  }

  const data = validation.data
  const updates: string[] = []
  const args: unknown[] = []

  if (data.isPublicCatalog !== undefined) {
    updates.push('is_public_catalog = ?')
    args.push(data.isPublicCatalog ? 1 : 0)
  }
  if (data.tagline !== undefined) {
    updates.push('tagline = ?')
    args.push(data.tagline?.trim() || null)
  }
  if (data.aboutMarkdown !== undefined) {
    updates.push('about_markdown = ?')
    args.push(data.aboutMarkdown?.trim() || null)
  }
  if (data.bannerUrl !== undefined) {
    updates.push('banner_url = ?')
    args.push(data.bannerUrl?.trim() || null)
  }
  if (data.logoUrl !== undefined) {
    updates.push('logo_url = ?')
    args.push(data.logoUrl?.trim() || null)
  }
  if (data.socialLinks !== undefined) {
    updates.push('social_links = ?')
    args.push(JSON.stringify(data.socialLinks))
  }

  if (updates.length === 0) {
    return c.json({ error: 'No profile fields to update.' }, 400)
  }

  args.push(orgId)

  try {
    await database.execute({
      sql: `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`,
      args,
    })

    const { rows } = await database.execute({
      sql: `
        SELECT id, name, tagline, about_markdown, banner_url, logo_url, social_links, is_public_catalog
        FROM organizations
        WHERE id = ?
        LIMIT 1
      `,
      args: [orgId],
    })

    return c.json({ success: true, profile: mapOrgProfileRow(rows[0]) })
  } catch (error) {
    console.error('Error updating org profile:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/orgs/:org_id/leave
 * Active member leaves the organization (owners must transfer first).
 */
app.post('/:org_id/leave', async (c) => {
  const database = db(c.env)
  const userId = c.var.userId
  const userEmail = c.var.userEmail
  const orgId = c.req.param('org_id')

  try {
    const orgRes = await database.execute({
      sql: 'SELECT owner_id FROM organizations WHERE id = ? LIMIT 1',
      args: [orgId],
    })
    if (orgRes.rows.length === 0) {
      return c.json({ error: 'Organization not found.' }, 404)
    }
    if (orgRes.rows[0].owner_id === userId) {
      return c.json({ error: 'Owners cannot leave. Transfer ownership first.' }, 400)
    }

    const result = await database.execute({
      sql: 'DELETE FROM org_members WHERE org_id = ? AND email = ?',
      args: [orgId, userEmail.toLowerCase()],
    })
    if (result.rowsAffected === 0) {
      return c.json({ error: 'You are not a member of this organization.' }, 404)
    }

    return c.json({ success: true, message: 'You have left the organization.' })
  } catch (error) {
    console.error('Error leaving org:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * GET /api/orgs/:org_id/members
 */
app.get('/:org_id/members', async (c) => {
  const database = db(c.env)
  const requesterId = c.var.userId
  const orgId = c.req.param('org_id')

  try {
    const { rows: ownerCheck } = await database.execute({
      sql: `
        SELECT 1
        FROM organizations
        WHERE id = ? AND owner_id = ?
        LIMIT 1
      `,
      args: [orgId, requesterId],
    })

    if (ownerCheck.length === 0) {
      return c.json({ error: 'Forbidden. Only the organization owner can view the member list.' }, 403)
    }

    const { rows } = await database.execute({
      sql: `
        SELECT email, user_id, invited_at, activated_at
        FROM org_members
        WHERE org_id = ?
        ORDER BY invited_at DESC
      `,
      args: [orgId],
    })

    return c.json({ members: rows }, 200)
  } catch (error) {
    console.error('Error fetching members:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/orgs/:org_id/members
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
  const apcEmailRegex = /^[a-zA-Z0-9._%+-]+@(?:student\.)?apc\.edu\.ph$/
  if (!apcEmailRegex.test(targetEmail)) {
    return c.json({ error: 'Invalid domain. Invitations are strictly restricted to @apc.edu.ph or @student.apc.edu.ph domain emails.' }, 400)
  }

  try {
    const { rows: ownerCheck } = await database.execute({
      sql: `
        SELECT 1
        FROM organizations
        WHERE id = ? AND owner_id = ?
        LIMIT 1
      `,
      args: [orgId, requesterId],
    })

    if (ownerCheck.length === 0) {
      return c.json({ error: 'Forbidden. Only the organization owner can invite new members.' }, 403)
    }

    const result = await database.execute({
      sql: `
        INSERT INTO org_members (org_id, email, user_id, invited_at, activated_at)
        VALUES (?, ?, NULL, CURRENT_TIMESTAMP, NULL)
        ON CONFLICT(org_id, email) DO NOTHING
      `,
      args: [orgId, targetEmail],
    })

    return c.json({
      success: true,
      message: 'Invitation sent. If the user does not possess an account, they have been silently pre-provisioned.',
      changes: result.rowsAffected,
    }, 200)
  } catch (error) {
    console.error('Error during invitation:', error)
    return c.json({ error: 'Internal server error while processing the invitation.' }, 500)
  }
})

/**
 * DELETE /api/orgs/:org_id/members
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
    const { rows: ownerCheck } = await database.execute({
      sql: `
        SELECT 1
        FROM organizations
        WHERE id = ? AND owner_id = ?
        LIMIT 1
      `,
      args: [orgId, requesterId],
    })

    if (ownerCheck.length === 0) {
      return c.json({ error: 'Forbidden. Only the organization owner can remove members.' }, 403)
    }

    const { rows: ownerEmailCheck } = await database.execute({
      sql: `SELECT email FROM users WHERE id = ? LIMIT 1`,
      args: [requesterId],
    })

    if (ownerEmailCheck.length > 0 && ownerEmailCheck[0].email === targetEmail) {
      return c.json({ error: 'You cannot remove yourself from the organization. Transfer ownership first.' }, 400)
    }

    const result = await database.execute({
      sql: `DELETE FROM org_members WHERE org_id = ? AND email = ?`,
      args: [orgId, targetEmail],
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
    const { rows: ownerCheck } = await database.execute({
      sql: `
        SELECT 1
        FROM organizations
        WHERE id = ? AND owner_id = ?
        LIMIT 1
      `,
      args: [orgId, requesterId],
    })

    if (ownerCheck.length === 0) {
      return c.json({ error: 'Forbidden. Only the organization owner can transfer ownership.' }, 403)
    }

    const { rows: memberCheck } = await database.execute({
      sql: `
        SELECT user_id
        FROM org_members
        WHERE org_id = ? AND email = ? AND activated_at IS NOT NULL
        LIMIT 1
      `,
      args: [orgId, targetEmail],
    })

    if (memberCheck.length === 0 || !memberCheck[0].user_id) {
      return c.json({ error: 'Cannot transfer ownership. The target user must be an active, registered member of this organization.' }, 400)
    }

    const newOwnerId = memberCheck[0].user_id as string

    if (newOwnerId === requesterId) {
      return c.json({ error: 'You already own this organization.' }, 400)
    }

    const { rows: existingOwnership } = await database.execute({
      sql: `
        SELECT 1
        FROM organizations
        WHERE owner_id = ?
        LIMIT 1
      `,
      args: [newOwnerId],
    })

    if (existingOwnership.length > 0) {
      return c.json({ error: 'The target user already owns an organization. Users can only own one organization.' }, 400)
    }

    await database.execute({
      sql: `
        UPDATE organizations
        SET owner_id = ?
        WHERE id = ?
      `,
      args: [newOwnerId, orgId],
    })

    return c.json({
      success: true,
      message: 'Organization ownership has been successfully transferred.',
    }, 200)
  } catch (error) {
    console.error('Error transferring ownership:', error)
    return c.json({ error: 'Internal server error while transferring ownership.' }, 500)
  }
})

export default app
