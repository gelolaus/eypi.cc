import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { cors } from 'hono/cors'
import { createClient } from '@libsql/client/web'
import * as bcrypt from 'bcryptjs'
import { Resend } from 'resend'
import { z } from 'zod'

// 1. Environment Bindings
type Bindings = {
  TURSO_DATABASE_URL: string
  TURSO_AUTH_TOKEN: string
  JWT_SECRET: string
  RESEND_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

// 2. Enable CORS so Vue can talk to Hono (must be first middleware)
app.use('/api/*', cors({
  origin: (origin) => {
    const allowed = ['http://localhost:5173', 'https://eypi.cc']
    return allowed.includes(origin) ? origin : 'https://eypi.cc'
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 86400, // Cache preflight for 24 hours
}))

// Explicit OPTIONS handler for preflight requests
app.options('*', (c) => c.body(null, 204))

// 3. Define the Strict Password Rules using Zod
const registerSchema = z.object({
  email: z.string().email().regex(/@(?:student\.)?apc\.edu\.ph$/, 'Only APC email addresses (@apc.edu.ph or @student.apc.edu.ph) are allowed.'),
  password: z.string()
    .min(8, 'Security violation: Password must be at least 8 characters.')
    .regex(/[A-Z]/, 'Security violation: Must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Security violation: Must contain at least one lowercase letter.')
    .regex(/[0-9]/, 'Security violation: Must contain at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Security violation: Must contain at least one special symbol.')
})

const generateSlug = () => Math.random().toString(36).substring(2, 8)

const normalizeUrl = (url: string) => {
  let trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`
  return trimmed
}

app.get('/', (c) => c.text('eypi.cc API is online.'))
app.get('/api/health', async (c) => { /* ... existing health check ... */ return c.text('OK') })

// 6. Link Routes (require JWT)
app.get('/api/links', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized', message: 'Missing or malformed token' }, 401)
  }
  const token = authHeader.split(' ')[1]
  if (!token) return c.json({ error: 'Unauthorized', message: 'Missing or malformed token' }, 401)
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { sub: string }
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const result = await db.execute({
      sql: 'SELECT id, original_url, slug, clicks FROM links WHERE user_id = ? ORDER BY created_at DESC',
      args: [payload.sub],
    })
    const links = result.rows.map((row) => {
      const r = row as unknown as { id: string; original_url: string; slug: string; clicks?: number }
      return {
        id: r.id,
        original: r.original_url,
        short: `eypi.cc/${r.slug}`,
        clicks: r.clicks ?? 0,
      }
    })
    return c.json({ status: 'success', links })
  } catch {
    return c.json({ error: 'Unauthorized', message: 'Invalid session' }, 401)
  }
})

// Public redirect lookup (no auth required)
app.get('/api/links/:slug', async (c) => {
  const slug = c.req.param('slug')
  const db = createClient({
    url: c.env.TURSO_DATABASE_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  })
  const result = await db.execute({
    sql: 'SELECT original_url FROM links WHERE slug = ?',
    args: [slug],
  })
  if (result.rows.length === 0) return c.json({ error: 'Not Found' }, 404)

  await db.execute({
    sql: 'UPDATE links SET clicks = COALESCE(clicks, 0) + 1 WHERE slug = ?',
    args: [slug],
  })

  const row = result.rows[0] as unknown as { original_url: string }
  return c.json({ original_url: row.original_url })
})

app.put('/api/links/:id', async (c) => {
  const id = c.req.param('id')
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const token = authHeader.split(' ')[1]
    if (!token) return c.json({ error: 'Unauthorized' }, 401)
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { sub: string }
    const { original_url, slug } = await c.req.json() as { original_url?: string; slug?: string }
    if (!original_url || typeof original_url !== 'string' || !slug || typeof slug !== 'string') {
      return c.json({ error: 'original_url and slug are required' }, 400)
    }
    const normalizedUrl = normalizeUrl(original_url)
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const result = await db.execute({
      sql: 'UPDATE links SET original_url = ?, slug = ? WHERE id = ? AND user_id = ?',
      args: [normalizedUrl, slug.toLowerCase(), id, payload.sub],
    })
    if (result.rowsAffected === 0) {
      return c.json({ error: 'Link not found or access denied' }, 404)
    }
    return c.json({ status: 'success', message: 'Link updated.' })
  } catch {
    return c.json({ error: 'Update failed' }, 400)
  }
})

app.delete('/api/links/:id', async (c) => {
  const id = c.req.param('id')
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const token = authHeader.split(' ')[1]
    if (!token) return c.json({ error: 'Unauthorized' }, 401)
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { sub: string }
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    const result = await db.execute({
      sql: 'DELETE FROM links WHERE id = ? AND user_id = ?',
      args: [id, payload.sub],
    })
    if (result.rowsAffected === 0) {
      return c.json({ error: 'Link not found or access denied' }, 404)
    }
    return c.json({ status: 'success', message: 'Link deleted.' })
  } catch {
    return c.json({ error: 'Delete failed' }, 400)
  }
})

app.post('/api/links', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const token = authHeader.split(' ')[1]
    if (!token) return c.json({ error: 'Unauthorized' }, 401)
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { sub: string }
    const { original_url } = await c.req.json() as { original_url?: string }
    if (!original_url || typeof original_url !== 'string') {
      return c.json({ error: 'original_url is required' }, 400)
    }
    const normalizedUrl = normalizeUrl(original_url)
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })
    let slug = generateSlug()
    const existing = await db.execute({ sql: 'SELECT slug FROM links WHERE slug = ?', args: [slug] })
    if (existing.rows.length > 0) slug = generateSlug()
    const linkId = crypto.randomUUID()
    await db.execute({
      sql: 'INSERT INTO links (id, user_id, original_url, slug) VALUES (?, ?, ?, ?)',
      args: [linkId, payload.sub, normalizedUrl, slug],
    })
    return c.json({ status: 'success', link: { slug, original_url: normalizedUrl } })
  } catch {
    return c.json({ error: 'Invalid Session' }, 401)
  }
})

// 4. The Registration Route
app.post('/api/auth/register', async (c) => {
  try {
    const body = await c.req.json()
    
    // Validate incoming data against our strict rules
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      // If it fails, send back the exact rules they broke
      return c.json({ 
        status: 'error', 
        message: validation.error.issues.map((i) => i.message).join(', ') 
      }, 400)
    }

    const { email, password } = validation.data

    // Hash the password securely (10 rounds of salting)
    const passwordHash = bcrypt.hashSync(password, 10)
    
    // Generate a secure, random ID for the database
    const userId = crypto.randomUUID()
    const verificationToken = crypto.randomUUID()

    // Connect to Turso
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })

    // 1. Check for existing user before INSERT
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email],
    })

    if (existing.rows.length > 0) {
      // 2. User exists: reset verification status, new password, new token (overwrites old token)
      await db.execute({
        sql: 'UPDATE users SET password_hash = ?, verification_token = ?, is_verified = 0 WHERE email = ?',
        args: [passwordHash, verificationToken, email],
      })
    } else {
      // 3. New user: insert
      await db.execute({
        sql: 'INSERT INTO users (id, email, password_hash, is_verified, verification_token) VALUES (?, ?, ?, 0, ?)',
        args: [userId, email, passwordHash, verificationToken]
      })
    }
    console.log('Registration succeeded, verification token stored for email:', email)

    const resend = new Resend(c.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'eypicc@resend.gelolaus.com',
      to: email,
      subject: 'Verify your eypi.cc account',
      html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f7; padding: 40px 20px; text-align: center;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border: 2px solid #34418F; border-radius: 16px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
    <h1 style="color: #34418F; font-size: 24px; font-weight: 900; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 2px;">eypi.cc</h1>
    <p style="color: #555555; font-size: 14px; line-height: 1.6; letter-spacing: normal; margin-bottom: 32px;">
      Welcome to eypi.cc, the link shortener for APC Rams! <br>To finalize your access to the edge, please verify your transmission.
    </p>
    <a href="https://eypi.cc/verify?token=${verificationToken}"
       style="background-color: #DEAC4B; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; text-transform: uppercase; letter-spacing: 1px;">
      Verify Account
    </a>
    <p style="color: #999999; font-size: 12px; margin-top: 32px;">
      If the button doesn't work, copy and paste this link:<br>
      <span style="color: #34418F; word-break: break-all;">https://eypi.cc/verify?token=${verificationToken}</span>
    </p>
    <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 32px 0;">
    <p style="color: #bbbbbb; font-size: 10px; text-transform: uppercase;">Created by Angelo Laus for the APC Community</p>
  </div>
</div>
`,
    })

    return c.json({ 
      status: 'success', 
      message: 'Registration successful. Please check your APC email to verify your account.' 
    }, 201)

  } catch (error: any) {
    // Catch the UNIQUE constraint error if you try to register the same email twice
    if (error.message.includes('UNIQUE constraint failed')) {
      return c.json({ status: 'error', message: 'Identity already exists in the registry.' }, 409)
    }
    
    console.error('Registration failed:', error)
    return c.json({ status: 'error', message: 'Internal server error.' }, 500)
  }
})

