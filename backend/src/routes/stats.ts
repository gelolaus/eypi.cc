import { Hono } from 'hono'
import { db } from '../lib/db'
import type { Bindings } from '../lib/db'
import { withEdgeCache } from '../lib/edgeCache'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/stats', (c) => withEdgeCache(c, 30, async () => {
  const database = db(c)
  const count = async (sql: string): Promise<number> => {
    const res = await database.execute(sql)
    return Number(res.rows[0]?.c ?? 0)
  }
  const [users, orgs, members, links, clicks, events, tickets, checkIns, frames, frameDownloads] = await Promise.all([
    count('SELECT COUNT(*) AS c FROM users'),
    count('SELECT COUNT(*) AS c FROM organizations'),
    count('SELECT COUNT(*) AS c FROM org_members WHERE activated_at IS NOT NULL'),
    count('SELECT COUNT(*) AS c FROM links'),
    count('SELECT COALESCE(SUM(clicks), 0) AS c FROM links'),
    count('SELECT COUNT(*) AS c FROM events'),
    count('SELECT COUNT(*) AS c FROM attendees'),
    count("SELECT COUNT(*) AS c FROM check_ins WHERE action = 'checked_in'"),
    count('SELECT COUNT(*) AS c FROM dp_campaigns'),
    count('SELECT COALESCE(SUM(download_count), 0) AS c FROM dp_campaigns'),
  ])
  return c.json({ users, orgs, members, links, clicks, events, tickets, checkIns, frames, frameDownloads })
}))

export default app
