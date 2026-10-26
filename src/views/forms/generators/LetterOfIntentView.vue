<template>
  <AppPage title="Letter of Intent &amp; Waiver Generator">
    <AppSection>
        <form
          class="grid grid-cols-1 gap-6 md:grid-cols-2"
          novalidate
          @submit.prevent="generateDocuments"
        >
          <div>
            <label for="submissionDate" class="mb-1.5 block text-sm font-medium text-g-muted">
              Submission Date
            </label>
            <input
              id="submissionDate"
              v-model="formData.submissionDate"
              type="text"
              :aria-invalid="Boolean(errors.submissionDate)"
              :aria-describedby="errors.submissionDate ? 'submissionDate-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., March 17, 2026"
            >
            <p
              v-if="errors.submissionDate"
              id="submissionDate-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.submissionDate }}
            </p>
          </div>
          <div>
            <label for="eventName" class="mb-1.5 block text-sm font-medium text-g-muted">
              Event Name
            </label>
            <input
              id="eventName"
              v-model="formData.eventName"
              type="text"
              :aria-invalid="Boolean(errors.eventName)"
              :aria-describedby="errors.eventName ? 'eventName-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., SoCIT Fest 2026"
            >
            <p
              v-if="errors.eventName"
              id="eventName-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.eventName }}
            </p>
          </div>
          <div>
            <label for="orgName" class="mb-1.5 block text-sm font-medium text-g-muted">
              Organization Name
            </label>
            <input
              id="orgName"
              v-model="formData.orgName"
              type="text"
              :aria-invalid="Boolean(errors.orgName)"
              :aria-describedby="errors.orgName ? 'orgName-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., Junior Philippine Computer Society"
            >
            <p
              v-if="errors.orgName"
              id="orgName-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.orgName }}
            </p>
          </div>
          <div>
            <label for="eventLocation" class="mb-1.5 block text-sm font-medium text-g-muted">
              Event Location
            </label>
            <input
              id="eventLocation"
              v-model="formData.eventLocation"
              type="text"
              :aria-invalid="Boolean(errors.eventLocation)"
              :aria-describedby="errors.eventLocation ? 'eventLocation-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., 12/F Auditorium"
            >
            <p
              v-if="errors.eventLocation"
              id="eventLocation-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.eventLocation }}
            </p>
          </div>
          <div>
            <label for="eventDate" class="mb-1.5 block text-sm font-medium text-g-muted">
              Event Date
            </label>
            <input
              id="eventDate"
              v-model="formData.eventDate"
              type="text"
              :aria-invalid="Boolean(errors.eventDate)"
              :aria-describedby="errors.eventDate ? 'eventDate-error' : undefined"
              :class="fieldClass"
              placeholder="e.g., March 21, 2026"
            >
            <p
              v-if="errors.eventDate"
              id="eventDate-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.eventDate }}
            </p>
          </div>

          <div class="md:col-span-2">
            <p class="mb-1.5 block text-sm font-medium text-g-muted">
              Student Names (CSV)
            </p>
            <label
              for="csvFile"
              class="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white/80 px-4 py-8 transition-colors hover:border-g-accent dark:border-slate-600 dark:bg-mica-navy-input dark:hover:border-g-accent"
            >
              <svg class="mb-2 h-8 w-8 text-slate-400 dark:text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span v-if="!csvFileName" class="text-sm text-slate-500 dark:text-slate-400">
                Click to upload a .csv file
              </span>
              <span v-else class="text-sm text-g-text dark:text-slate-200">
                {{ csvFileName }}
                <span class="text-slate-400 dark:text-slate-500">&mdash; {{ parsedNames.length }} name(s)</span>
              </span>
              <input
                id="csvFile"
                ref="csvInput"
                type="file"
                accept=".csv"
                class="hidden"
                :aria-invalid="Boolean(errors.csv)"
                :aria-describedby="errors.csv ? 'csvFile-error' : undefined"
                @change="onFileChange"
              >
            </label>
            <p
              v-if="errors.csv"
              id="csvFile-error"
              role="alert"
              class="mt-1 text-sm text-red-500"
            >
              {{ errors.csv }}
            </p>
            <div
              v-if="previewNames.length"
              class="mt-4 overflow-x-auto"
            >
              <table class="w-full text-left text-sm">
                <caption class="sr-only">
                  Parsed names
                </caption>
                <thead>
                  <tr>
                    <th scope="col" class="py-1 font-medium text-g-muted">
                      Name
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(name, index) in previewNames"
                    :key="`${index}-${name}`"
                  >
                    <td class="py-1 text-g-text">
                      {{ name }}
                    </td>
                  </tr>
                </tbody>
              </table>
              <p
                v-if="parsedNames.length > previewNames.length"
                class="mt-1 text-sm text-g-muted"
              >
                And {{ parsedNames.length - previewNames.length }} more.
              </p>
            </div>
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
              {{ isGenerating ? 'GENERATING...' : 'GENERATE BATCH ZIP' }}
            </button>
          </div>
        </form>
    </AppSection>
  </AppPage>
