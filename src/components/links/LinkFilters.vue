<template>
  <div class="mb-6 grid w-full grid-cols-2 gap-3 md:flex md:flex-row">
    <div class="col-span-2 md:flex-1">
      <Label
        class="mb-1.5"
        for="link-search"
      >
        Search
      </Label>
      <Input
        id="link-search"
        aria-label="Search links"
        placeholder="Search slug or destination"
        type="search"
        :model-value="query"
        @input="onQuery"
      />
    </div>
    <div>
      <Label
        class="mb-1.5"
        for="link-sort"
      >
        Sort
      </Label>
      <select
        id="link-sort"
        class="h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover [&>option]:text-popover-foreground md:min-w-40"
        :value="sort"
        @change="onSort"
      >
        <option value="new">
          Newest
        </option>
        <option value="old">
          Oldest
        </option>
        <option value="clicks">
          Most clicks
        </option>
      </select>
    </div>
    <div>
      <Label
        class="mb-1.5"
        for="link-status"
      >
        Status
      </Label>
      <select
        id="link-status"
        class="h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover [&>option]:text-popover-foreground md:min-w-40"
        :value="status"
        @change="onStatus"
      >
        <option value="all">
          All
        </option>
        <option value="active">
          Active
        </option>
        <option value="expired">
          Expired
        </option>
        <option value="disabled">
          Disabled
        </option>
        <option value="protected">
          Protected
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { LinkSort, LinkStatusFilter } from '@/composables/useLinks'

defineProps<{
  query: string
  sort: LinkSort
  status: LinkStatusFilter
}>()

const emit = defineEmits<{
  'update:query': [value: string]
  'update:sort': [value: LinkSort]
  'update:status': [value: LinkStatusFilter]
}>()

function onQuery(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  emit('update:query', target.value)
}

function onSort(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) return
  const value = target.value
  if (value === 'new' || value === 'old' || value === 'clicks') emit('update:sort', value)
}

function onStatus(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLSelectElement)) return
  const value = target.value
  if (value === 'all' || value === 'active' || value === 'expired' || value === 'disabled' || value === 'protected') {
    emit('update:status', value)
  }
}
</script>
