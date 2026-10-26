<template>
  <div class="relative w-full">
    <AppPage
      title="New Event"
      description="Details & attendee CSV"
    >
      <div class="mx-auto w-full max-w-xl">
        <!-- Success state -->
        <Card
          v-if="done"
          class="gap-0 rounded-3xl p-5 text-center sm:p-8"
        >
          <p class="mb-2 text-sm font-medium text-primary">
            Event Created
          </p>
          <h2 class="mb-4 font-mono text-xl font-bold text-foreground">
            {{ form.name }}
          </h2>
          <p class="mb-6 font-mono text-xs text-muted-foreground">
            QR ZIP downloaded. Share tickets manually with your attendees.
          </p>
          <Button
            as-child
            size="lg"
            class="mx-auto"
          >
            <router-link :to="`/manage/tix/${form.slug}`">
              Go to Event →
            </router-link>
          </Button>
        </Card>

        <!-- Form -->
        <Card
          v-else
          class="gap-0 rounded-3xl p-5 sm:p-8"
        >
          <!-- Mode toggle -->
          <div class="mb-6 flex gap-1 rounded-xl border border-border bg-muted p-1">
            <Button
              type="button"
              :variant="!useSelectionMode ? 'default' : 'ghost'"
              class="flex-1 text-sm font-semibold"
              @click="useSelectionMode = false"
            >
              Simple CSV Upload
            </Button>
            <Button
              type="button"
              :variant="useSelectionMode ? 'default' : 'ghost'"
              class="flex-1 text-sm font-semibold"
              @click="useSelectionMode = true"
            >
              Attendee Selection
            </Button>
          </div>

          <form
            class="flex flex-col gap-4"
            @submit.prevent="submit"
          >
            <!-- Event Name -->
            <div class="space-y-1.5">
              <Label for="event-name">Event Name</Label>
              <Input
                id="event-name"
                v-model="form.name"
                type="text"
                placeholder="e.g. JPCS General Assembly"
                required
                class="font-mono"
              />
            </div>

            <!-- Slug -->
            <div class="space-y-1.5">
              <Label for="event-slug">Link Slug</Label>
              <div class="flex h-11 min-w-0 items-center rounded-xl border border-input bg-transparent px-3.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
                <span class="mr-0.5 shrink-0 font-mono text-sm font-bold text-foreground">eypi.cc/tix/</span>
                <input
                  id="event-slug"
                  v-model="form.slug"
                  type="text"
                  placeholder="bwai2026"
                  required
                  class="min-w-0 flex-1 bg-transparent font-mono text-base text-foreground outline-none placeholder:text-muted-foreground"
                  @input="sanitizeSlug"
                >
              </div>
              <p class="text-xs font-medium text-muted-foreground">
                Lowercase letters and numbers only — no spaces, hyphens, or special characters.
              </p>
            </div>

            <!-- Date + Time -->
            <div class="flex flex-col gap-4 md:flex-row">
              <div class="flex-1 space-y-1.5">
                <Label for="event-date">Date</Label>
                <Input
                  id="event-date"
                  v-model="form.date"
                  type="date"
                  required
                  class="font-mono"
                />
              </div>
              <div class="flex-1 space-y-1.5">
                <Label for="event-time">Time</Label>
                <Input
                  id="event-time"
                  v-model="form.time"
                  type="time"
                  required
                  class="font-mono"
                />
              </div>
            </div>

            <!-- Location -->
            <div class="space-y-1.5">
              <Label for="event-location">Location</Label>
              <Input
                id="event-location"
                v-model="form.location"
                type="text"
                placeholder="e.g. APC Auditorium"
                required
                class="font-mono"
              />
            </div>

            <!-- CSV Upload (simple mode only) -->
            <div v-if="!useSelectionMode">
              <p class="mb-1.5 block text-sm font-semibold text-foreground">
                Attendee CSV
              </p>
              <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -- file drop target; keyboard users use Browse -->
              <div
                class="flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors"
                :class="csvFile
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-ring'"
                :aria-invalid="Boolean(csvError)"
                :aria-describedby="csvError ? 'csv-error' : undefined"
                @dragover.prevent
                @drop.prevent="onDrop"
              >
                <p
                  v-if="csvFile"
                  class="text-sm font-medium text-primary"
                >
                  {{ csvFile.name }} — {{ parsedAttendees.length }} attendees
                </p>
                <template v-else>
                  <p class="text-sm text-muted-foreground">
                    Drop CSV or click to upload
                  </p>
                  <p class="mt-2 font-mono text-xs text-muted-foreground">
                    Headers: first_name, last_name, email
                  </p>
                </template>
                <input
                  ref="fileInput"
                  type="file"
                  accept=".csv"
                  class="hidden"
                  aria-hidden="true"
                  tabindex="-1"
                  @change="onFileChange"
                >
                <Button
                  type="button"
                  variant="outline"
                  class="mt-3"
                  @click="fileInput?.click()"
                >
                  {{ csvFile ? 'Change file' : 'Browse' }}
                </Button>
              </div>
              <p
                v-if="csvError"
                id="csv-error"
                class="mt-1 font-mono text-xs uppercase tracking-wide text-destructive"
              >
                {{ csvError }}
              </p>
            </div>

            <!-- Selection mode info + max attendees -->
            <div
              v-else
              class="space-y-1.5 rounded-xl border border-border bg-muted px-4 py-4"
            >
              <p class="mb-3 font-mono text-xs text-muted-foreground">
                You'll upload the CSV and configure clusters &amp; criteria on the next page.
              </p>
              <Label for="event-max-attendees">Max Attendees <span class="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="event-max-attendees"
                v-model.number="maxAttendeesValue"
                type="number"
                min="1"
                placeholder="Leave blank for no limit"
                class="font-mono"
              />
              <p class="font-mono text-xs uppercase tracking-wide text-muted-foreground">
                This can be overridden when you configure clusters.
              </p>
            </div>

            <!-- Submit -->
            <Button
              type="submit"
              size="lg"
              class="mt-2 w-full"
              :class="loading ? 'animate-pulse' : ''"
              :disabled="loading"
            >
              {{ loadingLabel }}
            </Button>
          </form>
        </Card>
      </div>
    </AppPage>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AppPage from '@/components/layout/AppPage.vue'
