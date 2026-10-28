<template>
  <AppPage title="Letter of Intent &amp; Waiver Generator">
    <AppSection>
      <form
        class="grid grid-cols-1 gap-6 md:grid-cols-2"
        novalidate
        @submit.prevent="generateDocuments"
      >
        <div class="space-y-1.5">
          <Label for="submissionDate">Submission Date</Label>
          <Input
            id="submissionDate"
            v-model="formData.submissionDate"
            type="text"
            :aria-invalid="Boolean(errors.submissionDate)"
            :aria-describedby="errors.submissionDate ? 'submissionDate-error' : undefined"
            placeholder="e.g., March 17, 2026"
          />
          <p
            v-if="errors.submissionDate"
            id="submissionDate-error"
            role="alert"
            class="mt-1 text-sm text-destructive"
          >
            {{ errors.submissionDate }}
          </p>
        </div>
        <div class="space-y-1.5">
          <Label for="eventName">Event Name</Label>
          <Input
            id="eventName"
            v-model="formData.eventName"
            type="text"
            :aria-invalid="Boolean(errors.eventName)"
            :aria-describedby="errors.eventName ? 'eventName-error' : undefined"
            placeholder="e.g., SoCIT Fest 2026"
          />
          <p
            v-if="errors.eventName"
            id="eventName-error"
            role="alert"
            class="mt-1 text-sm text-destructive"
          >
            {{ errors.eventName }}
          </p>
        </div>
        <div class="space-y-1.5">
          <Label for="orgName">Organization Name</Label>
          <Input
            id="orgName"
            v-model="formData.orgName"
            type="text"
            :aria-invalid="Boolean(errors.orgName)"
            :aria-describedby="errors.orgName ? 'orgName-error' : undefined"
            placeholder="e.g., Junior Philippine Computer Society"
          />
          <p
            v-if="errors.orgName"
            id="orgName-error"
            role="alert"
            class="mt-1 text-sm text-destructive"
          >
            {{ errors.orgName }}
          </p>
        </div>
        <div class="space-y-1.5">
          <Label for="eventLocation">Event Location</Label>
          <Input
            id="eventLocation"
            v-model="formData.eventLocation"
            type="text"
            :aria-invalid="Boolean(errors.eventLocation)"
            :aria-describedby="errors.eventLocation ? 'eventLocation-error' : undefined"
            placeholder="e.g., 12/F Auditorium"
          />
          <p
            v-if="errors.eventLocation"
            id="eventLocation-error"
            role="alert"
            class="mt-1 text-sm text-destructive"
          >
            {{ errors.eventLocation }}
          </p>
        </div>
        <div class="space-y-1.5">
          <Label for="eventDate">Event Date</Label>
          <Input
            id="eventDate"
            v-model="formData.eventDate"
            type="text"
            :aria-invalid="Boolean(errors.eventDate)"
            :aria-describedby="errors.eventDate ? 'eventDate-error' : undefined"
            placeholder="e.g., March 21, 2026"
          />
          <p
            v-if="errors.eventDate"
            id="eventDate-error"
            role="alert"
            class="mt-1 text-sm text-destructive"
          >
            {{ errors.eventDate }}
          </p>
        </div>

        <div class="md:col-span-2">
          <p class="mb-1.5 text-base font-medium">
            Student Names (CSV)
          </p>
          <label
            for="csvFile"
            class="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-dot-grid px-4 py-8 transition-colors hover:border-ring focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
          >
            <svg
              class="mb-2 h-8 w-8 text-muted-foreground"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <span
              v-if="!csvFileName"
              class="text-sm text-muted-foreground"
            >
              Click to upload a .csv file
            </span>
            <span
              v-else
              class="text-sm text-foreground"
            >
              {{ csvFileName }}
              <span class="text-muted-foreground">· {{ parsedNames.length }} name(s)</span>
            </span>
            <input
              id="csvFile"
              ref="csvInput"
              type="file"
              accept=".csv"
              class="sr-only"
              :aria-invalid="Boolean(errors.csv)"
              :aria-describedby="errors.csv ? 'csvFile-error' : undefined"
              @change="onFileChange"
            >
          </label>
          <p
            v-if="errors.csv"
            id="csvFile-error"
            role="alert"
            class="mt-1 text-sm text-destructive"
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
                  <th
                    scope="col"
                    class="py-1 font-medium text-muted-foreground"
                  >
                    Name
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(name, index) in previewNames"
                  :key="`${index}-${name}`"
                >
                  <td class="py-1 text-foreground">
                    {{ name }}
                  </td>
                </tr>
              </tbody>
            </table>
            <p
              v-if="parsedNames.length > previewNames.length"
              class="mt-1 text-sm text-muted-foreground"
            >
              And {{ parsedNames.length - previewNames.length }} more.
            </p>
          </div>
        </div>

        <div class="md:col-span-2 flex justify-end pt-2">
          <Button
            type="submit"
            :disabled="isGenerating"
            class="w-full font-semibold sm:w-auto"
          >
            {{ isGenerating ? 'GENERATING...' : 'GENERATE BATCH ZIP' }}
          </Button>
        </div>
      </form>
    </AppSection>
  </AppPage>
</template>

<script setup lang="ts">
import AppPage from '@/components/layout/AppPage.vue'
import AppSection from '@/components/layout/AppSection.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
