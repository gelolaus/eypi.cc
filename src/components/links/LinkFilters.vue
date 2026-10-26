<template>
  <div class="mb-6 grid w-full grid-cols-2 gap-3 md:flex md:flex-row">
    <div class="col-span-2 md:flex-1">
      <label
        class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
        for="link-search"
      >
        Search
      </label>
      <input
        id="link-search"
        aria-label="Search links"
        class="control h-11"
        placeholder="Search slug or destination"
        type="search"
        :value="query"
        @input="onQuery"
      >
    </div>
    <div>
      <label
        class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
        for="link-sort"
      >
        Sort
      </label>
      <select
        id="link-sort"
        class="control h-11 md:min-w-40"
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
      <label
        class="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300"
        for="link-status"
      >
        Status
      </label>
      <select
        id="link-status"
        class="control h-11 md:min-w-40"
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
