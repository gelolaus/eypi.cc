import { Context, Next } from 'hono'
import { db, getUser } from '../lib/db'
import type { Bindings } from '../lib/db'

export const isOrgFeature = async (c: Context<{ Bindings: Bindings, Variables: { userId: string; userEmail: string } }>, next: Next) => {
  const user = await getUser(c as any)
  
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const database = db(c.env)

  try {
    const { rows } = await database.execute({
      sql: `
        SELECT 1 
        FROM org_members 
        WHERE user_id = ? AND activated_at IS NOT NULL 
        UNION
        SELECT 1
        FROM organizations
        WHERE owner_id = ?
        LIMIT 1
      `,
      args: [user.sub, user.sub]
    })

    if (rows.length === 0) {
      return c.json(
        {
          message: 'Creation tools are locked to student organizations. You must be an active member of an organization to access this feature.',
          action_url: 'https://forms.office.com/r/placeholder-registration-url',
        },
        403
      )
    }

    // Append userId and userEmail to the context for downstream handlers
    c.set('userId', user.sub)
    c.set('userEmail', user.email)

    await next()
  } catch (error) {
    console.error('Database error in isOrgFeature guard:', error)
    return c.json({ error: 'Internal Server Error validating organization access.' }, 500)
  }
}
