<template>
  <section class="relative flex min-h-screen w-full flex-col items-center px-4 py-24">
    <div class="w-full max-w-xl">
      <h1
        class="reveal mb-2 text-center font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200"
        style="font-size: clamp(2rem, 5vw, 3rem); letter-spacing: -0.03em;"
        data-cursor="text"
      >
        New Event
      </h1>
      <p class="reveal delay-1 mb-8 text-center font-mono text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">
        Details &amp; attendee CSV
      </p>

      <!-- Success state -->
      <div
        v-if="done"
        class="mica-card reveal relative rounded-3xl border border-gray-200 dark:border-slate-600 p-8 text-center"
      >
        <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <p class="mb-2 font-mono text-xs uppercase tracking-widest text-emerald-500">Event Created</p>
        <h2 class="mb-4 font-mono text-xl font-bold text-[#34418F] dark:text-slate-200">{{ form.name }}</h2>
        <p class="mb-6 font-mono text-xs text-gray-500 dark:text-slate-400">
          QR ZIP downloaded. Share tickets manually with your attendees.
        </p>
        <router-link
          :to="`/manage/tix/${form.slug}`"
          class="inline-block rounded-xl bg-[#DEAC4B] px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 dark:bg-eypi-gold-dark"
          data-cursor="cta"
        >
          Go to Event →
        </router-link>
      </div>

      <!-- Form -->
      <div
        v-else
        class="mica-card reveal delay-1 relative rounded-3xl border border-gray-200 dark:border-slate-600 p-8 md:p-10"
      >
        <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

        <!-- Mode toggle -->
        <div class="mb-6 flex overflow-hidden rounded-xl border border-gray-200 dark:border-slate-600">
          <button
            type="button"
            :class="[
              'flex-1 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors',
              !useSelectionMode
                ? 'bg-[#34418F] text-white dark:bg-slate-700'
                : 'bg-transparent text-gray-400 hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200',
            ]"
            @click="useSelectionMode = false"
          >Simple CSV Upload</button>
          <button
            type="button"
            :class="[
              'flex-1 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-colors',
              useSelectionMode
                ? 'bg-[#34418F] text-white dark:bg-slate-700'
                : 'bg-transparent text-gray-400 hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200',
            ]"
            @click="useSelectionMode = true"
          >Attendee Selection</button>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="submit">
          <!-- Event Name -->
          <div>
            <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Event Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="e.g. JPCS General Assembly"
              required
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
            />
          </div>

          <!-- Slug -->
          <div>
            <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Link Slug</label>
            <div class="flex items-center rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 transition-colors focus-within:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:focus-within:border-slate-500">
              <span class="mr-0.5 shrink-0 font-mono text-sm font-bold text-[#34418F] dark:text-slate-300">eypi.cc/tix/</span>
              <input
                v-model="form.slug"
                type="text"
                placeholder="bwai2026"
                required
                class="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none text-gray-900 placeholder-gray-400 dark:text-slate-200 dark:placeholder-slate-500"
                @input="sanitizeSlug"
              />
            </div>
            <p class="mt-1 font-mono text-[0.65rem] uppercase tracking-wide text-gray-400 dark:text-slate-500">
              Lowercase letters and numbers only — no spaces, hyphens, or special characters.
            </p>
          </div>

          <!-- Date + Time -->
          <div class="flex flex-col gap-4 md:flex-row">
            <div class="flex-1">
              <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Date</label>
              <input
                v-model="form.date"
                type="date"
                required
                class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500"
              />
            </div>
            <div class="flex-1">
              <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Time</label>
              <input
                v-model="form.time"
                type="time"
                required
                class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500"
              />
            </div>
          </div>

          <!-- Location -->
          <div>
            <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Location</label>
            <input
              v-model="form.location"
              type="text"
              placeholder="e.g. APC Auditorium"
              required
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
            />
          </div>

          <!-- CSV Upload (simple mode only) -->
          <div v-if="!useSelectionMode">
            <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Attendee CSV</label>
            <div
              class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors"
              :class="csvFile
                ? 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-600 dark:bg-emerald-900/10'
                : 'border-gray-300 bg-white/40 hover:border-[#34418F] dark:border-slate-600 dark:bg-mica-navy-input dark:hover:border-slate-500'"
              data-cursor="card"
              @dragover.prevent
              @drop.prevent="onDrop"
            >
              <p v-if="csvFile" class="font-mono text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                {{ csvFile.name }} — {{ parsedAttendees.length }} attendees
              </p>
              <template v-else>
                <p class="font-mono text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">Drop CSV or click to upload</p>
                <p class="mt-2 font-mono text-[0.7rem] text-gray-400 dark:text-slate-500">Headers: first_name, last_name, email</p>
              </template>
              <input ref="fileInput" type="file" accept=".csv" class="hidden" @change="onFileChange" />
              <button
                type="button"
                class="mt-3 rounded-lg border border-gray-300 bg-white px-4 py-1.5 font-mono text-xs text-gray-600 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:bg-transparent dark:text-slate-400 dark:hover:border-slate-400"
                @click="fileInput?.click()"
              >
                {{ csvFile ? 'Change file' : 'Browse' }}
              </button>
            </div>
            <p v-if="csvError" class="mt-1 font-mono text-[0.65rem] text-red-500 uppercase tracking-wide">{{ csvError }}</p>
          </div>

          <!-- Selection mode info + max attendees -->
          <div v-else class="rounded-xl border border-[#34418F]/20 bg-[#34418F]/5 px-4 py-4 dark:border-slate-600 dark:bg-slate-800/40">
            <p class="mb-3 font-mono text-xs text-[#34418F] dark:text-slate-300">
              You'll upload the CSV and configure clusters &amp; criteria on the next page.
            </p>
            <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Max Attendees <span class="font-normal text-gray-400">(optional)</span></label>
            <input
              v-model.number="maxAttendeesValue"
              type="number"
              min="1"
              placeholder="Leave blank for no limit"
              class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400"
            />
            <p class="mt-1 font-mono text-[0.65rem] text-gray-400 dark:text-slate-500 uppercase tracking-wide">This can be overridden when you configure clusters.</p>
          </div>

          <!-- Submit -->
          <button
            type="submit"
            :disabled="loading"
            :class="[
              'mt-2 w-full rounded-xl bg-[#DEAC4B] px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all duration-200 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover',
              loading ? 'opacity-70 cursor-not-allowed animate-pulse' : 'hover:brightness-110 hover:-translate-y-0.5',
            ]"
            data-cursor="cta"
          >
            {{ loadingLabel }}
          </button>
        </form>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useReveal } from '@/composables/useReveal'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import { TIX_API_URL } from '@/config/tix-api'