</template>

<script setup lang="ts">
import AppPage from '@/components/layout/AppPage.vue'
import AppSection from '@/components/layout/AppSection.vue'
import { useDialog } from '@/composables/useDialog'
import {
  fetchFormTemplate,
  generatorErrorMessage,
  letterEntryName,
  parseNameCsv,
  renderDocx,
  requiredError,
  saveBlob,
  uniqueFilenameStems,
  useDocxGenerator,
  zipBlob,
} from '@/composables/useDocxGenerator'
import { useToast } from '@/composables/useToast'
import { LETTER_TEMPLATE, LETTER_ZIP_NAME } from '@shared/formsCatalog'
import { computed, reactive, ref } from 'vue'

const fieldClass = 'w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-base transition-colors sm:text-sm focus:border-g-accent focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200'

const toast = useToast()
const dialog = useDialog()
const { isGenerating, run } = useDocxGenerator()

const formData = reactive({
  submissionDate: '',
  eventName: '',
  orgName: '',
  eventLocation: '',
  eventDate: '',
})

const errors = reactive({
  submissionDate: '',
  eventName: '',
  orgName: '',
  eventLocation: '',
  eventDate: '',
  csv: '',
})

const csvInput = ref<HTMLInputElement | null>(null)
const csvFileName = ref('')
const parsedNames = ref<string[]>([])
const previewNames = computed(() => parsedNames.value.slice(0, 8))

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  csvFileName.value = file.name
  errors.csv = ''
  const reader = new FileReader()
  reader.onload = () => {
    parsedNames.value = parseNameCsv(String(reader.result ?? ''))
  }
  reader.readAsText(file)
}

function validate(): boolean {
  errors.submissionDate = requiredError(formData.submissionDate, 'Submission date') ?? ''
  errors.eventName = requiredError(formData.eventName, 'Event name') ?? ''
  errors.orgName = requiredError(formData.orgName, 'Organization name') ?? ''
  errors.eventLocation = requiredError(formData.eventLocation, 'Event location') ?? ''
  errors.eventDate = requiredError(formData.eventDate, 'Event date') ?? ''
  errors.csv = parsedNames.value.length ? '' : 'Upload a CSV file with at least one student name.'
  return Object.values(errors).every((message) => message === '')
}

function reset() {
  formData.submissionDate = ''
  formData.eventName = ''
  formData.orgName = ''
  formData.eventLocation = ''
  formData.eventDate = ''
  csvFileName.value = ''
  parsedNames.value = []
  if (csvInput.value) csvInput.value.value = ''
  for (const key of Object.keys(errors) as (keyof typeof errors)[]) errors[key] = ''
}

async function generateDocuments() {
  if (!validate()) return
  try {
    await run(async () => {
      const buffer = await fetchFormTemplate(LETTER_TEMPLATE)
      const stems = uniqueFilenameStems(parsedNames.value)
      const entries = parsedNames.value.map((name, index) => ({
        name: letterEntryName(stems[index] ?? 'document'),
        data: renderDocx(buffer, {
          STUDENT_NAME: name,
          SUBMISSION_DATE: formData.submissionDate,
          EVENT_NAME: formData.eventName,
          ORGANIZATION_NAME: formData.orgName,
          EVENT_LOCATION: formData.eventLocation,
          EVENT_DATE: formData.eventDate,
        }),
      }))
      saveBlob(zipBlob(entries), LETTER_ZIP_NAME)
      reset()
      await dialog.info({
        title: 'Documents generated',
        body: 'Your letter of intent and waiver files are ready in the downloaded ZIP.',
      })
    })
  } catch (err) {
    console.error(err)
    toast.error(generatorErrorMessage(err, 'Could not generate the documents. Check the form and try again.'))
  }
}
</script>
