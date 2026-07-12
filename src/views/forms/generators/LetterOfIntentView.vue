<template>
  <main class="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col min-h-[calc(100vh-5rem)]">
    <div class="w-full flex-1">
      <div
        class="mica-card w-full flex-1 rounded-2xl border border-g-border p-8 shadow-xl"
      >
        <h1 class="text-section-title mb-6">
          Letter of Intent &amp; Waiver Generator
        </h1>
        <form
          @submit.prevent="generateDocuments"
          class="grid grid-cols-1 gap-6 md:grid-cols-2"
        >
          <div>
            <label for="submissionDate" class="mb-1.5 block text-sm font-medium text-g-muted">
              Submission Date
            </label>
            <input
              id="submissionDate"
              v-model="formData.submissionDate"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm transition-colors focus:border-g-accent focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., March 17, 2026"
            />
          </div>
          <div>
            <label for="eventName" class="mb-1.5 block text-sm font-medium text-g-muted">
              Event Name
            </label>
            <input
              id="eventName"
              v-model="formData.eventName"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm transition-colors focus:border-g-accent focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., SoCIT Fest 2026"
            />
          </div>
          <div>
            <label for="orgName" class="mb-1.5 block text-sm font-medium text-g-muted">
              Organization Name
            </label>
            <input
              id="orgName"
              v-model="formData.orgName"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm transition-colors focus:border-g-accent focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., Junior Philippine Computer Society"
            />
          </div>
          <div>
            <label for="eventLocation" class="mb-1.5 block text-sm font-medium text-g-muted">
              Event Location
            </label>
            <input
              id="eventLocation"
              v-model="formData.eventLocation"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm transition-colors focus:border-g-accent focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., 12/F Auditorium"
            />
          </div>
          <div>
            <label for="eventDate" class="mb-1.5 block text-sm font-medium text-g-muted">
              Event Date
            </label>
            <input
              id="eventDate"
              v-model="formData.eventDate"
              type="text"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm transition-colors focus:border-g-accent focus:outline-none dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200"
              placeholder="e.g., March 21, 2026"
            />
          </div>

          <div class="md:col-span-2">
            <label class="mb-1.5 block text-sm font-medium text-g-muted">
              Student Names (CSV)
            </label>
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
                type="file"
                accept=".csv"
                class="hidden"
                @change="onFileChange"
              />
            </label>
          </div>

          <div class="md:col-span-2 flex justify-end pt-2">
            <button
              type="submit"
              :disabled="isGenerating"
              class="flex items-center gap-2 rounded-xl bg-apc-gold px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:brightness-110 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-eypi-gold-dark dark:hover:bg-eypi-gold-hover"
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
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { saveAs } from 'file-saver'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'

const { authHeaders } = useAuth()

const formData = reactive({
  submissionDate: '',
  eventName: '',
  orgName: '',
  eventLocation: '',
  eventDate: '',
})

const isGenerating = ref(false)
const csvFileName = ref('')
const parsedNames = ref<string[]>([])

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  csvFileName.value = file.name
  const reader = new FileReader()
  reader.onload = (e) => {
    const text = e.target?.result as string
    parsedNames.value = text
      .split(/\r?\n/)
      .map((line) => line.split(';')[0].trim())
      .filter((name) => name.length > 0)
  }
  reader.readAsText(file)
}

const formatFilename = (name: string) =>
  name.trim().replace(/\s+/g, '_') + '_LOIW.docx'

async function generateDocuments() {
  if (parsedNames.value.length === 0) {
    alert('Please upload a CSV file with at least one student name.')
    return
  }

  isGenerating.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/forms/templates/letter_of_intent_and_waiver.docx`, {
      headers: authHeaders(),
    })
    if (!response.ok) throw new Error(`Failed to fetch template: ${response.url}`)
    const buffer = await response.arrayBuffer()

    const masterZip = new PizZip()

    for (const name of parsedNames.value) {
      const zip = new PizZip(buffer)
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      })
      doc.render({
        STUDENT_NAME: name,
        SUBMISSION_DATE: formData.submissionDate,
        EVENT_NAME: formData.eventName,
        ORGANIZATION_NAME: formData.orgName,
        EVENT_LOCATION: formData.eventLocation,
        EVENT_DATE: formData.eventDate,
      })
      const out = doc.getZip().generate({ type: 'uint8array' })
      masterZip.file(formatFilename(name), out)
    }

    const zipBlob = masterZip.generate({ type: 'blob' })
    saveAs(zipBlob, 'LOIW_Batch.zip')

    formData.submissionDate = ''
    formData.eventName = ''
    formData.orgName = ''
    formData.eventLocation = ''
    formData.eventDate = ''
    csvFileName.value = ''
    parsedNames.value = []

    alert('Documents generated.')
  } catch (e) {
    console.error(e)
    alert('Failed to generate documents. Check console for details.')
  } finally {
    isGenerating.value = false
  }
}
</script>

