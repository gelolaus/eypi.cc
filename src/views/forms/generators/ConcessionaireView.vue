<template>
  <AppPage title="Concessionaire Document Generator">
    <AppSection>
        <form
          class="grid grid-cols-1 gap-6 md:grid-cols-2"
          novalidate
          @submit.prevent="generateDocuments"
        >
          <div>
            <label for="COMPANY_NAME" class="mb-1.5 block text-sm font-medium text-g-muted">
              Company Name
            </label>
            <input
              id="COMPANY_NAME"
              v-model="formData.COMPANY_NAME"
              type="text"
              :aria-invalid="Boolean(errors.COMPANY_NAME)"
              :aria-describedby="errors.COMPANY_NAME ? 'COMPANY_NAME-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., Notion @ APC"
            >
            <p
              v-if="errors.COMPANY_NAME"
              id="COMPANY_NAME-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.COMPANY_NAME }}
            </p>
          </div>
          <div>
            <label for="COMPANY_ADDRESS" class="mb-1.5 block text-sm font-medium text-g-muted">
              Company Address
            </label>
            <input
              id="COMPANY_ADDRESS"
              v-model="formData.COMPANY_ADDRESS"
              type="text"
              :aria-invalid="Boolean(errors.COMPANY_ADDRESS)"
              :aria-describedby="errors.COMPANY_ADDRESS ? 'COMPANY_ADDRESS-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., #3 Humabon Place, Magallanes, Makati City"
            >
            <p
              v-if="errors.COMPANY_ADDRESS"
              id="COMPANY_ADDRESS-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.COMPANY_ADDRESS }}
            </p>
          </div>
          <div>
            <label for="COMPANY_REPRESENTATIVE" class="mb-1.5 block text-sm font-medium text-g-muted">
              Company Representative
            </label>
            <input
              id="COMPANY_REPRESENTATIVE"
              v-model="formData.COMPANY_REPRESENTATIVE"
              type="text"
              :aria-invalid="Boolean(errors.COMPANY_REPRESENTATIVE)"
              :aria-describedby="errors.COMPANY_REPRESENTATIVE ? 'COMPANY_REPRESENTATIVE-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., Angelo Laus"
            >
            <p
              v-if="errors.COMPANY_REPRESENTATIVE"
              id="COMPANY_REPRESENTATIVE-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.COMPANY_REPRESENTATIVE }}
            </p>
          </div>
          <div>
            <label for="COMPANY_REPRESENTATIVE_POSITION" class="mb-1.5 block text-sm font-medium text-g-muted">
              Representative Position
            </label>
            <input
              id="COMPANY_REPRESENTATIVE_POSITION"
              v-model="formData.COMPANY_REPRESENTATIVE_POSITION"
              type="text"
              :aria-invalid="Boolean(errors.COMPANY_REPRESENTATIVE_POSITION)"
              :aria-describedby="errors.COMPANY_REPRESENTATIVE_POSITION ? 'COMPANY_REPRESENTATIVE_POSITION-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., Campus Leader"
            >
            <p
              v-if="errors.COMPANY_REPRESENTATIVE_POSITION"
              id="COMPANY_REPRESENTATIVE_POSITION-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.COMPANY_REPRESENTATIVE_POSITION }}
            </p>
          </div>
          <div>
            <label for="COMPANY_PHONE" class="mb-1.5 block text-sm font-medium text-g-muted">
              Company Phone
            </label>
            <input
              id="COMPANY_PHONE"
              v-model="formData.COMPANY_PHONE"
              type="tel"
              :aria-invalid="Boolean(errors.COMPANY_PHONE)"
              :aria-describedby="errors.COMPANY_PHONE ? 'COMPANY_PHONE-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., +63 912 345 6789"
            >
            <p
              v-if="errors.COMPANY_PHONE"
              id="COMPANY_PHONE-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.COMPANY_PHONE }}
            </p>
          </div>
          <div>
            <label for="COMPANY_EMAIL" class="mb-1.5 block text-sm font-medium text-g-muted">
              Company Email
            </label>
            <input
              id="COMPANY_EMAIL"
              v-model="formData.COMPANY_EMAIL"
              type="email"
              :aria-invalid="Boolean(errors.COMPANY_EMAIL)"
              :aria-describedby="errors.COMPANY_EMAIL ? 'COMPANY_EMAIL-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., hello@gelolaus.com"
            >
            <p
              v-if="errors.COMPANY_EMAIL"
              id="COMPANY_EMAIL-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.COMPANY_EMAIL }}
            </p>
          </div>
          <div>
            <label for="EVENT_NAME" class="mb-1.5 block text-sm font-medium text-g-muted">
              Event Name
            </label>
            <input
              id="EVENT_NAME"
              v-model="formData.EVENT_NAME"
              type="text"
              :aria-invalid="Boolean(errors.EVENT_NAME)"
              :aria-describedby="errors.EVENT_NAME ? 'EVENT_NAME-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., SoCIT Fest 2025"
            >
            <p
              v-if="errors.EVENT_NAME"
              id="EVENT_NAME-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.EVENT_NAME }}
            </p>
          </div>
          <div>
            <label for="EVENT_DATE" class="mb-1.5 block text-sm font-medium text-g-muted">
              Event Date
            </label>
            <input
              id="EVENT_DATE"
              v-model="formData.EVENT_DATE"
              type="text"
              :aria-invalid="Boolean(errors.EVENT_DATE)"
              :aria-describedby="errors.EVENT_DATE ? 'EVENT_DATE-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., March 15, 2025"
            >
            <p
              v-if="errors.EVENT_DATE"
              id="EVENT_DATE-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.EVENT_DATE }}
            </p>
          </div>
          <div>
            <label for="EVENT_LOCATION" class="mb-1.5 block text-sm font-medium text-g-muted">
              Event Location
            </label>
            <input
              id="EVENT_LOCATION"
              v-model="formData.EVENT_LOCATION"
              type="text"
              :aria-invalid="Boolean(errors.EVENT_LOCATION)"
              :aria-describedby="errors.EVENT_LOCATION ? 'EVENT_LOCATION-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., 12/F Auditorium, 7/F Library Lobby"
            >
            <p
              v-if="errors.EVENT_LOCATION"
              id="EVENT_LOCATION-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.EVENT_LOCATION }}
            </p>
          </div>
          <div>
            <label for="DEADLINE_DATE" class="mb-1.5 block text-sm font-medium text-g-muted">
              Deadline Date
            </label>
            <input
              id="DEADLINE_DATE"
              v-model="formData.DEADLINE_DATE"
              type="text"
              :aria-invalid="Boolean(errors.DEADLINE_DATE)"
              :aria-describedby="errors.DEADLINE_DATE ? 'DEADLINE_DATE-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., March 1, 2025"
            >
            <p
              v-if="errors.DEADLINE_DATE"
              id="DEADLINE_DATE-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.DEADLINE_DATE }}
            </p>
          </div>
          <div>
            <label for="ORGANIZATION_NAME" class="mb-1.5 block text-sm font-medium text-g-muted">
              Organization Name
            </label>
            <input
              id="ORGANIZATION_NAME"
              v-model="formData.ORGANIZATION_NAME"
              type="text"
              :aria-invalid="Boolean(errors.ORGANIZATION_NAME)"
              :aria-describedby="errors.ORGANIZATION_NAME ? 'ORGANIZATION_NAME-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., Junior Philippine Computer Society"
            >
            <p
              v-if="errors.ORGANIZATION_NAME"
              id="ORGANIZATION_NAME-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.ORGANIZATION_NAME }}
            </p>
          </div>
          <div>
            <label for="ORGANIZATION_ADVISER" class="mb-1.5 block text-sm font-medium text-g-muted">
              Organization Adviser
            </label>
            <input
              id="ORGANIZATION_ADVISER"
              v-model="formData.ORGANIZATION_ADVISER"
              type="text"
              :aria-invalid="Boolean(errors.ORGANIZATION_ADVISER)"
              :aria-describedby="errors.ORGANIZATION_ADVISER ? 'ORGANIZATION_ADVISER-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., Roselle Wednesday Gardon"
            >
            <p
              v-if="errors.ORGANIZATION_ADVISER"
              id="ORGANIZATION_ADVISER-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.ORGANIZATION_ADVISER }}
            </p>
          </div>
          <div class="md:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              :disabled="isGenerating"
              class="btn-gold flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold shadow-md transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {{ isGenerating ? 'GENERATING...' : 'GENERATE CONTRACTS' }}
            </button>
          </div>
        </form>
    </AppSection>
  </AppPage>
