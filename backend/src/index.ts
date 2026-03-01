import { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { cors } from 'hono/cors'
import { createClient } from '@libsql/client/web'
import * as bcrypt from 'bcryptjs'
import { z } from 'zod'

// 1. Environment Bindings
type Bindings = {
  TURSO_DATABASE_URL: string
  TURSO_AUTH_TOKEN: string
  JWT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

// 2. Enable CORS so Vue can talk to Hono
app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'], // Allow local Vue dev & preview ports
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))

// 3. Define the Strict Password Rules using Zod
const registerSchema = z.object({
  email: z.string().email('Invalid email address structure.'),
  password: z.string()
    .min(8, 'Security violation: Password must be at least 8 characters.')
    .regex(/[A-Z]/, 'Security violation: Must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Security violation: Must contain at least one lowercase letter.')
    .regex(/[0-9]/, 'Security violation: Must contain at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Security violation: Must contain at least one special symbol.')
})

app.get('/', (c) => c.text('eypi.cc API is online.'))
app.get('/api/health', async (c) => { /* ... existing health check ... */ return c.text('OK') })

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

    // Connect to Turso
    const db = createClient({
      url: c.env.TURSO_DATABASE_URL,
      authToken: c.env.TURSO_AUTH_TOKEN,
    })

    // Insert into the database
    await db.execute({
      sql: 'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      args: [userId, email, passwordHash]
    })

    return c.json({ 
      status: 'success', 
      message: 'Administrator account successfully encrypted and stored.' 
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

    const user = result.rows[0] as unknown as { id: string; email: string; password_hash: string }

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

export default app