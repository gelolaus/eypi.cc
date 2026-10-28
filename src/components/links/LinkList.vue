<template>
  <div class="w-full">
    <div class="flex flex-col gap-3">
      <ListSkeleton
        v-if="loading && items.length === 0"
        :rows="3"
        :row-height="212"
        :md-row-height="100"
        label="Loading links"
      />
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
      <Card
        v-else
        class="rounded-3xl p-0"
      >
        <EmptyState
          :title="filtered ? 'No matching links' : 'No links yet'"
          :body="filtered ? 'Try another search term or status filter.' : 'Create a short link and share it anywhere.'"
          :action="filtered ? null : { label: 'Create a link', onClick: () => emit('create') }"
        />
      </Card>
    </div>
    <Button
      v-if="hasMore"
      class="mt-4 w-full sm:w-auto"
      variant="outline"
      type="button"
      :disabled="loading"
      @click="emit('load-more')"
    >
      Load more
    </Button>
  </div>
</template>

<script setup lang="ts">
import ListSkeleton from '@/components/skeletons/ListSkeleton.vue'
import EmptyState from '@/components/EmptyState.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  create: []
  'load-more': []
}>()
</script>
