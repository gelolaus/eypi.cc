<template>
  <section class="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-10 sm:py-24">
    <Card class="w-full max-w-md gap-0 rounded-3xl bg-card/80 p-6 shadow-2xl sm:p-8">
      <h1 class="mb-2 text-center font-display text-3xl font-semibold tracking-tight">
        Report a link
      </h1>
      <p
        v-if="slug"
        class="mb-6 text-center font-mono text-sm text-muted-foreground"
      >
        {{ slug }}
      </p>

      <p
        v-if="submitted"
        role="status"
        class="text-center text-sm leading-relaxed text-muted-foreground"
      >
        Thanks. We'll review this link.
      </p>

      <form
        v-else
        class="flex flex-col"
        @submit.prevent="onSubmit"
      >
        <Label
          for="report-reason"
          class="mb-1.5"
        >
          Reason
        </Label>
        <select
          id="report-reason"
          v-model="reason"
          class="h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground"
          :aria-invalid="Boolean(reasonError)"
          :aria-describedby="reasonError ? 'reason-error' : undefined"
        >
          <option value="">
            Choose a reason
          </option>
          <option value="phishing">
            Phishing
          </option>
          <option value="malware">
            Malware
          </option>
          <option value="spam">
            Spam
          </option>
          <option value="inappropriate">
            Inappropriate
          </option>
          <option value="other">
            Other
          </option>
        </select>
        <p
          v-if="reasonError"
          id="reason-error"
          role="alert"
          class="mt-2 text-sm text-destructive"
        >
          {{ reasonError }}
        </p>

        <Label
          for="report-details"
          class="mb-1.5 mt-4"
        >
          Details
        </Label>
        <Textarea
          id="report-details"
          v-model="details"
          rows="4"
          maxlength="1000"
          class="rounded-xl px-3.5"
          :aria-invalid="Boolean(detailsError)"
          :aria-describedby="detailsDescribedBy"
        />
        <p
          id="details-hint"
          class="mt-1 text-sm text-muted-foreground"
        >
          Up to 1000 characters.
        </p>
        <p
          v-if="detailsError"
          id="details-error"
          role="alert"
          class="mt-2 text-sm text-destructive"
        >
          {{ detailsError }}
        </p>

        <p
          v-if="formError"
          id="report-error"
          role="alert"
          class="mt-4 text-sm text-destructive"
        >
          {{ formError }}
        </p>

        <Button
          type="submit"
          size="lg"
          class="mt-6 w-full"
          :disabled="pending"
        >
          Submit report
        </Button>
      </form>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiError } from '@/lib/api'

const REASONS = new Set(['phishing', 'malware', 'spam', 'inappropriate', 'other'])

const route = useRoute()
const slug = computed(() => (typeof route.query.slug === 'string' ? route.query.slug : ''))
const reason = ref('')
const details = ref('')
const reasonError = ref('')
const detailsError = ref('')
const formError = ref('')
const pending = ref(false)
const submitted = ref(false)

const detailsDescribedBy = computed(() => {
  if (detailsError.value) return 'details-error'
  return 'details-hint'
})

async function onSubmit() {
  reasonError.value = ''
  detailsError.value = ''
  formError.value = ''

  if (!REASONS.has(reason.value)) {
    reasonError.value = 'Choose a reason.'
    return
  }
  if (details.value.length > 1000) {
    detailsError.value = 'Keep details to 1000 characters.'
    return
  }
  if (!slug.value) {
    formError.value = 'This report needs a link.'
    return
  }

  pending.value = true
  try {
    await api.post('/api/reports', {
      slug: slug.value,
      reason: reason.value,
      details: details.value,
    })
    submitted.value = true
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.fields?.reason) reasonError.value = err.fields.reason
      if (err.fields?.details) detailsError.value = err.fields.details
      if (!err.fields?.reason && !err.fields?.details) {
        formError.value = err.code === 'not_found'
          ? 'This link was not found.'
          : err.message
      }
      return
    }
    formError.value = 'Could not send the report. Try again.'
  } finally {
    pending.value = false
  }
}
</script>
