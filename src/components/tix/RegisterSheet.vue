<template>
  <Dialog
    :open="open"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <DialogContent
      class="top-auto bottom-0 max-h-[90dvh] max-w-full -translate-y-0 overflow-y-auto rounded-b-none pb-[calc(1rem+env(safe-area-inset-bottom))] sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-y-1/2 sm:rounded-b-xl"
    >
      <DialogHeader>
        <DialogTitle>{{ result ? resultTitle : action.label }}</DialogTitle>
        <DialogDescription>{{ event.name }}</DialogDescription>
      </DialogHeader>

      <div
        v-if="result"
        class="space-y-4"
        role="status"
        data-register-result
      >
        <p
          ref="resultHeading"
          tabindex="-1"
          class="text-base font-semibold outline-none"
        >
          {{ resultTitle }}
        </p>
        <p class="text-sm">
          {{ resultBody }}
        </p>
        <Button
          as-child
          size="lg"
          class="w-full"
        >
          <router-link
            to="/tickets"
            @click="emit('update:open', false)"
          >
            View my tickets
          </router-link>
        </Button>
      </div>

      <form
        v-else
        class="space-y-5"
        novalidate
        @submit.prevent="submit"
      >
        <div
          v-for="question in event.questions"
          :key="question.id"
          class="space-y-2"
        >
          <fieldset
            v-if="question.type !== 'text'"
            class="space-y-2"
            :aria-describedby="fieldErrors[question.id] ? `err-${question.id}` : undefined"
          >
            <legend class="text-sm font-medium">
              {{ question.label }}<span
                v-if="question.required"
                class="text-destructive"
                aria-hidden="true"
              > *</span>
            </legend>
            <label
              v-for="option in question.options ?? []"
              :key="option"
              class="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
            >
              <input
                v-if="question.type === 'choice'"
                v-model="choice[question.id]"
                type="radio"
                :name="`q-${question.id}`"
                :value="option"
                class="size-5 accent-primary"
                :aria-invalid="fieldErrors[question.id] ? 'true' : undefined"
              >
              <input
                v-else
                v-model="multi[question.id]"
                type="checkbox"
                :value="option"
                class="size-5 accent-primary"
                :aria-invalid="fieldErrors[question.id] ? 'true' : undefined"
              >
              {{ option }}
            </label>
          </fieldset>
          <template v-else>
            <Label :for="`q-${question.id}`">
              {{ question.label }}<span
                v-if="question.required"
                class="text-destructive"
                aria-hidden="true"
              > *</span>
            </Label>
            <Input
              :id="`q-${question.id}`"
              v-model="text[question.id]"
              type="text"
              maxlength="1000"
              :required="question.required"
              :aria-invalid="fieldErrors[question.id] ? 'true' : undefined"
              :aria-describedby="fieldErrors[question.id] ? `err-${question.id}` : undefined"
            />
          </template>
          <p
            v-if="fieldErrors[question.id]"
            :id="`err-${question.id}`"
            class="text-sm text-destructive"
          >
            {{ fieldErrors[question.id] }}
          </p>
        </div>

        <p
          v-if="formError"
          role="alert"
          class="text-sm text-destructive"
        >
          {{ formError }}
        </p>

        <Button
          type="submit"
          size="lg"
          class="w-full"
          :disabled="!canSubmit || submitting"
        >
          {{ submitting ? 'SENDING...' : action.label }}
        </Button>
      </form>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError, api } from '@/lib/api'
import { invalidate } from '@/lib/queryCache'
import { primaryAction, type PublicEvent, type Ticket } from '@/lib/tix/eventState'

const props = defineProps<{ event: PublicEvent; open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  registered: [ticket: Ticket]
}>()

const text = reactive<Record<string, string>>({})
const choice = reactive<Record<string, string>>({})
const multi = reactive<Record<string, string[]>>({})
for (const q of props.event.questions) if (q.type === 'checkbox') multi[q.id] = []

const submitting = ref(false)
const formError = ref('')
const fieldErrors = ref<Record<string, string>>({})
const result = ref<Ticket | null>(null)
const resultHeading = ref<HTMLElement | null>(null)

const action = computed(() => primaryAction(props.event, null, new Date()))

function answerOf(id: string, type: string): string | string[] {
  if (type === 'checkbox') return multi[id] ?? []
  if (type === 'choice') return choice[id] ?? ''
  return (text[id] ?? '').trim()
}

const canSubmit = computed(() =>
  props.event.questions.every((q) => {
    if (!q.required) return true
    const a = answerOf(q.id, q.type)
    return Array.isArray(a) ? a.length > 0 : a !== ''
  }),
)

const COPY: Record<string, string> = {
  event_full: 'This event is full.',
  registration_closed: 'Registration has closed.',
  not_open_yet: 'Registration has not opened yet.',
  registration_cancelled: 'The organisers cancelled this registration.',
  invite_only: 'This event is invite only. Ask the organisers for an invitation.',
}

const resultTitle = computed(() => {
  switch (result.value?.status) {
    case 'confirmed': return "You're in"
    case 'waitlisted': return 'On the waitlist'
    case 'entered': return 'Entered'
    case 'pending': return 'Request sent'
    default: return 'Registration'
  }
})

const resultBody = computed(() => {
  const t = result.value
  switch (t?.status) {
    case 'confirmed': return 'Your ticket is ready. Show its QR code at the door.'
    case 'waitlisted':
      return t.waitlistPosition ? `You are on the waitlist (#${t.waitlistPosition}). A seat opens if someone cancels.` : 'You are on the waitlist. A seat opens if someone cancels.'
    case 'entered': return 'You are entered in the lottery. Check My tickets for the result.'
    case 'pending': return 'Request sent. An organiser will review it. Check My tickets for the decision.'
    default: return 'Your registration is recorded.'
  }
})

async function submit(): Promise<void> {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  formError.value = ''
  fieldErrors.value = {}
  const answers: Record<string, string | string[]> = {}
  for (const q of props.event.questions) {
    const a = answerOf(q.id, q.type)
    if (Array.isArray(a) ? a.length > 0 : a !== '') answers[q.id] = a
  }
  try {
    const res = await api.post<{ ticket: Ticket }>(`/api/events/${encodeURIComponent(props.event.slug)}/register`, { answers })
    result.value = res.ticket
    emit('registered', res.ticket)
    await nextTick()
    resultHeading.value?.focus()
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 422 && err.fields) {
        fieldErrors.value = err.fields
        formError.value = 'Check your answers and try again.'
      } else {
        formError.value = COPY[err.code] ?? err.message
        // The page may be out of date (full, closed): reload it.
        if (err.status === 409 || err.status === 403) invalidate('events:public:')
      }
    } else {
      formError.value = 'Could not register. Check your connection and try again.'
    }
  } finally {
    submitting.value = false
  }
}
</script>
