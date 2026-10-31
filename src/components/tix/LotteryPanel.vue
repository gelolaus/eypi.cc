<template>
  <section
    class="space-y-5"
    aria-labelledby="lottery-title"
  >
    <div class="space-y-1">
      <h2
        id="lottery-title"
        class="font-heading text-lg font-semibold"
      >
        Lottery draw
      </h2>
      <p class="text-sm text-muted-foreground">
        <span v-if="entered !== null">{{ entered }} {{ entered === 1 ? 'person has' : 'people have' }} entered.</span>
        Winners are picked at random from the entries once registration closes.
        <span v-if="event.waitlistEnabled">Anyone not picked joins the waitlist in draw order.</span>
        <span v-else>Anyone not picked is declined.</span>
      </p>
    </div>

    <p
      v-if="blockedCopy"
      class="rounded-2xl border border-border bg-muted px-4 py-3 text-sm"
      data-draw-blocked
    >
      {{ blockedCopy }}
    </p>

    <div
      v-if="!drawn"
      class="grid grid-cols-1 gap-4 sm:max-w-md"
    >
      <div class="space-y-1.5">
        <Label for="lottery-seed">Seed (optional)</Label>
        <Input
          id="lottery-seed"
          v-model="seed"
          name="seed"
          type="text"
          autocomplete="off"
          :aria-invalid="seedInvalid"
          aria-describedby="lottery-seed-help"
          placeholder="Leave empty for a random seed"
        />
        <p
          id="lottery-seed-help"
          class="text-sm"
          :class="seedInvalid ? 'text-destructive' : 'text-muted-foreground'"
        >
          {{ seedInvalid ? 'Use up to 64 letters, digits and . _ : - only.' : 'The same seed always gives the same winners. It is saved with the result.' }}
        </p>
      </div>

      <div
        v-if="quotaQuestions.length"
        class="space-y-1.5"
      >
        <Label for="lottery-cluster">Quotas from an answer (optional)</Label>
        <select
          id="lottery-cluster"
          v-model="clusterQuestionId"
          name="cluster"
          class="h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover [&>option]:text-popover-foreground"
        >
          <option value="">
            No quotas (draw from everyone)
          </option>
          <option
            v-for="question in quotaQuestions"
            :key="question.id"
            :value="question.id"
          >
            {{ question.label }}
          </option>
        </select>
        <p class="text-sm text-muted-foreground">
          Seats are split by the quotas you set for each answer.
        </p>
      </div>
      <p
        v-else-if="choiceQuestions.length"
        class="text-sm text-muted-foreground"
        data-quota-hint
      >
        To draw with quotas, set a limit for each answer first.
        <button
          type="button"
          class="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2"
          @click="emit('goOverview')"
        >
          Go to the Overview tab
        </button>
      </p>

      <div>
        <Button
          type="button"
          data-draw
          :disabled="!canDraw"
          @click="startDraw"
        >
          {{ drawing ? 'Drawing…' : 'Draw winners' }}
        </Button>
      </div>
    </div>
    <div v-else>
      <Button
        type="button"
        data-draw
        disabled
      >
        Draw winners
      </Button>
    </div>

    <p
      v-if="errorCopy"
      role="alert"
      class="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ errorCopy }}
    </p>

    <p
      v-if="drawn && !result"
      class="rounded-2xl border border-border bg-muted px-4 py-3 text-sm"
    >
      This lottery has already been drawn. Check the Attendees tab for the results.
    </p>

    <div
      v-if="result"
      data-draw-result
      class="space-y-3 rounded-2xl border border-border p-4"
      aria-live="polite"
    >
      <h3 class="text-base font-semibold">
        Draw complete
      </h3>
      <dl class="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt class="text-muted-foreground">
            Confirmed
          </dt>
          <dd class="font-mono text-2xl font-semibold">
            {{ result.confirmed }}
          </dd>
        </div>
        <div>
          <dt class="text-muted-foreground">
            Waitlisted
          </dt>
          <dd class="font-mono text-2xl font-semibold">
            {{ result.waitlisted }}
          </dd>
        </div>
        <div>
          <dt class="text-muted-foreground">
            Declined
          </dt>
          <dd class="font-mono text-2xl font-semibold">
            {{ result.declined }}
          </dd>
        </div>
      </dl>
      <p class="text-sm text-muted-foreground">
        Seed: <span class="break-all font-mono text-foreground">{{ result.seed }}</span>. Keep it to show the draw was fair.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ApiError, api } from '@/lib/api'
