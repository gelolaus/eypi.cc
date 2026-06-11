<template>
  <main class="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col min-h-[calc(100vh-5rem)]">
    <div class="w-full flex-1">
      <div
        class="mica-card w-full flex-1 rounded-2xl border border-slate-200/50 dark:border-slate-600/50 p-8 shadow-xl"
      >
        <h1 class="font-mono text-2xl font-black uppercase tracking-[0.1em] mb-6" style="color: var(--color-primary);">
          Concessionaire Document Generator
        </h1>
        <form
          @submit.prevent="generateDocuments"
          class="grid grid-cols-1 gap-6 md:grid-cols-2"
        >
          <div>
            <label for="COMPANY_NAME" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Company Name
            </label>
            <input
              id="COMPANY_NAME"
              v-model="formData.COMPANY_NAME"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., Notion @ APC"
            />
          </div>
          <div>
            <label for="COMPANY_ADDRESS" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Company Address
            </label>
            <input
              id="COMPANY_ADDRESS"
              v-model="formData.COMPANY_ADDRESS"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., #3 Humabon Place, Magallanes, Makati City"
            />
          </div>
          <div>
            <label for="COMPANY_REPRESENTATIVE" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Company Representative
            </label>
            <input
              id="COMPANY_REPRESENTATIVE"
              v-model="formData.COMPANY_REPRESENTATIVE"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., Angelo Laus"
            />
          </div>
          <div>
            <label for="COMPANY_REPRESENTATIVE_POSITION" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Representative Position
            </label>
            <input
              id="COMPANY_REPRESENTATIVE_POSITION"
              v-model="formData.COMPANY_REPRESENTATIVE_POSITION"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., Campus Leader"
            />
          </div>
          <div>
            <label for="COMPANY_PHONE" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Company Phone
            </label>
            <input
              id="COMPANY_PHONE"
              v-model="formData.COMPANY_PHONE"
              type="tel"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., +63 912 345 6789"
            />
          </div>
          <div>
            <label for="COMPANY_EMAIL" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Company Email
            </label>
            <input
              id="COMPANY_EMAIL"
              v-model="formData.COMPANY_EMAIL"
              type="email"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., hello@gelolaus.com"
            />
          </div>
          <div>
            <label for="EVENT_NAME" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Event Name
            </label>
            <input
              id="EVENT_NAME"
              v-model="formData.EVENT_NAME"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., SoCIT Fest 2025"
            />
          </div>
          <div>
            <label for="EVENT_DATE" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Event Date
            </label>
            <input
              id="EVENT_DATE"
              v-model="formData.EVENT_DATE"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., March 15, 2025"
            />
          </div>
          <div>
            <label for="EVENT_LOCATION" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Event Location
            </label>
            <input
              id="EVENT_LOCATION"
              v-model="formData.EVENT_LOCATION"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., 12/F Auditorium, 7/F Library Lobby"
            />
          </div>
          <div>
            <label for="DEADLINE_DATE" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Deadline Date
            </label>
            <input
              id="DEADLINE_DATE"
              v-model="formData.DEADLINE_DATE"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., March 1, 2025"
            />
          </div>
          <div>
            <label for="ORGANIZATION_NAME" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Organization Name
            </label>
            <input
              id="ORGANIZATION_NAME"
              v-model="formData.ORGANIZATION_NAME"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., Junior Philippine Computer Society"
            />
          </div>
          <div>
            <label for="ORGANIZATION_ADVISER" class="mb-1.5 block font-mono text-xs font-bold uppercase tracking-[0.05em]" style="color: var(--color-text-muted);">
              Organization Adviser
            </label>
            <input
              id="ORGANIZATION_ADVISER"
              v-model="formData.ORGANIZATION_ADVISER"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm transition-colors focus:border-[#34418F] focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., Roselle Wednesday Gardon"
            />
          </div>
          <div class="md:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              :disabled="isGenerating"
              class="flex items-center gap-2 rounded-xl bg-apc-gold px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white shadow-md transition-all hover:brightness-110 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-eypi-gold-dark dark:hover:bg-eypi-gold-hover"
            >
              <svg
                v-if="isGenerating"
                class="h-4 w-4 animate-spin"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 12 12 12v4a8 8 0 01-8 8z"
                />
              </svg>
              {{ isGenerating ? 'GENERATING...' : 'GENERATE CONTRACTS' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { saveAs } from 'file-saver'

const formData = reactive({
  COMPANY_NAME: '',
  COMPANY_ADDRESS: '',
  COMPANY_REPRESENTATIVE: '',
  COMPANY_PHONE: '',
  COMPANY_EMAIL: '',
  COMPANY_REPRESENTATIVE_POSITION: '',
  EVENT_NAME: '',
  EVENT_DATE: '',
  EVENT_LOCATION: '',
  DEADLINE_DATE: '',
  ORGANIZATION_NAME: '',
  ORGANIZATION_ADVISER: '',
})

const isGenerating = ref(false)

const TEMPLATES = [
  'concessionaire_reply_form.docx',
  'memorandum_of_agreement.docx',
  'terms_and_conditions.docx',
  'waiver_form.docx',
  'products_and_equipments.docx',
] as const

const OUTPUT_NAMES = [
  'Concessionaire_Reply_Form.docx',
  'Memorandum_of_Agreement.docx',
  'Terms_and_Conditions.docx',
  'Waiver_Form.docx',
  'Products_and_Equipments.docx',
] as const

function sanitizeZipFilename(name: string): string {
  const sanitized = name
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
  return sanitized ? `${sanitized}_Documents.zip` : 'Concessionaire_Documents.zip'
}

async function generateDocuments() {
  isGenerating.value = true
  try {
    const responses = await Promise.all(
      TEMPLATES.map((name) => fetch(`/forms/templates/${name}`))
    )
    const buffers = await Promise.all(
      responses.map((r) => {
        if (!r.ok) throw new Error(`Failed to fetch: ${r.url}`)
        return r.arrayBuffer()
      })
    )

    const masterZip = new PizZip()

    for (let i = 0; i < 4; i++) {
      const zip = new PizZip(buffers[i])
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      })
      doc.render(formData)
      const out = doc.getZip().generate({ type: 'uint8array' })
      masterZip.file(OUTPUT_NAMES[i], out)
    }

    const productsBuffer = new Uint8Array(buffers[4])
    masterZip.file(OUTPUT_NAMES[4], productsBuffer)

    const zipBlob = masterZip.generate({ type: 'blob' })
    saveAs(zipBlob, sanitizeZipFilename(formData.COMPANY_NAME))

    formData.COMPANY_NAME = ''
    formData.COMPANY_ADDRESS = ''
    formData.COMPANY_REPRESENTATIVE = ''
    formData.COMPANY_REPRESENTATIVE_POSITION = ''
    formData.COMPANY_PHONE = ''
    formData.COMPANY_EMAIL = ''
  } catch (e) {
    console.error(e)
    alert('Failed to generate documents. Check console for details.')
  } finally {
    isGenerating.value = false
  }
}
</script>
