export type FormCatalogItem = {
  id: string
  title: string
  description: string
  route: string
}

export const FORM_CATALOG: readonly FormCatalogItem[] = [
  {
    id: 'concessionaire',
    title: 'Concessionaire Form',
    description: 'MOA, waiver, reply form, and related docs in one ZIP.',
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

export const TEMPLATE_FILES = [
  'concessionaire_reply_form.docx',
  'memorandum_of_agreement.docx',
  'terms_and_conditions.docx',
  'waiver_form.docx',
  'products_and_equipments.docx',
  'visitors_pass.docx',
  'letter_of_intent_and_waiver.docx',
] as const

export const TEMPLATE_ALLOWLIST = new Set<string>(TEMPLATE_FILES)

export const TEMPLATE_MISSING_CODE = 'template_missing'
export const TEMPLATE_MISSING_MESSAGE = "This form's template is missing. Tell the eypi.cc admin."

export type FilledTemplate = {
  file: string
  output: string
  /** False copies the file unchanged. That sheet has no merge fields. */
  fill: boolean
}

export const CONCESSIONAIRE_TEMPLATES: readonly FilledTemplate[] = [
  { file: 'concessionaire_reply_form.docx', output: 'Concessionaire_Reply_Form.docx', fill: true },
  { file: 'memorandum_of_agreement.docx', output: 'Memorandum_of_Agreement.docx', fill: true },
  { file: 'terms_and_conditions.docx', output: 'Terms_and_Conditions.docx', fill: true },
  { file: 'waiver_form.docx', output: 'Waiver_Form.docx', fill: true },
  { file: 'products_and_equipments.docx', output: 'Products_and_Equipments.docx', fill: false },
]

export const VISITORS_PASS_TEMPLATE = 'visitors_pass.docx'
export const VISITORS_PASS_OUTPUT = 'Visitors_Pass.docx'

export const LETTER_TEMPLATE = 'letter_of_intent_and_waiver.docx'
export const LETTER_ZIP_NAME = 'LOIW_Batch.zip'
export const LETTER_ENTRY_SUFFIX = '_LOIW.docx'

export const MAX_WALK_IN_COUNT = 500
