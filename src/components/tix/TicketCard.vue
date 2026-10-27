<template>
  <Card class="w-full gap-0 overflow-hidden rounded-3xl p-0">
    <div class="space-y-1 p-5 sm:p-6">
      <div class="flex items-start justify-between gap-3">
        <h2 class="min-w-0 text-xl font-semibold leading-tight text-foreground">
          {{ ticket.event.name }}
        </h2>
        <Badge
          :variant="copy.variant"
          class="shrink-0"
        >
          {{ copy.label }}
        </Badge>
      </div>
      <p class="text-sm text-muted-foreground">
        {{ whenText }}
      </p>
      <p class="text-sm text-muted-foreground">
        {{ ticket.event.location }}
      </p>
    </div>

    <div class="space-y-4 border-t border-border p-5 sm:p-6">
      <p
        class="text-sm text-foreground"
        :class="ticket.status === 'waitlisted' ? 'font-semibold' : ''"
      >
        {{ isPast && isLive ? 'This event has passed.' : copy.text }}
      </p>

      <div
        v-if="showQr"
        class="space-y-2 text-center"
      >
        <!-- White on purpose: the code scans best as black on white, in dark mode too. -->
        <div
          ref="qrContainer"
          data-ticket-qr
          role="img"
          :aria-label="`Entry QR code for ${ticket.event.name}`"
          class="mx-auto flex w-fit max-w-full items-center justify-center rounded-xl bg-white p-3"
        />
        <p class="text-xs text-muted-foreground">
          Show this at the door. Turn your screen brightness up if it will not scan.
        </p>
      </div>

      <div
        v-if="showWallet || showCalendar"
        class="flex flex-col gap-2 sm:flex-row"
      >
        <Button
          v-if="showWallet"
          type="button"
          class="min-h-11 flex-1"
          :disabled="savingWallet"
          @click="saveToGoogleWallet"
        >
          {{ savingWallet ? 'Opening…' : 'Add to Google Wallet' }}
        </Button>
        <Button
          v-if="showCalendar"
          type="button"
          variant="outline"
          class="min-h-11 flex-1"
          @click="addToCalendar"
        >
          Add to calendar
        </Button>
      </div>

      <p
        v-if="error"
        role="alert"
        class="text-sm text-destructive"
      >
        {{ error }}
      </p>

      <Button
        v-if="canCancel"
        type="button"
        variant="ghost"
        class="min-h-11 text-destructive"
        :disabled="cancelling"
        @click="cancelRegistration"
      >
        {{ cancelling ? 'Cancelling…' : 'Cancel registration' }}
      </Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDialog } from '@/composables/useDialog'
import { ApiError, api } from '@/lib/api'
import { formatManilaDate } from '@/lib/manilaTime'
import { buildIcs, icsFilename } from '@/lib/tix/ics'
import { isPastEvent, type TicketDto } from '@/lib/tix/tickets'
import { TIX_QR_RENDER_OPTIONS } from '@/utils/tix-qr'

const props = defineProps<{
  ticket: TicketDto
  /** Signed token for the Google Wallet pass (guest page only; own tickets have none). */
  passToken?: string | null
  /** The private guest page: no cancelling there. */
  guest?: boolean
  /** Guest page: fetches the ticket again and returns a fresh pass token (used once if the first has expired). */
  refreshPass?: () => Promise<string | null>
}>()
const emit = defineEmits<{ cancelled: [] }>()

const dialog = useDialog()
const qrContainer = ref<HTMLElement | null>(null)
const savingWallet = ref(false)
const cancelling = ref(false)
const error = ref('')

