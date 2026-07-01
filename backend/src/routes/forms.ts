import { Hono } from 'hono'
import { isOrgFeature } from '../middleware/orgGuard'
import type { Bindings } from '../lib/db'

const app = new Hono<{ Bindings: Bindings }>()

const FORM_CATALOG = [
  {
    id: 'concessionaire',
    title: 'Concessionaire Form',
    description: 'Generate official concessionaire documents.',
    route: '/forms/concessionaire',
  },
  {
    id: 'visitors-pass',
    title: 'Visitors Pass',
    description: 'Generate a visitors pass from a CSV list of names.',
    route: '/forms/visitors-pass',
  },
  {
    id: 'letter-of-intent',
    title: 'Letter of Intent & Waiver',
    description: 'Batch generate student waivers into a ZIP file from a CSV list.',
    route: '/forms/letter-of-intent',
  },
]

const TEMPLATE_ALLOWLIST = new Set([
  'concessionaire_reply_form.docx',
  'memorandum_of_agreement.docx',
  'terms_and_conditions.docx',
  'waiver_form.docx',
  'products_and_equipments.docx',
  'visitors_pass.docx',
  'letter_of_intent_and_waiver.docx',
])

app.get('/api/forms', isOrgFeature, (c) => {
  return c.json({ status: 'ok', forms: FORM_CATALOG })
})

app.get('/api/forms/templates/:filename', isOrgFeature, async (c) => {
  const filename = c.req.param('filename')
  if (!TEMPLATE_ALLOWLIST.has(filename)) {
    return c.json({ status: 'error', message: 'Template not found.' }, 404)
  }

  const asset = await c.env.ASSETS.fetch(new URL(`/forms/templates/${filename}`, c.req.url))
  if (!asset.ok) {
    return c.json({ status: 'error', message: 'Template not found.' }, 404)
  }

  return new Response(asset.body, {
    status: asset.status,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Cache-Control': 'private, no-store',
    },
  })
})

export default app
