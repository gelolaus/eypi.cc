<template>
  <div class="flex flex-col gap-3 rounded-2xl border border-g-border bg-g-surface p-4 md:flex-row md:items-center md:rounded-none md:border-0 md:border-b md:bg-transparent md:px-6 md:last:border-0">
    <label
      data-select-hit
      class="flex size-11 shrink-0 cursor-pointer items-center justify-center"
    >
      <input
        class="size-5 accent-g-accent"
        type="checkbox"
        :aria-label="`Select ${link.slug}`"
        :checked="selected"
        @change="onToggle"
      >
    </label>
    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="font-mono text-base font-bold text-g-primary dark:text-slate-200">
          eypi.cc/{{ link.slug }}
        </span>
        <span
          v-for="badge in badges"
          :key="badge"
          class="rounded-full border border-g-border px-2 py-0.5 text-xs text-g-muted"
        >
          {{ badge }}
        </span>
      </div>
      <p
        class="truncate font-mono text-sm text-gray-500 dark:text-slate-400"
        :title="link.url"
      >
        {{ host }}
      </p>
      <p class="text-data mt-1 text-xs text-g-muted">
        {{ link.clicks }} clicks
        <span v-if="created"> · {{ created }}</span>
      </p>
    </div>
    <div class="flex shrink-0 flex-wrap items-center gap-1">
      <button
        aria-label="Copy link"
        class="min-h-11 min-w-11 rounded-full px-3 text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-600/30"
        type="button"
        @click="emit('copy')"
      >
        Copy
      </button>
      <button
        aria-label="Analytics"
        class="min-h-11 min-w-11 rounded-full px-3 text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-600/30"
        type="button"
        @click="emit('analytics')"
      >
        Analytics
      </button>
      <button
        aria-label="Edit"
        class="min-h-11 min-w-11 rounded-full px-3 text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-600/30"
        type="button"
        @click="emit('edit')"
      >
        Edit
      </button>
      <button
        v-if="!moderatorLocked"
        class="min-h-11 rounded-full px-3 text-sm text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-600/30"
        type="button"
        :aria-label="link.disabledAt ? `Enable ${link.slug}` : `Disable ${link.slug}`"
        @click="link.disabledAt ? emit('enable') : emit('disable')"
      >
        {{ link.disabledAt ? 'Enable' : 'Disable' }}
      </button>
      <button
        aria-label="Delete"
        class="min-h-11 min-w-11 rounded-full px-3 text-red-500 hover:bg-gray-100 dark:hover:bg-slate-600/30"
        type="button"
        @click="emit('delete')"
      >
        Delete
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { linkBadges, type LinkListItem } from '@/composables/useLinks'

const props = defineProps<{
  link: LinkListItem
  selected: boolean
}>()

const emit = defineEmits<{
  toggle: [checked: boolean]
  copy: []
  analytics: []
  edit: []
  delete: []
  disable: []
  enable: []
}>()

const badges = computed(() => linkBadges(props.link))
const moderatorLocked = computed(() =>
  props.link.disabledReason === 'admin' || props.link.disabledReason === 'abuse',
)

const host = computed(() => {
  try {
    return new URL(props.link.url).host
  } catch {
    return props.link.url
  }
})

const created = computed(() => {
  if (!props.link.createdAt) return ''
  const date = new Date(props.link.createdAt)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
})

function onToggle(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  emit('toggle', target.checked)
}
</script>