import { api } from '@/lib/api'
import { ref, computed, watch } from 'vue'
import { useToast } from '@/composables/useToast'
import { TIX_QR_RENDER_OPTIONS } from '@/utils/tix-qr'
import { parseAttendeeCsv } from '@/lib/tix/spreadsheet'
import { useRouter } from 'vue-router'

const toast = useToast()
const router = useRouter()

// ── mode ──────────────────────────────────────────────────────────────────────
const useSelectionMode  = ref(false)
const maxAttendeesValue = ref<number | null>(null)

// ── form state ────────────────────────────────────────────────────────────────
const form = ref({ name: '', slug: '', date: '', time: '', location: '' })
const csvFile = ref<File | null>(null)
const csvError = ref('')
watch(useSelectionMode, () => { csvError.value = '' })
const fileInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const loadingLabel = computed(() =>
  loading.value
    ? (useSelectionMode.value ? 'Creating event...' : loadingLabelDynamic.value)
    : (useSelectionMode.value ? 'Create Event →' : 'Create Event & Generate Tickets')
)
const loadingLabelDynamic = ref('Creating event...')
const done = ref(false)

interface Attendee { firstName: string; lastName: string; email: string }
interface AttendeeWithToken extends Attendee { id: string; qrToken: string }
const parsedAttendees = ref<Attendee[]>([])

// ── slug derivation ───────────────────────────────────────────────────────────
function toSlug(v: string) { return v.toLowerCase().replace(/[^a-z0-9]/g, '') }
watch(() => form.value.name, (name) => { form.value.slug = toSlug(name) })
function sanitizeSlug(e: Event) { form.value.slug = toSlug((e.target as HTMLInputElement).value) }

// ── CSV handling ──────────────────────────────────────────────────────────────

function onDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file) loadFile(file)
}
function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) loadFile(file)
}
function loadFile(file: File) {
  csvError.value = ''
  csvFile.value = file
  const reader = new FileReader()
  reader.onload = ev => {
    try {
      parsedAttendees.value = parseAttendeeCsv(ev.target?.result as string)
      if (!parsedAttendees.value.length) throw new Error('No valid rows found in CSV.')
    } catch (err: unknown) {
      csvError.value = err instanceof Error ? err.message : 'Invalid CSV.'
      csvFile.value = null
      parsedAttendees.value = []
    }
  }
  reader.readAsText(file)
}

// ── submit ────────────────────────────────────────────────────────────────────
async function submit() {
  if (!useSelectionMode.value && (!csvFile.value || !parsedAttendees.value.length)) {
    csvError.value = 'Upload a valid CSV before creating the event.'
    return
  }

  loading.value = true

  try {
    // Selection mode: create event without attendees, redirect to selection wizard
    if (useSelectionMode.value) {
      const res = await api.raw(`/api/events`, {
        method: 'POST',
        body: JSON.stringify({
          name:         form.value.name,
          slug:         form.value.slug,
          date:         form.value.date,
          time:         form.value.time,
          location:     form.value.location,
          maxAttendees: maxAttendeesValue.value ?? null,
          attendees:    [],
        }),
      })
      const data = await res.json() as { status: string; message?: string; event?: { slug: string } }
      if (!res.ok) throw new Error(data.message ?? 'Failed to create event.')
      toast.success('Event created — proceeding to attendee selection.')
      router.push(`/manage/tix/${data.event!.slug}/select`)
      return
    }

    // Legacy mode: create event + attendees, generate QR codes
    const res = await api.raw(`/api/events`, {
      method: 'POST',
      body: JSON.stringify({
        name:      form.value.name,
        slug:      form.value.slug,
        date:      form.value.date,
        time:      form.value.time,
        location:  form.value.location,
        attendees: parsedAttendees.value,
      }),
    })
    const data = await res.json() as { status: string; message?: string; attendees?: AttendeeWithToken[] }
    if (!res.ok) throw new Error(data.message ?? 'Failed to create event.')

    const attendees = data.attendees!

    // 2. Generate QR code PNGs in-browser
    loadingLabelDynamic.value = `Generating ${attendees.length} QR codes...`
    const { default: QRCodeStyling } = await import('qr-code-styling')
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    for (const a of attendees) {
      const qr = new QRCodeStyling({
        width: 400,
        height: 400,
        type: 'canvas',
        data: a.qrToken,
        ...TIX_QR_RENDER_OPTIONS,
      })
      const blob = await qr.getRawData('png')
      if (blob) {
        // sanitize filename: keep alphanumeric + underscore
        const name = `${a.firstName}_${a.lastName}`.replace(/[^a-zA-Z0-9_]/g, '_')
        zip.file(`${name}.png`, blob)
      }
    }

    // 3. Download ZIP
    loadingLabelDynamic.value = 'Preparing ZIP...'
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const link = document.createElement('a')
    link.href = url
    link.download = `${form.value.slug}-tickets.zip`
    link.click()
    URL.revokeObjectURL(url)

    toast.success(`Event created — ${attendees.length} tickets generated.`)
    done.value = true
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Something went wrong.')
  } finally {
    loading.value = false
    loadingLabelDynamic.value = 'Creating event...'
  }
}
</script>
