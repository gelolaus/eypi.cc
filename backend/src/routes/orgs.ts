import { Hono } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'
import type { Client, InStatement, InValue } from '@libsql/client/web'
import { isApcEmail, normalizeEmail } from '../../../shared/apcIdentity'
import { db } from '../lib/db'
import type { Bindings } from '../lib/db'
import { ApiError } from '../lib/errors'
import { deliverOrgInviteEmail } from '../lib/emails/orgInviteEmail'
import { deleteObject, mediaUrl, putImage } from '../lib/media'
import { requireAdmin } from '../middleware/requireAdmin'
import { enforceConsent } from '../middleware/requireConsent'
import { requireAuth } from '../middleware/requireAuth'

type Variables = {
  userId: string
  userEmail: string
  user?: { id: string; email?: string; name?: string; role?: string }
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const TAGLINE_MAX = 160
const ABOUT_MAX = 8000
const URL_MAX = 2048
const IMAGE_DATA_URL_MAX = 3 * 1024 * 1024
const ORG_IMAGE_MAX_BYTES = 3 * 1024 * 1024

const ORG_TYPE_VALUES = [
  'shs_academic',
  'soar_academic',
  'socit_academic',
  'soe_academic',
  'som_academic',
  'soma_academic',
  'special_interest',
  'socio_civic',
  'performing_arts',
] as const

function validateImageUrl(value: string): boolean {
  if (!value) return true
  if (value.length <= URL_MAX && value.startsWith('/media/orgs/') && !value.includes('..')) return true
  if (value.length <= URL_MAX && /^https?:\/\//i.test(value)) return true
  const prefix = value.slice(0, 40).toLowerCase()
  const okPrefix =
    prefix.startsWith('data:image/jpeg;base64,')
    || prefix.startsWith('data:image/png;base64,')
    || prefix.startsWith('data:image/webp;base64,')
  return okPrefix && value.length <= IMAGE_DATA_URL_MAX
}

function decodeDataUrl(value: string): Uint8Array | null {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\s]+)$/i.exec(value.trim())
  if (!match?.[1]) return null
  let binary: string
  try {
    binary = atob(match[1].replace(/\s/g, ''))
  } catch {
    return null
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function isOrgImageKey(orgId: string, kind: 'logo' | 'banner', key: string): boolean {
  const prefix = `orgs/${orgId}/${kind}-`
  if (!key.startsWith(prefix) || key.includes('..') || key.includes('\\')) return false
  return /^[0-9a-f]{8}\.(png|jpg|webp)$/.test(key.slice(prefix.length))
}

function presentImage(value: unknown, catalog: boolean): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.toLowerCase().includes('data:')) return catalog ? null : trimmed
  if (trimmed.startsWith('/media/')) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('orgs/') && !trimmed.includes('..') && !trimmed.includes('\\')) {
    return mediaUrl(trimmed)
  }
  return catalog ? null : trimmed
}

type ImageChange = {
  value: string | null
  uploadedKey: string | null
  deleteKey: string | null
}

async function resolveOrgImage(
  env: Bindings,
  orgId: string,
  kind: 'logo' | 'banner',
  incoming: string | null,
  current: string | null,
): Promise<ImageChange> {
  const currentKey = current && isOrgImageKey(orgId, kind, current) ? current : null
  const trimmed = incoming?.trim() || ''
  if (!trimmed) return { value: null, uploadedKey: null, deleteKey: currentKey }

  if (/^https?:\/\//i.test(trimmed)) {
    return { value: trimmed, uploadedKey: null, deleteKey: currentKey }
  }

  const fromMedia = trimmed.startsWith('/media/') ? trimmed.slice('/media/'.length) : trimmed
  if (isOrgImageKey(orgId, kind, fromMedia)) {
    return {
      value: fromMedia,
      uploadedKey: null,
      deleteKey: fromMedia === currentKey ? null : currentKey,
    }
  }

  if (trimmed.toLowerCase().startsWith('data:')) {
    const bytes = decodeDataUrl(trimmed)
    if (!bytes) throw new ApiError(422, 'invalid_image', 'Use a PNG, JPEG, or WebP image.')
    const stored = await putImage(env, {
      prefix: `orgs/${orgId}`,
      id: kind,
      bytes,
      allowed: ['png', 'jpeg', 'webp'],
      maxBytes: ORG_IMAGE_MAX_BYTES,
    })
    return {
      value: stored.key,
      uploadedKey: stored.key === currentKey ? null : stored.key,
      deleteKey: stored.key === currentKey ? null : currentKey,
    }
  }

  throw new ApiError(422, 'invalid_image', 'Use a PNG, JPEG, or WebP image.')
}

