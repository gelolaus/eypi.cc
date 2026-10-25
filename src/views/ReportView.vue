<template>
  <section
    class="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden px-4 py-24"
  >
    <div
      class="mica-card relative w-full max-w-md rounded-3xl border border-gray-200 p-8 dark:border-slate-600"
    >
      <div
        class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
        aria-hidden="true"
      />
      <div
        class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
        aria-hidden="true"
      />
      <div
        class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
        aria-hidden="true"
      />
      <div
        class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner"
        aria-hidden="true"
      />

      <h1 class="text-section-title mb-2 text-center text-[#34418F] dark:text-slate-200">
        Report a link
      </h1>
      <p
        v-if="slug"
        class="text-data mb-6 text-center text-sm text-gray-500 dark:text-slate-400"
      >
        {{ slug }}
      </p>

      <p
        v-if="submitted"
        role="status"
        class="text-center text-sm leading-relaxed text-gray-600 dark:text-slate-300"
      >
        Thanks. We'll review this link.
      </p>

      <form
        v-else
        class="flex flex-col"
        @submit.prevent="onSubmit"
      >
        <label
          for="report-reason"
          class="mb-1 text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Reason
        </label>
        <select
          id="report-reason"
          v-model="reason"
          class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
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
          class="mt-1 text-sm text-red-500"
        >
          {{ reasonError }}
        </p>

        <label
          for="report-details"
          class="mb-1 mt-4 text-sm font-medium text-gray-700 dark:text-slate-300"
        >
          Details
        </label>
        <textarea
          id="report-details"
          v-model="details"
          rows="4"
          maxlength="1000"
          class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 outline-none transition-colors focus:border-[#34418F] dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
          :aria-invalid="Boolean(detailsError)"
          :aria-describedby="detailsDescribedBy"
        />
        <p
          id="details-hint"
          class="mt-1 text-sm text-gray-500 dark:text-slate-400"
        >
          Up to 1000 characters.
        </p>
        <p
          v-if="detailsError"
          id="details-error"
          role="alert"
          class="mt-1 text-sm text-red-500"
        >
          {{ detailsError }}
        </p>

        <p
          v-if="formError"
          id="report-error"
          role="alert"
          class="mt-4 text-sm text-red-500"
        >
          {{ formError }}
        </p>

        <button
          type="submit"
          class="mt-6 w-full rounded-lg bg-[#DEAC4B] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
          :disabled="pending"
        >
          Submit report
        </button>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
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
