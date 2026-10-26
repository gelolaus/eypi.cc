<template>
  <details
    class="rounded-xl border border-border"
    open
  >
    <summary class="min-h-11 cursor-pointer px-4 py-3 text-base font-semibold text-foreground">
      More options
    </summary>
    <div class="flex flex-col gap-4 px-4 pb-4">
      <div class="space-y-1.5">
        <Label for="link-expires">
          Expires
        </Label>
        <Input
          id="link-expires"
          type="datetime-local"
          :model-value="expiresAt"
          @input="onExpires"
        />
      </div>
      <div class="space-y-1.5">
        <Label for="link-password">
          Password
        </Label>
        <Input
          id="link-password"
          autocomplete="new-password"
          type="password"
          :model-value="password"
          @input="onPassword"
        />
      </div>
      <fieldset class="flex flex-col gap-3">
        <legend class="mb-1 text-base font-medium text-foreground">
          UTM tags
        </legend>
        <div
          v-for="field in fields"
          :key="field.id"
          class="space-y-1.5"
        >
          <Label
            class="text-muted-foreground"
            :for="field.id"
          >
            {{ field.label }}
          </Label>
          <Input
            :id="field.id"
            class="font-mono text-sm"
            type="text"
            :model-value="utm[field.key]"
            @input="onUtm(field.key, $event)"
          />
        </div>
      </fieldset>
    </div>
  </details>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