function imageError(err: ApiError) {
  const error: { code: string; message: string; fields?: Record<string, string> } = {
    code: err.code,
    message: err.message,
  }
  if (err.fields) error.fields = err.fields
  return { error }
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
  orgType: z.enum(ORG_TYPE_VALUES).nullable().optional(),
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

function errorBody(code: string, message: string) {
  return { error: { code, message } }
}

function timestampMs(value: unknown): number | null {
  if (value == null) return null
  const raw = String(value).trim()
  if (!raw) return null
  const direct = Date.parse(raw)
  if (Number.isFinite(direct)) return direct
  const sqlite = Date.parse(`${raw.replace(' ', 'T')}Z`)
  return Number.isFinite(sqlite) ? sqlite : null
}

function signedInUser(c: { var: Variables }): { id: string; email: string; name: string } | null {
  const user = c.var.user
  if (!user?.id || !user.email) return null
  return { id: user.id, email: user.email, name: user.name ?? '' }
}

async function findMembership(database: Client, orgId: string, email: string) {
  const { rows } = await database.execute({
    sql: `
      SELECT email, user_id, activated_at, declined_at, invited_at
      FROM org_members
      WHERE org_id = ? AND lower(email) = lower(?)
      LIMIT 1
    `,
    args: [orgId, email],
  })
  return rows[0] ?? null
}

function isSet(value: unknown): boolean {
  return value != null && String(value).length > 0
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

function mapOrgProfileRow(row: Record<string, unknown>, options?: { catalog?: boolean }) {
  const catalog = options?.catalog === true
  const rawOrgType = row.org_type as string | null | undefined
  const orgType = rawOrgType && ORG_TYPE_VALUES.includes(rawOrgType as typeof ORG_TYPE_VALUES[number])
    ? rawOrgType
    : null

  return {
    slug: row.id as string,
    name: row.name as string,
    tagline: (row.tagline as string | null) ?? null,
    orgType,
    aboutMarkdown: (row.about_markdown as string | null) ?? null,
    bannerUrl: presentImage(row.banner_url, catalog),
    logoUrl: presentImage(row.logo_url, catalog),
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
  const database = db(c)
  try {
    const { rows } = await database.execute({
      sql: `
        SELECT id, name, tagline, org_type, logo_url
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
        orgType: mapOrgProfileRow(row).orgType,
        logoUrl: presentImage(row.logo_url, true),
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
  const database = db(c)
  const slug = c.req.param('slug')

  try {
    const orgRes = await database.execute({
      sql: `
        SELECT id, name, tagline, org_type, about_markdown, banner_url, logo_url, social_links, is_public_catalog
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

    const { isPublicCatalog: _omit, ...org } = mapOrgProfileRow(orgRow, { catalog: true })

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

// Session required except the public catalog, which is registered above this middleware.
// requireAuth does not return its next() result, so a consent 403 is returned from here.
app.use('*', async (c, next) => {
  const path = c.req.path
  if (path.endsWith('/public') || path.includes('/public/')) {
    await next()
    return
  }
  let denied: Response | null = null
  const authed = await requireAuth(c, async () => {
    denied = await enforceConsent(c)
    if (!denied) await next()
  })
  if (denied) return denied
  return authed
})

// ==========================================
// MY ORGANIZATIONS & MEMBERS
// ==========================================

/**
 * GET /api/orgs
 * Fetch all organizations the user is an active member of or owns.
 */
app.get('/', async (c) => {
  const database = db(c)
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
        ORDER BY o.name
      `,
      args: [userId, userId, userId],
    })

    return c.json({
      orgs: rows.map((row) => ({
        org_id: row.org_id,
        org_name: row.org_name,
        logo_url: presentImage(row.logo_url, false),
        owner_id: row.owner_id,
        is_public_catalog: row.is_public_catalog,
        is_owner: row.is_owner,
        created_at: row.created_at,
      })),
    }, 200)
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/orgs
 * Create a new organization. Restricted to users.role = admin.
 */
app.post('/', requireAdmin, async (c) => {
  const database = db(c)

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
  const user = signedInUser(c)
  if (!user) return c.json(errorBody('unauthorized', 'Sign in to continue.'), 401)

  const { rows } = await db(c).execute({
    sql: `
      SELECT
        o.id AS org_id,
        o.name AS org_name,
        o.logo_url AS logo_url,
        u.name AS invited_by_name,
        m.invited_at AS invited_at
      FROM org_members m
      JOIN organizations o ON o.id = m.org_id
      LEFT JOIN users u ON u.id = m.invited_by
      WHERE lower(m.email) = lower(?)
        AND m.activated_at IS NULL
        AND m.declined_at IS NULL
      ORDER BY m.invited_at DESC
    `,
    args: [user.email],
  })

  return c.json(rows.map((row) => ({
    orgId: String(row.org_id),
    orgName: String(row.org_name),
    logoUrl: presentImage(row.logo_url, false),
    invitedByName: row.invited_by_name == null ? null : String(row.invited_by_name),
    invitedAt: row.invited_at == null ? null : String(row.invited_at),
  })))
})

app.post('/invites/:org_id/accept', async (c) => {
  const user = signedInUser(c)
  if (!user) return c.json(errorBody('unauthorized', 'Sign in to continue.'), 401)

  const orgId = c.req.param('org_id')
  const result = await db(c).execute({
    sql: `
      UPDATE org_members
      SET activated_at = ?, user_id = ?, declined_at = NULL
      WHERE org_id = ?
        AND lower(email) = lower(?)
        AND activated_at IS NULL
        AND declined_at IS NULL
    `,
    args: [new Date().toISOString(), user.id, orgId, user.email],
  })

  if (result.rowsAffected === 0) {
    return c.json(errorBody('not_found', 'Invitation not found.'), 404)
  }
  return c.json({ orgId })
})

app.post('/invites/:org_id/decline', async (c) => {
  const user = signedInUser(c)
  if (!user) return c.json(errorBody('unauthorized', 'Sign in to continue.'), 401)

  const orgId = c.req.param('org_id')
  const result = await db(c).execute({
    sql: `
      UPDATE org_members
      SET declined_at = ?
      WHERE org_id = ?
        AND lower(email) = lower(?)
        AND activated_at IS NULL
        AND declined_at IS NULL
    `,
    args: [new Date().toISOString(), orgId, user.email],
  })

  if (result.rowsAffected === 0) {
    return c.json(errorBody('not_found', 'Invitation not found.'), 404)
  }
  return c.json({ orgId })
})

// ==========================================
// SUPER ADMIN — ORG MANAGEMENT
// ==========================================

/**
 * GET /api/orgs/admin
 * List all organizations (admin).
 */
app.get('/admin', requireAdmin, async (c) => {
  const database = db(c)
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
app.get('/admin/:org_id', requireAdmin, async (c) => {
  const database = db(c)
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
app.patch('/admin/:org_id', requireAdmin, async (c) => {
  const database = db(c)
  const orgId = c.req.param('org_id')
  if (!orgId) return c.json({ error: 'Organization not found.' }, 404)

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
      sql: `
        SELECT id, name, owner_id, created_at, is_public_catalog, tagline,
               about_markdown, banner_url, logo_url, social_links, org_type
        FROM organizations
        WHERE id = ?
        LIMIT 1
      `,
      args: [orgId],
    })
    if (existing.rows.length === 0) {
      return c.json({ error: 'Organization not found.' }, 404)
    }

    const current = existing.rows[0]
    let newOrgId = orgId
    let newOwnerId = current.owner_id as string

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

    const statements: InStatement[] = []
    const nextName = data.name !== undefined ? data.name.trim() : String(current.name)
    const nextCatalog = data.isPublicCatalog !== undefined
      ? (data.isPublicCatalog ? 1 : 0)
      : Number(current.is_public_catalog ?? 0)

    if (newOrgId !== orgId) {
      // The new organizations row must exist before child org_id values change.
      // org_members.org_id references organizations(id).
      statements.push(
        {
          sql: `
            INSERT INTO organizations (
              id, name, owner_id, created_at, is_public_catalog, tagline,
              about_markdown, banner_url, logo_url, social_links, org_type
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          args: [
            newOrgId,
            nextName,
            newOwnerId,
            current.created_at,
            nextCatalog,
            current.tagline,
            current.about_markdown,
            current.banner_url,
            current.logo_url,
            current.social_links,
            current.org_type,
          ],
        },
        { sql: 'UPDATE events SET org_id = ? WHERE org_id = ?', args: [newOrgId, orgId] },
        { sql: 'UPDATE dp_campaigns SET org_id = ? WHERE org_id = ?', args: [newOrgId, orgId] },
        { sql: 'UPDATE org_members SET org_id = ? WHERE org_id = ?', args: [newOrgId, orgId] },
        { sql: 'DELETE FROM organizations WHERE id = ?', args: [orgId] },
      )
    } else {
      const updates: string[] = []
      const updateArgs: InValue[] = []

      if (data.name !== undefined) {
        updates.push('name = ?')
        updateArgs.push(nextName)
      }
      if (data.ownerEmail !== undefined) {
        updates.push('owner_id = ?')
        updateArgs.push(newOwnerId)
      }
      if (data.isPublicCatalog !== undefined) {
        updates.push('is_public_catalog = ?')
        updateArgs.push(nextCatalog)
      }

      if (updates.length > 0) {
        updateArgs.push(orgId)
        statements.push({
          sql: `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`,
          args: updateArgs,
        })
      }
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
app.delete('/admin/:org_id', requireAdmin, async (c) => {
  const database = db(c)
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
  const database = db(c)
  const userId = c.var.userId
  const orgId = c.req.param('org_id')

  const access = await requireOrgCoordinator(database, orgId, userId)
  if (!access.ok) return c.json({ error: access.message }, access.status)

  try {
    const { rows } = await database.execute({
      sql: `
        SELECT id, name, tagline, org_type, about_markdown, banner_url, logo_url, social_links, is_public_catalog
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
  const database = db(c)
  const userId = c.var.userId
  const orgId = c.req.param('org_id')
  if (!orgId) return c.json({ error: 'Organization not found.' }, 404)

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
  const args: InValue[] = []

  if (data.isPublicCatalog !== undefined) {
    updates.push('is_public_catalog = ?')
    args.push(data.isPublicCatalog ? 1 : 0)
  }
  if (data.tagline !== undefined) {
    updates.push('tagline = ?')
    args.push(data.tagline?.trim() || null)
  }
  if (data.orgType !== undefined) {
    updates.push('org_type = ?')
    args.push(data.orgType)
  }
  if (data.aboutMarkdown !== undefined) {
    updates.push('about_markdown = ?')
    args.push(data.aboutMarkdown?.trim() || null)
  }
  if (data.socialLinks !== undefined) {
    updates.push('social_links = ?')
    args.push(JSON.stringify(data.socialLinks))
  }

  const uploaded: string[] = []
  const deletes: string[] = []
  let committed = false

  try {
    if (data.bannerUrl !== undefined || data.logoUrl !== undefined) {
      const current = await database.execute({
        sql: 'SELECT banner_url, logo_url FROM organizations WHERE id = ? LIMIT 1',
        args: [orgId],
      })
      const row = current.rows[0]
      const currentBanner = row?.banner_url == null ? null : String(row.banner_url)
      const currentLogo = row?.logo_url == null ? null : String(row.logo_url)
      if (data.bannerUrl !== undefined) {
        const change = await resolveOrgImage(c.env, orgId, 'banner', data.bannerUrl, currentBanner)
        if (change.uploadedKey) uploaded.push(change.uploadedKey)
        if (change.deleteKey) deletes.push(change.deleteKey)
        updates.push('banner_url = ?')
        args.push(change.value)
      }
      if (data.logoUrl !== undefined) {
        const change = await resolveOrgImage(c.env, orgId, 'logo', data.logoUrl, currentLogo)
        if (change.uploadedKey) uploaded.push(change.uploadedKey)
        if (change.deleteKey) deletes.push(change.deleteKey)
        updates.push('logo_url = ?')
        args.push(change.value)
      }
    }

    if (updates.length === 0) {
      return c.json({ error: 'No profile fields to update.' }, 400)
    }

    args.push(orgId)
    await database.execute({
      sql: `UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`,
      args,
    })
    committed = true
    await Promise.all(deletes.map(async (key) => {
      try {
        await deleteObject(c.env, key)
      } catch {
        // The row already points at the new object.
      }
    }))

    const { rows } = await database.execute({
      sql: `
        SELECT id, name, tagline, org_type, about_markdown, banner_url, logo_url, social_links, is_public_catalog
        FROM organizations
        WHERE id = ?
        LIMIT 1
      `,
      args: [orgId],
    })

    return c.json({ success: true, profile: mapOrgProfileRow(rows[0]) })
  } catch (error) {
    if (!committed) {
      await Promise.all(uploaded.map(async (key) => {
        try {
          await deleteObject(c.env, key)
        } catch {
          // Keep the original error.
        }
      }))
    }
    if (error instanceof ApiError) {
      return c.json(imageError(error), error.status as ContentfulStatusCode)
    }
    console.error('Error updating org profile:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * POST /api/orgs/:org_id/leave
 * Active member leaves the organization (owners must transfer first).
 */
app.post('/:org_id/leave', async (c) => {
  const database = db(c)
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
      sql: 'DELETE FROM org_members WHERE org_id = ? AND lower(email) = lower(?)',
      args: [orgId, userEmail],
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
  const database = db(c)
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
        SELECT m.email, m.user_id, m.invited_at, m.activated_at, m.declined_at, u.name AS name
        FROM org_members m
        LEFT JOIN users u ON lower(u.email) = lower(m.email)
        WHERE m.org_id = ?
        ORDER BY m.invited_at DESC
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
  const user = signedInUser(c)
  if (!user) return c.json(errorBody('unauthorized', 'Sign in to continue.'), 401)

  const database = db(c)
  const orgId = c.req.param('org_id')
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json(errorBody('invalid_email', 'Enter an email address.'), 400)
  }

  const validation = inviteSchema.safeParse(body)
  if (!validation.success) {
    return c.json(errorBody('invalid_email', 'Enter an email address.'), 400)
  }

  const targetEmail = normalizeEmail(validation.data.email)
  if (!isApcEmail(targetEmail)) {
    return c.json(errorBody('invalid_email', 'Use an @apc.edu.ph or @student.apc.edu.ph address.'), 400)
  }

  const { rows: ownerRows } = await database.execute({
    sql: 'SELECT name FROM organizations WHERE id = ? AND owner_id = ? LIMIT 1',
    args: [orgId, user.id],
  })
  if (ownerRows.length === 0) {
    return c.json(errorBody('forbidden', 'Only the organization owner can invite members.'), 403)
  }

  const existing = await findMembership(database, orgId, targetEmail)
  if (existing && isSet(existing.activated_at)) {
    return c.json(errorBody('already_member', 'That person is already a member.'), 409)
  }
  if (existing && isSet(existing.declined_at)) {
    const declinedMs = timestampMs(existing.declined_at)
    if (declinedMs == null || Date.now() - declinedMs < WEEK_MS) {
      return c.json(errorBody('recently_declined', 'That person declined recently. Try again in 7 days.'), 429)
    }
  } else if (existing) {
    return c.json(errorBody('already_invited', 'That person already has a pending invite.'), 409)
  }

  const invitedAt = new Date().toISOString()
  if (existing) {
    await database.execute({
      sql: `
        UPDATE org_members
        SET email = ?, invited_by = ?, invited_at = ?, declined_at = NULL
        WHERE org_id = ? AND lower(email) = lower(?)
      `,
      args: [targetEmail, user.id, invitedAt, orgId, targetEmail],
    })
  } else {
    await database.execute({
      sql: `
        INSERT INTO org_members (org_id, email, user_id, invited_at, activated_at, invited_by, declined_at)
        VALUES (?, ?, NULL, ?, NULL, ?, NULL)
      `,
      args: [orgId, targetEmail, invitedAt, user.id],
    })
  }

  const emailSent = await deliverOrgInviteEmail({
    apiKey: c.env.RESEND_API_KEY,
    to: targetEmail,
    orgName: String(ownerRows[0].name),
    inviterName: user.name,
  })
  return c.json({ emailSent }, 201)
})

/**
 * POST /api/orgs/:org_id/members/:email/resend
 * At most one send per 24 hours, counted from invited_at.
 */
app.post('/:org_id/members/:email/resend', async (c) => {
  const user = signedInUser(c)
  if (!user) return c.json(errorBody('unauthorized', 'Sign in to continue.'), 401)

  const database = db(c)
  const orgId = c.req.param('org_id')
  const targetEmail = normalizeEmail(c.req.param('email'))
  const { rows: ownerRows } = await database.execute({
    sql: 'SELECT name FROM organizations WHERE id = ? AND owner_id = ? LIMIT 1',
    args: [orgId, user.id],
  })
  if (ownerRows.length === 0) {
    return c.json(errorBody('forbidden', 'Only the organization owner can invite members.'), 403)
  }

  const existing = await findMembership(database, orgId, targetEmail)
  if (!existing || isSet(existing.activated_at) || isSet(existing.declined_at)) {
    return c.json(errorBody('not_found', 'Invitation not found.'), 404)
  }

  const invitedMs = timestampMs(existing.invited_at)
  if (invitedMs != null && Date.now() - invitedMs < DAY_MS) {
    return c.json(errorBody('recently_sent', 'You can resend this invite once every 24 hours.'), 429)
  }

  await database.execute({
    sql: `
      UPDATE org_members
      SET invited_at = ?, invited_by = ?
      WHERE org_id = ? AND lower(email) = lower(?)
    `,
    args: [new Date().toISOString(), user.id, orgId, targetEmail],
  })

  const emailSent = await deliverOrgInviteEmail({
    apiKey: c.env.RESEND_API_KEY,
    to: targetEmail,
    orgName: String(ownerRows[0].name),
    inviterName: user.name,
  })
  return c.json({ emailSent }, 200)
})

/**
 * DELETE /api/orgs/:org_id/members
 */
app.delete('/:org_id/members', async (c) => {
  const database = db(c)
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

    if (
      ownerEmailCheck.length > 0 &&
      String(ownerEmailCheck[0].email).toLowerCase() === targetEmail
    ) {
      return c.json({ error: 'You cannot remove yourself from the organization. Transfer ownership first.' }, 400)
    }

    const result = await database.execute({
      sql: `DELETE FROM org_members WHERE org_id = ? AND lower(email) = lower(?)`,
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
  const database = db(c)
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
        WHERE org_id = ? AND lower(email) = lower(?) AND activated_at IS NOT NULL
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
