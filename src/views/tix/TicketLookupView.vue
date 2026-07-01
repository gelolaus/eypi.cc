<template>
  <section class="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-28">
    <div class="w-full max-w-md">
      <!-- Event header (after successful lookup) -->
      <div v-if="ticket?.event" class="mb-6 text-center">
        <h1
          class="mb-2 font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200"
          style="font-size: clamp(1.8rem, 5vw, 3rem); letter-spacing: -0.03em;"
          data-cursor="text"
        >
          {{ ticket.event.name }}
        </h1>
        <p class="font-mono text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">
          {{ formatDate(ticket.event.eventDate) }} · {{ formatTime(ticket.event.eventTime) }} · {{ ticket.event.location }}
        </p>
      </div>

      <!-- QR ticket (after successful lookup) -->
      <div
        v-if="ticket"
        class="mica-card relative w-full rounded-3xl border border-gray-200 dark:border-slate-600 p-8 text-center"
      >
        <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

        <p class="mb-1 font-mono text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">Your ticket</p>
        <p class="mb-4 font-mono text-lg font-bold text-[#34418F] dark:text-slate-200">{{ ticket.firstName }} {{ ticket.lastName }}</p>

        <!-- QR canvas container -->
        <div class="mx-auto mb-4 flex items-center justify-center" ref="qrContainer" />

        <p class="font-mono text-[0.65rem] uppercase tracking-widest text-gray-400 dark:text-slate-500">
          Screenshot this QR — it is not saved on your device.
        </p>
        <button
          type="button"
          class="mt-4 font-mono text-xs uppercase tracking-widest text-gray-400 underline hover:text-[#34418F] dark:text-slate-500 dark:hover:text-slate-300"
          @click="reset"
        >
          Look up a different ticket
        </button>
      </div>

      <!-- Lookup form -->
      <div
        v-else
        class="mica-card relative w-full rounded-3xl border border-gray-200 dark:border-slate-600 p-8"
      >
        <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
        <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />

        <h2 class="mb-6 text-center font-mono text-xl font-bold uppercase tracking-widest text-[#34418F] dark:text-slate-200">
          View Your Ticket
        </h2>

        <form class="flex flex-col" @submit.prevent="lookup">
          <input
            v-model="form.firstName"
            type="text"
            placeholder="First Name"
            required
            class="mb-4 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
          />
          <input
            v-model="form.lastName"
            type="text"
            placeholder="Last Name"
            required
            class="mb-4 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
          />
          <input
            v-model="form.email"
            type="email"
            placeholder="Email"
            required
            class="mb-6 w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
          />

          <!-- Lookup error -->
          <div
            v-if="lookupError"
            class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center font-mono text-sm font-bold text-red-600 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400"
          >
            {{ lookupError }}
          </div>

          <button
            type="submit"
            :disabled="lookingUp"
            :class="[
              'w-full rounded-xl bg-[#DEAC4B] px-4 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all duration-200 dark:bg-eypi-gold-dark dark:text-slate-100',
              lookingUp ? 'opacity-70 cursor-not-allowed animate-pulse' : 'hover:brightness-110 hover:-translate-y-0.5',
            ]"
            data-cursor="cta"
          >
            {{ lookingUp ? 'Searching...' : 'Show Ticket' }}
          </button>
        </form>

        <p class="mt-4 text-center font-mono text-xs leading-relaxed text-gray-500 dark:text-slate-400">
          Enter your details exactly as registered. Screenshot your QR to keep it.
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { TIX_API_URL } from '@/config/tix-api'
import { TIX_QR_RENDER_OPTIONS } from '@/utils/tix-qr'

const route = useRoute()

interface EventInfo { name: string; eventDate: string; eventTime: string; location: string }
interface Ticket {
  firstName: string
  lastName: string
  email: string
  qrToken: string
  event?: EventInfo
}

const lookingUp = ref(false)
const ticket = ref<Ticket | null>(null)
const qrContainer = ref<HTMLElement | null>(null)

const form = ref({ firstName: '', lastName: '', email: '' })
const lookupError = ref('')

const slug = route.params.eventId as string

function formatDate(d: string) {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return new Date(Number(y), Number(m) - 1, Number(day)).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}
function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`
}

async function lookup() {
  lookupError.value = ''
  lookingUp.value = true
  try {
    const res = await fetch(`${TIX_API_URL}/api/events/${slug}/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    })
    const data = await res.json() as { status: string; message?: string; ticket?: Ticket }
    if (!res.ok) throw new Error(data.message ?? 'No ticket found. Check your details and try again.')
    ticket.value = data.ticket!

    await nextTick()
    await renderQR(data.ticket!.qrToken)
  } catch (err: unknown) {
    lookupError.value = err instanceof Error ? err.message : 'No ticket found. Check your details and try again.'
  } finally {
    lookingUp.value = false
  }
}

async function renderQR(token: string) {
  if (!qrContainer.value) return
  qrContainer.value.innerHTML = ''
  const { default: QRCodeStyling } = await import('qr-code-styling')
  const qr = new QRCodeStyling({
    width: 260,
    height: 260,
    type: 'canvas',
    data: token,
    ...TIX_QR_RENDER_OPTIONS,
  })
  qr.append(qrContainer.value)
}

function reset() {
  ticket.value = null
  form.value = { firstName: '', lastName: '', email: '' }
  lookupError.value = ''
}
</script>
