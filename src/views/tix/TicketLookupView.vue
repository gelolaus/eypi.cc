<template>
  <section class="relative flex min-h-screen w-full flex-col items-center justify-center px-4 py-28">
    <div class="w-full max-w-md">
      <!-- Event header (after successful lookup) -->
      <div v-if="ticket?.event" class="mb-6 text-center">
        <h1
          class="mb-2 font-display font-bold tracking-tight text-g-text"
          style="font-size: clamp(1.8rem, 5vw, 3rem); letter-spacing: -0.03em;"
        >
          {{ ticket.event.name }}
        </h1>
        <p class="text-sm text-g-muted">
          {{ formatDate(ticket.event.eventDate) }} · {{ formatTime(ticket.event.eventTime) }} · {{ ticket.event.location }}
        </p>
      </div>

      <!-- QR ticket (after successful lookup) -->
      <Card v-if="ticket" className="text-center">
        <p class="mb-4 font-display text-lg font-bold text-g-text">
          {{ ticket.firstName }} {{ ticket.lastName }}
        </p>

        <div class="mx-auto mb-4 flex items-center justify-center" ref="qrContainer" />

        <p class="text-xs font-medium text-g-muted">
          Screenshot this QR — it is not saved on your device.
        </p>

        <div v-if="passToken" class="mt-6 flex flex-col gap-3">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            :disabled="savingGoogleWallet"
            @click="saveToGoogleWallet"
          >
            {{ savingGoogleWallet ? 'Opening...' : 'Save to Google Wallet' }}
          </Button>
          <p
            v-if="walletError"
            class="rounded-xl border border-g-destructive/30 bg-g-destructive/10 px-4 py-3 text-center text-xs font-semibold text-g-destructive"
          >
            {{ walletError }}
          </p>
        </div>

        <button
          type="button"
          class="mt-4 text-sm font-medium text-g-muted underline transition-colors hover:text-g-text"
          @click="reset"
        >
          Look up a different ticket
        </button>
      </Card>

      <!-- Lookup form -->
      <Card v-else>
        <h2 class="mb-6 text-center font-display text-xl font-bold tracking-tight text-g-text">
          View Your Ticket
        </h2>

        <form class="flex flex-col gap-4" @submit.prevent="lookup">
          <Input
            :value="form.firstName"
            type="text"
            placeholder="First Name"
            required
            @input="onFirstNameInput"
          />
          <Input
            :value="form.lastName"
            type="text"
            placeholder="Last Name"
            required
            @input="onLastNameInput"
          />
          <Input
            :value="form.email"
            type="email"
            placeholder="Email"
            required
            @input="onEmailInput"
          />

          <div
            v-if="lookupError"
            class="rounded-xl border border-g-destructive/30 bg-g-destructive/10 px-4 py-3 text-center text-sm font-semibold text-g-destructive"
          >
            {{ lookupError }}
          </div>

          <Button type="submit" className="w-full" :disabled="lookingUp">
            {{ lookingUp ? 'Searching...' : 'Show Ticket' }}
          </Button>
        </form>

        <p class="mt-4 text-center text-xs leading-relaxed text-g-muted">
          Enter your details exactly as registered.
        </p>
      </Card>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { TIX_API_URL } from '@/config/tix-api'
import { TIX_QR_RENDER_OPTIONS } from '@/utils/tix-qr'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

const route = useRoute()

interface EventInfo { name: string; eventDate: string; eventTime: string; location: string }
interface Ticket {
  firstName: string
  lastName: string
  email: string
  qrToken: string
  clusterValue?: string | null
  event?: EventInfo
}

const lookingUp = ref(false)
const ticket = ref<Ticket | null>(null)
const passToken = ref('')
const qrContainer = ref<HTMLElement | null>(null)
const savingGoogleWallet = ref(false)
const walletError = ref('')

const form = ref({ firstName: '', lastName: '', email: '' })
const lookupError = ref('')

const slug = route.params.eventId as string

function onFirstNameInput(e: Event) {
  form.value.firstName = (e.target as HTMLInputElement).value
}
function onLastNameInput(e: Event) {
  form.value.lastName = (e.target as HTMLInputElement).value
}
function onEmailInput(e: Event) {
  form.value.email = (e.target as HTMLInputElement).value
}

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
    const data = await res.json() as { status: string; message?: string; ticket?: Ticket; passToken?: string }
    if (!res.ok) throw new Error(data.message ?? 'No ticket found. Check your details and try again.')
    ticket.value = data.ticket!
    passToken.value = data.passToken ?? ''
    walletError.value = ''

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
  passToken.value = ''
  walletError.value = ''
  form.value = { firstName: '', lastName: '', email: '' }
  lookupError.value = ''
}

async function saveToGoogleWallet() {
  if (!passToken.value) return
  walletError.value = ''
  savingGoogleWallet.value = true
  try {
    const res = await fetch(
      `${TIX_API_URL}/api/events/${slug}/passes/google?token=${encodeURIComponent(passToken.value)}`,
    )
    const data = await res.json() as { status: string; message?: string; url?: string }
    if (!res.ok || !data.url) {
      throw new Error(data.message ?? 'Could not open Google Wallet. Try again later.')
    }
    window.location.href = data.url
  } catch (err: unknown) {
    walletError.value = err instanceof Error ? err.message : 'Could not open Google Wallet. Try again later.'
  } finally {
    savingGoogleWallet.value = false
  }
}
</script>
