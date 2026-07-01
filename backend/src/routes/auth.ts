import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { createClient } from '@libsql/client/web'
import * as bcrypt from 'bcryptjs'
import { Resend } from 'resend'
import { z } from 'zod'
import type { Bindings } from '../lib/db'
import { handleUserOnboarding } from '../lib/onboarding'
import { checkRateLimit } from '../lib/rateLimit'

const app = new Hono<{ Bindings: Bindings }>()

// Allowed email domains (APC + admin whitelist)
const ALLOWED_EMAIL_DOMAINS = ['@student.apc.edu.ph', '@apc.edu.ph', '@gelolaus.com', '@alias.gelolaus.com']

// Strict password rules (Zod)
const registerSchema = z.object({
  email: z.string().email().refine(
    (email) => ALLOWED_EMAIL_DOMAINS.some((domain) => email.endsWith(domain)),
    'Only APC email addresses (@apc.edu.ph or @student.apc.edu.ph) or whitelisted admin domains are allowed.',
  ),
  password: z.string()
    .min(8, 'Security violation: Password must be at least 8 characters.')
    .regex(/[A-Z]/, 'Security violation: Must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Security violation: Must contain at least one lowercase letter.')
    .regex(/[0-9]/, 'Security violation: Must contain at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Security violation: Must contain at least one special symbol.'),
  name: z.string().trim().max(200).optional(),
})

// 4. The Registration Route
app.post('/api/auth/register', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const registerAllowed = await checkRateLimit(c.env.RATE_LIMIT_KV, `rl:register:${ip}`, 3, 3600)
  if (!registerAllowed) {
    return c.json({ status: 'error', message: 'Too many registration attempts. Please try again later.' }, 429)
  }
  try {
    const body = await c.req.json()

    // Validate incoming data against our strict rules
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      return c.json({
        status: 'error',
        message: 'Password must be at least 8 characters and contain uppercase, lowercase, a number, and a symbol.',
      }, 400)
    }

    const { email, password, name } = validation.data
    const nameValue = name?.trim() || null

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
        sql: 'UPDATE users SET password_hash = ?, verification_token = ?, is_verified = 0, name = ? WHERE email = ?',
        args: [passwordHash, verificationToken, nameValue, email],
      })
    } else {
      // 3. New user: insert
      await db.execute({
        sql: 'INSERT INTO users (id, email, password_hash, is_verified, verification_token, name) VALUES (?, ?, ?, 0, ?, ?)',
        args: [userId, email, passwordHash, verificationToken, nameValue]
      })
    }
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
    console.error('Registration failed:', error)
    return c.json({ status: 'error', message: 'Registration failed. Please try again.' }, 500)
  }
})

// POST only: prevents crawlers (Outlook Safelinks, etc.) from auto-clicking and consuming the token
app.post('/api/auth/verify', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const verifyAllowed = await checkRateLimit(c.env.RATE_LIMIT_KV, `rl:verify:${ip}`, 15, 3600)
  if (!verifyAllowed) {
    return c.json({ status: 'error', message: 'Too many verification attempts. Please try again later.' }, 429)
  }
  let body: { token?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid request body.' }, 400)
  }

  const rawToken = body?.token

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
    return c.json({ error: 'Invalid or expired token.' }, 400)
  }

  const result = await db.execute({
    sql: 'UPDATE users SET is_verified = 1, verification_token = NULL WHERE verification_token = ? RETURNING id',
    args: [token],
  })

  if (result.rows.length === 0) return c.json({ error: 'Invalid or expired token.' }, 400)

  // Fire-and-forget the onboarding hook for pre-provisioned orgs
  const userRowResult = await db.execute({ sql: 'SELECT id, email FROM users WHERE id = ?', args: [result.rows[0].id] })
  if (userRowResult.rows.length > 0) {
    const user = userRowResult.rows[0] as unknown as { id: string, email: string }
    c.executionCtx.waitUntil(handleUserOnboarding(user.email, user.id, c.env))
  }

  return c.json({ status: 'success', message: 'Account verified.' })
})

// 5. The Login Route
app.post('/api/auth/login', async (c) => {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown'
  const loginAllowed = await checkRateLimit(c.env.RATE_LIMIT_KV, `rl:login:${ip}`, 10, 900)
  if (!loginAllowed) {
    return c.json({ status: 'error', message: 'Too many login attempts. Please try again in 15 minutes.' }, 429)
  }
  try {
    const { email, password } = await c.req.json() as { email?: string; password?: string }

    const normalizedEmail = (typeof email === 'string' ? email : '').trim().toLowerCase()

    // Enforce APC / allowed domains on the backend to block direct API abuse
    if (!normalizedEmail || !ALLOWED_EMAIL_DOMAINS.some((domain) => normalizedEmail.endsWith(domain))) {
      return c.json(
        {
          success: false,
          message: 'Access restricted: Only APC emails are permitted.',
        },
        403,
      )
    }

    // Connect to Turso
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })

    // Fetch user from DB
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [normalizedEmail],
    })

    if (result.rows.length === 0) {
      return c.json({ status: 'error', message: 'Invalid credentials.' }, 401)
    }

    const user = result.rows[0] as unknown as { id: string; email: string; password_hash: string; is_verified?: number; name?: string }

    if (!user.is_verified) {
      return c.json({ status: 'error', message: 'Please verify your APC email address before logging in.' }, 403)
    }

    // Verify the bcrypt hash
    const isValid = bcrypt.compareSync(password ?? '', user.password_hash)
    if (!isValid) {
      return c.json({ status: 'error', message: 'Invalid credentials.' }, 401)
    }

    // Generate the JWT (include name for header display)
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name?.trim() || null,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // Token expires in 24 hours
    }
    const token = await sign(payload, c.env.JWT_SECRET)

    // Fire-and-forget the onboarding hook
    c.executionCtx.waitUntil(handleUserOnboarding(user.email, user.id, c.env))

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