</template>

<script setup lang="ts">
import AppPage from '@/components/AppPage.vue'
import AppSection from '@/components/AppSection.vue'
import { useDialog } from '@/composables/useDialog'
import {
  concessionaireZipName,
  fetchFormTemplate,
  generatorErrorMessage,
  renderDocx,
  requiredError,
  saveBlob,
  useDocxGenerator,
  zipBlob,
} from '@/composables/useDocxGenerator'
import { useToast } from '@/composables/useToast'
import { CONCESSIONAIRE_TEMPLATES } from '@shared/formsCatalog'
import { reactive } from 'vue'

const fieldClass = 'w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-base transition-colors sm:text-sm focus:border-g-accent focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200'

const toast = useToast()
const dialog = useDialog()
const { isGenerating, run } = useDocxGenerator()

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

const errors = reactive({
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

const labels = {
  COMPANY_NAME: 'Company name',
  COMPANY_ADDRESS: 'Company address',
  COMPANY_REPRESENTATIVE: 'Company representative',
  COMPANY_PHONE: 'Company phone',
  COMPANY_EMAIL: 'Company email',
  COMPANY_REPRESENTATIVE_POSITION: 'Representative position',
  EVENT_NAME: 'Event name',
  EVENT_DATE: 'Event date',
  EVENT_LOCATION: 'Event location',
  DEADLINE_DATE: 'Deadline date',
  ORGANIZATION_NAME: 'Organization name',
  ORGANIZATION_ADVISER: 'Organization adviser',
} as const

function validate(): boolean {
  for (const key of Object.keys(labels) as (keyof typeof labels)[]) {
    errors[key] = requiredError(formData[key], labels[key]) ?? ''
  }
  return Object.values(errors).every((message) => message === '')
}

function reset() {
  for (const key of Object.keys(formData) as (keyof typeof formData)[]) formData[key] = ''
  for (const key of Object.keys(errors) as (keyof typeof errors)[]) errors[key] = ''
}

async function generateDocuments() {
  if (!validate()) return
  try {
    await run(async () => {
      const loaded = await Promise.all(CONCESSIONAIRE_TEMPLATES.map(async (template) => ({
        template,
        bytes: await fetchFormTemplate(template.file),
      })))
      const entries = loaded.map(({ template, bytes }) => ({
        name: template.output,
        data: template.fill ? renderDocx(bytes, { ...formData }) : new Uint8Array(bytes),
      }))
      saveBlob(zipBlob(entries), concessionaireZipName(formData.COMPANY_NAME))
      reset()
      await dialog.info({
        title: 'Documents generated',
        body: 'Your concessionaire documents are ready in the downloaded ZIP.',
      })
    })
  } catch (err) {
    console.error(err)
    toast.error(generatorErrorMessage(err, 'Could not generate the documents. Check the form and try again.'))
  }
}
</script>