import { useDialog } from '@/composables/useDialog'
import { registrationBlock, type EventQuestion, type PublicEvent } from '@/lib/tix/eventState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SEED_PATTERN = /^[A-Za-z0-9._:-]{1,64}$/

const props = defineProps<{
  slug: string
  clusters?: { clusterCol?: string | null }[]
  event: {
    status: string
    eventDate: string
    eventTime: string
    registrationOpensAt: string | null
    registrationClosesAt: string | null
    waitlistEnabled: boolean
    lotteryDrawnAt: string | null
    questions: EventQuestion[]
  }
}>()

const emit = defineEmits<{ drawn: []; goOverview: [] }>()

const dialog = useDialog()
const seed = ref('')
const clusterQuestionId = ref('')
const drawing = ref(false)
const drawnNow = ref(false)
const result = ref<{ confirmed: number; waitlisted: number; declined: number; seed: string } | null>(null)
const errorCopy = ref('')
const entered = ref<number | null>(null)
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined

const choiceQuestions = computed(() => props.event.questions.filter((question) => question.type === 'choice'))
// Only questions that already have quota rows can drive a quota draw.
const quotaQuestions = computed(() => {
  const withQuotas = new Set((props.clusters ?? []).map((cluster) => cluster.clusterCol).filter(Boolean))
  return choiceQuestions.value.filter((question) => withQuotas.has(question.id))
})
const drawn = computed(() => drawnNow.value || props.event.lotteryDrawnAt != null)
const seedInvalid = computed(() => seed.value !== '' && !SEED_PATTERN.test(seed.value))

/** The server stays the authority; this only decides whether the button is worth pressing. */
const block = computed<'cancelled' | 'draft' | 'open' | null>(() => {
  if (props.event.status === 'cancelled') return 'cancelled'
  if (props.event.status === 'draft') return 'draft'
  const reason = registrationBlock({
    ...props.event,
    admissionMode: 'lottery',
    seatsLeft: null,
    slug: props.slug,
  } as unknown as PublicEvent, now.value)
  return reason === 'closed' ? null : 'open'
})

const blockedCopy = computed(() => {
  if (drawn.value) return ''
  if (block.value === 'cancelled') return 'This event is cancelled, so it cannot be drawn.'
  if (block.value === 'draft') return 'Publish the event before drawing.'
  if (block.value === 'open') return 'Registration is still open. You can draw once it closes.'
  return ''
})

const canDraw = computed(() => !drawing.value && !drawn.value && block.value === null && !seedInvalid.value)

const CONFLICT_COPY: Record<string, string> = {
  already_drawn: 'This lottery has already been drawn.',
  registration_open: 'Registration is still open. Draw after it closes.',
  event_cancelled: 'This event is cancelled, so it cannot be drawn.',
  not_published: 'Publish the event before drawing.',
  not_lottery: 'Only lottery events can be drawn.',
  invalid_seed: 'Use up to 64 letters, digits and . _ : - for the seed.',
}

async function loadEntered() {
  try {
    const data = await api.get<{ counts?: Record<string, number> }>(`/api/events/${props.slug}/attendees?paged=1&status=entered`)
    entered.value = data.counts?.entered ?? null
  } catch {
    entered.value = null
  }
}

async function startDraw() {
  if (!canDraw.value) return
  const ok = await dialog.confirm({
    title: 'Draw the winners?',
    body: `This picks winners from ${entered.value ?? 'all'} entries. Results show up in each student's My tickets. This can't be undone.`,
    confirmLabel: 'Draw winners',
  })
  if (!ok) return
  drawing.value = true
  errorCopy.value = ''
  const body: { seed?: string; clusterQuestionId?: string } = {}
  if (seed.value) body.seed = seed.value
  if (clusterQuestionId.value) body.clusterQuestionId = clusterQuestionId.value
  try {
    result.value = await api.post<NonNullable<typeof result.value>>(`/api/events/${props.slug}/draw`, body)
    drawnNow.value = true
    emit('drawn')
    void loadEntered()
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      if (err.code === 'already_drawn') drawnNow.value = true
      errorCopy.value = CONFLICT_COPY[err.code] ?? err.message
    } else {
      errorCopy.value = 'Could not draw. Check your connection and try again.'
    }
  } finally {
    drawing.value = false
  }
}

onMounted(() => {
  void loadEntered()
  timer = setInterval(() => { now.value = new Date() }, 30_000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>
