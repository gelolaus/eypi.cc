import { Hono } from 'hono'
import type { Bindings } from '../../lib/db'

// Student registration and ticket endpoints land here (Task 3, part B).
const app = new Hono<{ Bindings: Bindings }>()

export default app
