<template>
  <main class="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
    <header class="mb-6">
      <h1 class="font-display text-3xl font-bold text-g-text">Visitors Pass</h1>
      <p class="mt-2 text-g-muted">Generate a visitors pass from a CSV list of names.</p>
    </header>

    <Card>
      <form class="grid grid-cols-1 gap-5 md:grid-cols-2" @submit.prevent="generateDocument">
        <div>
          <label for="submissionDate" class="mb-1.5 block text-sm font-medium text-g-muted">Submission Date</label>
          <input id="submissionDate" v-model="formData.submissionDate" type="text" :class="fieldClasses()" placeholder="e.g., December 31, 2025" />
        </div>
        <div>
          <label for="orgName" class="mb-1.5 block text-sm font-medium text-g-muted">Organization Name</label>
          <input id="orgName" v-model="formData.orgName" type="text" :class="fieldClasses()" placeholder="e.g., Junior Philippine Computer Society" />
        </div>
        <div>
          <label for="eventName" class="mb-1.5 block text-sm font-medium text-g-muted">Event Name</label>
          <input id="eventName" v-model="formData.eventName" type="text" :class="fieldClasses()" placeholder="e.g., SoCIT Fest 2025" />
        </div>
        <div>
          <label for="eventDate" class="mb-1.5 block text-sm font-medium text-g-muted">Event Date</label>
          <input id="eventDate" v-model="formData.eventDate" type="text" :class="fieldClasses()" placeholder="e.g., March 21, 2026 at 10:00 AM - 10:00 PM" />
        </div>
        <div>
          <label for="eventLocation" class="mb-1.5 block text-sm font-medium text-g-muted">Event Location</label>
          <input id="eventLocation" v-model="formData.eventLocation" type="text" :class="fieldClasses()" placeholder="e.g., 12/F Auditorium" />
        </div>
        <div>
          <label for="repName" class="mb-1.5 block text-sm font-medium text-g-muted">Organization Representative Name</label>
          <input id="repName" v-model="formData.repName" type="text" :class="fieldClasses()" placeholder="e.g., Angelo Laus" />
        </div>
        <div>
          <label for="repPosition" class="mb-1.5 block text-sm font-medium text-g-muted">Organization Representative Position</label>
          <input id="repPosition" v-model="formData.repPosition" type="text" :class="fieldClasses()" placeholder="e.g., Director of External Relations" />
        </div>
        <div>
          <label for="repNumber" class="mb-1.5 block text-sm font-medium text-g-muted">Organization Representative Number</label>
          <input id="repNumber" v-model="formData.repNumber" type="tel" :class="fieldClasses()" placeholder="e.g., (+63) 912 345 6789" />
        </div>
        <div>
          <label for="walkInCount" class="mb-1.5 block text-sm font-medium text-g-muted">Walk-in Slots (Blank Lines)</label>
          <input id="walkInCount" v-model="formData.walkInCount" type="number" min="0" :class="fieldClasses()" placeholder="e.g., 10" />
        </div>

        <div class="md:col-span-2">
          <label class="mb-1.5 block text-sm font-medium text-g-muted">Visitors List (CSV)</label>
          <label
            for="csvFile"
            class="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-g-border bg-g-bg px-4 py-8 transition-colors hover:border-g-primary"
          >
            <svg class="mb-2 h-8 w-8 text-g-muted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span v-if="!csvFileName" class="text-sm text-g-muted">Click to upload a .csv file</span>
            <span v-else class="text-sm text-g-text">
              {{ csvFileName }}
              <span class="text-g-muted">&mdash; {{ parsedNames.length }} name(s)</span>
            </span>
            <input id="csvFile" type="file" accept=".csv" class="hidden" @change="onFileChange" />
          </label>
        </div>

        <div class="flex justify-end pt-2 md:col-span-2">
          <Button type="submit" :disabled="isGenerating" className="w-full sm:w-auto">
            <svg
              v-if="isGenerating"
              class="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {{ isGenerating ? 'Generating…' : 'Generate document' }}
          </Button>
        </div>
      </form>
    </Card>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { saveAs } from 'file-saver'
import { API_BASE_URL } from '@/config/api'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import { fieldClasses } from '@/lib/ui/fieldClasses'

const { authHeaders } = useAuth()
const toast = useToast()
const dialog = useDialog()

const formData = reactive({
  submissionDate: '',
  orgName: '',
  eventName: '',
  eventDate: '',
  eventLocation: '',
  repName: '',
  repPosition: '',
  repNumber: '',
  walkInCount: 0,
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

function chunkIntoPairs(names: string[]) {
  const rows: { col1: string; col2: string }[] = []
  const totalNames = names.length
  const numRows = Math.ceil(totalNames / 2)

  for (let i = 0; i < numRows; i++) {
    const leftIndex = i
    const rightIndex = i + numRows

    rows.push({
      col1: names[leftIndex] ? `${leftIndex + 1}. ${names[leftIndex]}` : '',
      col2: names[rightIndex] ? `${rightIndex + 1}. ${names[rightIndex]}` : '',
    })
  }
  return rows
}

async function generateDocument() {
  isGenerating.value = true
  try {
    const response = await fetch(`${API_BASE_URL}/api/forms/templates/visitors_pass.docx`, {
      headers: authHeaders(),
    })
    if (!response.ok) throw new Error(`Failed to fetch template: ${response.url}`)
    const buffer = await response.arrayBuffer()

    const zip = new PizZip(buffer)
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    })

    const finalNames = [...parsedNames.value]
    const extraSlots = Number(formData.walkInCount) || 0
    for (let i = 0; i < extraSlots; i++) {
      finalNames.push('_________________________')
    }

    doc.render({
      SUBMISSION_DATE: formData.submissionDate,
      ORGANIZATION_NAME: formData.orgName,
      EVENT_NAME: formData.eventName,
      EVENT_DATE: formData.eventDate,
      EVENT_LOCATION: formData.eventLocation,
      ORGANIZATION_REPRESENTATIVE: formData.repName,
      ORGANIZATION_REPRESENTATIVE_POSITION: formData.repPosition,
      ORGANIZATION_REPRESENTATIVE_NUMBER: formData.repNumber,
      visitors: chunkIntoPairs(finalNames),
    })

    const out = doc.getZip().generate({ type: 'blob' })
    saveAs(out, 'Visitors_Pass.docx')

    formData.submissionDate = ''
    formData.orgName = ''
    formData.eventName = ''
    formData.eventDate = ''
    formData.eventLocation = ''
    formData.repName = ''
    formData.repPosition = ''
    formData.walkInCount = 0
    csvFileName.value = ''
    parsedNames.value = []

    await dialog.info({
      title: 'Visitor pass generated',
      body: 'Your visitor pass is ready in the downloaded document.',
    })
  } catch (e) {
    console.error(e)
    toast.error('Could not generate the visitor pass. Check the form and try again.')
  } finally {
    isGenerating.value = false
  }
}
</script>
