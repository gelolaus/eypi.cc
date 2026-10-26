<template>
  <section class="relative flex min-h-dvh w-full flex-col items-center justify-center px-4 py-10 sm:py-20">
    <div class="w-full max-w-md">
      <!-- Event header (after successful lookup) -->
      <div
        v-if="ticket?.event"
        class="mb-6 text-center"
      >
        <h1
          class="mb-2 font-display font-black tracking-tight text-foreground"
          style="font-size: clamp(1.8rem, 5vw, 3rem); letter-spacing: -0.03em;"
        >
          {{ ticket.event.name }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ formatDate(ticket.event.eventDate) }} · {{ formatTime(ticket.event.eventTime) }} · {{ ticket.event.location }}
        </p>
      </div>

      <!-- QR ticket (after successful lookup) -->
      <Card
        v-if="ticket"
        class="w-full gap-0 rounded-3xl p-5 text-center sm:p-8"
      >
        <p class="mb-4 font-mono text-lg font-bold text-foreground">
          {{ ticket.firstName }} {{ ticket.lastName }}
        </p>

        <!-- QR canvas container: white so the code scans on the dark UI -->
        <div
          ref="qrContainer"
          data-ticket-qr
          class="mx-auto mb-4 flex w-fit max-w-full items-center justify-center rounded-xl bg-white p-3"
        />

        <p class="text-xs font-medium text-muted-foreground">
          Screenshot this QR — it is not saved on your device.
        </p>

        <div
          v-if="passToken"
          class="mt-6 flex flex-col gap-3"
        >
          <Button
            type="button"
            size="lg"
            class="w-full"
            :class="savingGoogleWallet ? 'animate-pulse' : ''"
            :disabled="savingGoogleWallet"
            @click="saveToGoogleWallet"
          >
            {{ savingGoogleWallet ? 'Opening...' : 'Save to Google Wallet' }}
          </Button>
          <p
            v-if="walletError"
            role="alert"
            class="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-center font-mono text-xs font-bold text-destructive"
          >
            {{ walletError }}
          </p>
        </div>

        <Button
          type="button"
          variant="link"
          class="mt-4 text-muted-foreground underline"
          @click="reset"
        >
          Look up a different ticket
        </Button>
      </Card>

      <!-- Lookup form -->
      <Card
        v-else
        class="w-full gap-0 rounded-3xl p-5 sm:p-8"
      >
        <h2 class="mb-6 text-center font-display text-xl font-bold uppercase tracking-widest text-foreground">
          View Your Ticket
        </h2>

        <form
          class="flex flex-col"
          @submit.prevent="lookup"
        >
          <Input
            v-model="form.firstName"
            type="text"
            placeholder="First Name"
            aria-label="First Name"
            required
            class="mb-4"
          />
          <Input
            v-model="form.lastName"
            type="text"
            placeholder="Last Name"
            aria-label="Last Name"
            required
            class="mb-4"
          />
          <Input
            v-model="form.email"
            type="email"
            placeholder="Email"
            aria-label="Email"
            required
            class="mb-6 font-mono"
          />

          <!-- Lookup error -->
          <div
            v-if="lookupError"
            role="alert"
            class="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-center font-mono text-sm font-bold text-destructive"
          >
            {{ lookupError }}
          </div>

          <Button
            type="submit"
            size="lg"
            class="w-full"
            :class="lookingUp ? 'animate-pulse' : ''"
            :disabled="lookingUp"
          >
            {{ lookingUp ? 'Searching...' : 'Show Ticket' }}
          </Button>
        </form>

        <p class="mt-4 text-center font-mono text-xs leading-relaxed text-muted-foreground">
          Enter your details exactly as registered.
        </p>
      </Card>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { ref, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { TIX_QR_RENDER_OPTIONS } from '@/utils/tix-qr'

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
    const res = await api.raw(`/api/events/${slug}/lookup`, {
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
    const res = await api.raw(
      `/api/events/${slug}/passes/google?token=${encodeURIComponent(passToken.value)}`,
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