function formatTime(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return t
  const h = Number(m[1])
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`
}

const whenText = computed(() => {
  const e = props.ticket.event
  const end = e.endTime ? ` to ${formatTime(e.endTime)}` : ''
  return `${formatManilaDate(e.eventDate)}, ${formatTime(e.eventTime)}${end}`
})

const copy = computed<{ label: string; text: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }>(() => {
  const t = props.ticket
  switch (t.status) {
    case 'confirmed':
      return { label: 'Confirmed', text: "You're in. Show the code below at the door.", variant: 'default' }
    case 'waitlisted':
      return {
        label: 'Waitlist',
        text: t.waitlistPosition ? `You're #${t.waitlistPosition} on the waitlist. We'll tell you if a seat opens.` : "You're on the waitlist. We'll tell you if a seat opens.",
        variant: 'secondary',
      }
    case 'pending':
      return { label: 'Pending', text: 'Your registration is waiting for the organisers to approve it.', variant: 'secondary' }
    case 'entered':
      return { label: 'In the lottery', text: "You're entered in the lottery. Results come after registration closes.", variant: 'secondary' }
    case 'declined':
      return { label: 'Not accepted', text: 'Your registration was not accepted for this event.', variant: 'outline' }
    case 'cancelled':
      return { label: 'Cancelled', text: 'This registration was cancelled.', variant: 'outline' }
    default:
      return { label: String(t.status), text: '', variant: 'outline' }
  }
})

const isPast = computed(() => isPastEvent(props.ticket))
const isLive = computed(() => ['confirmed', 'waitlisted', 'pending', 'entered'].includes(props.ticket.status))
const isConfirmed = computed(() => props.ticket.status === 'confirmed' && !isPast.value)
const showQr = computed(() => isConfirmed.value && !!props.ticket.qrToken)
// Guests get a pass token with the ticket; signed-in owners ask for a link on demand.
const showWallet = computed(() => isConfirmed.value && (!!props.passToken || !props.guest))
const calendarIcs = computed(() => (isLive.value && !isPast.value ? buildIcs(props.ticket) : null))
const showCalendar = computed(() => calendarIcs.value !== null)
const canCancel = computed(() => !props.guest && isLive.value && !isPast.value)

// qr-code-styling is heavy: it loads only when a confirmed ticket is on screen.
watch(
  () => (showQr.value ? props.ticket.qrToken : null),
  async (token) => {
    if (!token) return
    await nextTick()
    const el = qrContainer.value
    if (!el) return
    const { default: QRCodeStyling } = await import('qr-code-styling')
    el.innerHTML = ''
    new QRCodeStyling({ width: 260, height: 260, type: 'canvas', data: token, ...TIX_QR_RENDER_OPTIONS }).append(el)
  },
  { immediate: true, flush: 'post' },
)

type WalletResult = { url?: string; message?: string; expired?: boolean }

async function requestWalletUrl(token: string | null | undefined): Promise<WalletResult> {
  const res = token
    ? await api.raw(`/api/events/${encodeURIComponent(props.ticket.event.slug)}/passes/google?token=${encodeURIComponent(token)}`)
    : await api.raw(`/api/tickets/${encodeURIComponent(props.ticket.id)}/pass`, { method: 'POST' })
  const body = await res.json().catch(() => ({})) as { url?: string; message?: string; error?: { message?: string } }
  const message = body.message ?? body.error?.message
  return { url: res.ok ? body.url : undefined, message, expired: res.status === 400 || res.status === 404 }
}

async function saveToGoogleWallet(): Promise<void> {
  error.value = ''
  savingWallet.value = true
  try {
    let result = await requestWalletUrl(props.passToken)
    if (!result.url && props.guest && result.expired && props.refreshPass) {
      const fresh = await props.refreshPass()
      if (fresh) result = await requestWalletUrl(fresh)
    }
    if (!result.url) throw new Error(result.message ?? 'Could not open Google Wallet. Try again later.')
    window.location.href = result.url
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Could not open Google Wallet. Try again later.'
  } finally {
    savingWallet.value = false
  }
}

function addToCalendar(): void {
  const ics = calendarIcs.value
  if (!ics) return
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = icsFilename(props.ticket)
  a.rel = 'noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function cancelRegistration(): Promise<void> {
  const ok = await dialog.confirm({
    title: 'Cancel your registration?',
    body: `Your spot at "${props.ticket.event.name}" is released.`,
    confirmLabel: 'Cancel registration',
    abortLabel: 'Keep it',
  })
  if (!ok) return
  cancelling.value = true
  error.value = ''
  try {
    // api.ts invalidates the events: and tickets: caches after a successful write.
    await api.del(`/api/events/${encodeURIComponent(props.ticket.event.slug)}/registration`)
    emit('cancelled')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Could not cancel. Try again.'
  } finally {
    cancelling.value = false
  }
}
</script>
