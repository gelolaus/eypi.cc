<template>
  <div class="w-full">
    <div class="space-y-3 md:mica-card md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-g-border">
      <div
        v-if="loading && items.length === 0"
        class="space-y-3"
        role="status"
      >
        <span class="sr-only">Loading links</span>
        <div
          v-for="n in 3"
          :key="n"
          aria-hidden="true"
          class="h-28 rounded-3xl bg-g-border motion-safe:animate-pulse"
        ></div>
      </div>
      <template v-else-if="items.length > 0">
        <LinkRow
          v-for="link in items"
          :key="link.id"
          :link="link"
          :selected="selectedIds.includes(link.id)"
          @analytics="emit('analytics', link)"
          @copy="emit('copy', link)"
          @delete="emit('delete', link)"
          @disable="emit('disable', link)"
          @edit="emit('edit', link)"
          @enable="emit('enable', link)"
          @toggle="emit('toggle', link.id, $event)"
        />
      </template>
      <div
        v-else
        class="rounded-2xl border border-g-border px-6 py-16 text-center md:border-0"
      >
        <h2 class="text-sm font-semibold text-gray-500 dark:text-slate-400">
          {{ filtered ? 'No matching links' : 'No links yet' }}
        </h2>
        <p
          v-if="!filtered"
          class="mx-auto mt-2 max-w-md text-sm text-gray-400 dark:text-slate-500"
        >
          Create a short link with New link.
        </p>
      </div>
    </div>
    <button
      v-if="hasMore"
      class="btn-secondary mt-4 w-full sm:w-auto"
      type="button"
      :disabled="loading"
      @click="emit('load-more')"
    >
      Load more
    </button>
  </div>
</template>

<script setup lang="ts">
import LinkRow from '@/components/links/LinkRow.vue'
import type { LinkListItem } from '@/composables/useLinks'

defineProps<{
  items: LinkListItem[]
  selectedIds: string[]
  loading: boolean
  hasMore: boolean
  filtered: boolean
}>()

const emit = defineEmits<{
  toggle: [id: string, checked: boolean]
  copy: [link: LinkListItem]
  analytics: [link: LinkListItem]
  edit: [link: LinkListItem]
  delete: [link: LinkListItem]
  disable: [link: LinkListItem]
  enable: [link: LinkListItem]
  'load-more': []
}>()
</script>