import { useRouter } from 'vue-router'

useReveal()
const toast = useToast()
const { authHeaders } = useAuth()
const router = useRouter()

// ── mode ──────────────────────────────────────────────────────────────────────
const useSelectionMode  = ref(false)
const maxAttendeesValue = ref<number | null>(null)

// ── form state ────────────────────────────────────────────────────────────────
const form = ref({ name: '', slug: '', date: '', time: '', location: '' })
const csvFile = ref<File | null>(null)
const csvError = ref('')
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
function parseCSV(text: string): Attendee[] {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim())
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row.')

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[\s_"]/g, ''))
  const firstIdx = headers.findIndex(h => ['firstname', 'first'].includes(h))
  const lastIdx  = headers.findIndex(h => ['lastname', 'last'].includes(h))
  const emailIdx = headers.findIndex(h => h === 'email' || h === 'emailaddress')

  if (firstIdx === -1 || lastIdx === -1 || emailIdx === -1) {
    throw new Error('CSV must have first_name, last_name, and email columns.')
  }

  return lines.slice(1).map(line => {
    // Simple quoted-field parser
    const cols: string[] = []
    let cur = ''
    let inQuote = false
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote }
      else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    cols.push(cur.trim())
    return {
      firstName: (cols[firstIdx] ?? '').replace(/^"|"$/g, '').trim(),
      lastName:  (cols[lastIdx]  ?? '').replace(/^"|"$/g, '').trim(),
      email:     (cols[emailIdx] ?? '').replace(/^"|"$/g, '').trim(),
    }
  }).filter(a => a.email)
}

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
      parsedAttendees.value = parseCSV(ev.target?.result as string)
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
    toast.error('Upload a valid CSV first.')
    return
  }

  loading.value = true

  try {
    // Selection mode: create event without attendees, redirect to selection wizard
    if (useSelectionMode.value) {
      const res = await fetch(`${TIX_API_URL}/api/events`, {
        method: 'POST',
        headers: authHeaders(),
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
    const res = await fetch(`${TIX_API_URL}/api/events`, {
      method: 'POST',
      headers: authHeaders(),
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
        dotsOptions:          { color: '#34418F', type: 'rounded' },
        cornersSquareOptions: { color: '#DEAC4B', type: 'extra-rounded' },
        backgroundOptions:    { color: '#ffffff' },
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
