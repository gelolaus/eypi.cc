import { Hono } from 'hono'
import { db } from '../lib/db'
import type { Bindings } from '../lib/db'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/stats', async (c) => {
  const database = db(c.env)
  const [orgsRes, linksRes, eventsRes] = await Promise.all([
    database.execute('SELECT COUNT(*) as c FROM organizations'),
    database.execute('SELECT COUNT(*) as c FROM links'),
    database.execute('SELECT COUNT(*) as c FROM events'),
  ])
  return c.json({
    orgs: Number(orgsRes.rows[0]?.c ?? 0),
    links: Number(linksRes.rows[0]?.c ?? 0),
    events: Number(eventsRes.rows[0]?.c ?? 0),
  })
})

export default app