// POST only: prevents crawlers (Outlook Safelinks, etc.) from auto-clicking and consuming the token
app.post('/api/auth/verify', async (c) => {
  let body: { token?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body.' }, 400)
  }

  const rawToken = body?.token
  console.log('Verifying token:', rawToken)

  const token = (typeof rawToken === 'string' ? rawToken : '').trim()
  if (!token) return c.json({ error: 'Missing verification token.' }, 400)

  const db = createClient({
    url: c.env.TURSO_DATABASE_URL,
    authToken: c.env.TURSO_AUTH_TOKEN,
  })

  const check = await db.execute({
    sql: 'SELECT id FROM users WHERE verification_token = ?',
    args: [token],
  })
  if (check.rows.length === 0) {
    console.log('Token not found or already used. Token length:', token.length)
    return c.json({ error: 'Invalid or expired token.' }, 400)
  }

  const result = await db.execute({
    sql: 'UPDATE users SET is_verified = 1, verification_token = NULL WHERE verification_token = ? RETURNING id',
    args: [token],
  })

  if (result.rows.length === 0) return c.json({ error: 'Invalid or expired token.' }, 400)

  return c.json({ status: 'success', message: 'Account verified.' })
})

// 5. The Login Route
app.post('/api/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json()

    // Connect to Turso
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })

    // Fetch user from DB
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email],
    })

    if (result.rows.length === 0) {
      return c.json({ status: 'error', message: 'Invalid credentials.' }, 401)
    }

    const user = result.rows[0] as unknown as { id: string; email: string; password_hash: string; is_verified?: number }

    if (!user.is_verified) {
      return c.json({ status: 'error', message: 'Please verify your APC email address before logging in.' }, 403)
    }

    // Verify the bcrypt hash
    const isValid = bcrypt.compareSync(password, user.password_hash)
    if (!isValid) {
      return c.json({ status: 'error', message: 'Invalid credentials.' }, 401)
    }

    // Generate the JWT
    const payload = {
      sub: user.id,
      email: user.email,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Token expires in 24 hours
    }
    const token = await sign(payload, c.env.JWT_SECRET)

    return c.json({
      status: 'success',
      message: 'Authentication successful',
      token,
    }, 200)
  } catch (error) {
    console.error('Login failed:', error)
    return c.json({ status: 'error', message: 'Internal server error.' }, 500)
  }
})

