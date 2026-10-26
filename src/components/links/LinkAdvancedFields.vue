<template>
  <details
    class="rounded-xl border border-g-border"
    open
  >
    <summary class="cursor-pointer px-4 py-3 text-sm font-semibold text-g-text">
      More options
    </summary>
    <div class="flex flex-col gap-4 px-4 pb-4">
      <div>
        <label
          class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
          for="link-expires"
        >
          Expires
        </label>
        <input
          id="link-expires"
          class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 outline-none transition-colors focus:border-g-accent dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
          type="datetime-local"
          :value="expiresAt"
          @input="onExpires"
        >
      </div>
      <div>
        <label
          class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
          for="link-password"
        >
          Password
        </label>
        <input
          id="link-password"
          autocomplete="new-password"
          class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 outline-none transition-colors focus:border-g-accent dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
          type="password"
          :value="password"
          @input="onPassword"
        >
      </div>
      <fieldset class="flex flex-col gap-3">
        <legend class="mb-1 text-sm font-medium text-gray-700 dark:text-slate-300">
          UTM tags
        </legend>
        <div
          v-for="field in fields"
          :key="field.id"
        >
          <label
            class="mb-1 block text-sm text-gray-600 dark:text-slate-400"
            :for="field.id"
          >
            {{ field.label }}
          </label>
          <input
            :id="field.id"
            class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-g-accent dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500"
            type="text"
            :value="utm[field.key]"
            @input="onUtm(field.key, $event)"
          >
        </div>
      </fieldset>
    </div>
  </details>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'

const props = defineProps<{
  url: string
  expiresAt: string
  password: string
}>()

const emit = defineEmits<{
  'update:url': [url: string]
  'update:expiresAt': [value: string]
  'update:password': [value: string]
}>()

const fields = [
  { id: 'utm-source', key: 'utm_source', label: 'Source' },
  { id: 'utm-medium', key: 'utm_medium', label: 'Medium' },
  { id: 'utm-campaign', key: 'utm_campaign', label: 'Campaign' },
  { id: 'utm-term', key: 'utm_term', label: 'Term' },
  { id: 'utm-content', key: 'utm_content', label: 'Content' },
] as const

type UtmKey = (typeof fields)[number]['key']

const utm = reactive<Record<UtmKey, string>>({
  utm_source: '',
  utm_medium: '',
  utm_campaign: '',
  utm_term: '',
  utm_content: '',
})

function readUtm(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return
  }
  for (const field of fields) {
    utm[field.key] = parsed.searchParams.get(field.key) ?? ''
  }
}

watch(() => props.url, (url) => { readUtm(url) }, { immediate: true })

function onExpires(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  emit('update:expiresAt', target.value)
}

function onPassword(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  emit('update:password', target.value)
}

function onUtm(key: UtmKey, event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  utm[key] = target.value
  emitUrl()
}

function emitUrl() {
  let parsed: URL
  try {
    parsed = new URL(props.url)
  } catch {
    return
  }
  for (const field of fields) {
    const value = utm[field.key].trim()
    if (value) parsed.searchParams.set(field.key, value)
    else parsed.searchParams.delete(field.key)
  }
  const next = parsed.toString()
  if (next !== props.url) emit('update:url', next)
}
</script>
