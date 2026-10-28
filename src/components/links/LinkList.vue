<template>
  <div class="w-full">
    <div class="flex flex-col gap-3">
      <ListSkeleton
        v-if="loading && items.length === 0"
        :rows="3"
        :row-height="112"
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
        class="items-center px-6 py-16 text-center"
      >
        <h2 class="text-base font-semibold text-foreground">
          {{ filtered ? 'No matching links' : 'No links yet' }}
        </h2>
        <p
          v-if="!filtered"
          class="mx-auto max-w-md text-base text-muted-foreground"
        >
          Create a short link with New link.
        </p>
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
  'load-more': []
}>()
</script>