// 6. Change Password Route (requires JWT)
app.put('/api/auth/password', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const token = authHeader.split(' ')[1]
    if (!token) return c.json({ error: 'Unauthorized' }, 401)

    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { sub: string }
    const { currentPassword, newPassword } = await c.req.json() as { currentPassword?: string; newPassword?: string }

    if (!currentPassword || !newPassword) {
      return c.json({ error: 'currentPassword and newPassword are required' }, 400)
    }

    // Re-use our strict Zod password rules
    const passwordValidation = z.string()
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter.')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter.')
      .regex(/[0-9]/, 'Must contain at least one number.')
      .regex(/[^A-Za-z0-9]/, 'Must contain at least one special symbol.')
      .safeParse(newPassword)

    if (!passwordValidation.success) {
      return c.json({
        error: passwordValidation.error.issues.map((i) => i.message).join(', '),
      }, 400)
    }

    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })

    // Fetch current user to check old password
    const userResult = await db.execute({
      sql: 'SELECT password_hash FROM users WHERE id = ?',
      args: [payload.sub],
    })

    if (userResult.rows.length === 0) {
      return c.json({ error: 'User not found.' }, 404)
    }

    const row = userResult.rows[0] as unknown as { password_hash: string }

    // Verify old password
    const isValid = bcrypt.compareSync(currentPassword, row.password_hash)
    if (!isValid) {
      return c.json({ error: 'Incorrect current password.' }, 401)
    }

    // Hash new password and update DB
    const newHash = bcrypt.hashSync(newPassword, 10)
    await db.execute({
      sql: 'UPDATE users SET password_hash = ? WHERE id = ?',
      args: [newHash, payload.sub],
    })

    return c.json({ status: 'success', message: 'Security credentials updated successfully.' })
  } catch (error) {
    console.error('Password update failed:', error)
    return c.json({ error: 'Failed to update password.' }, 500)
  }
})

export default app