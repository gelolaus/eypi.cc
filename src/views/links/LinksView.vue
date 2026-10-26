<template>
  <div class="relative w-full">
    <PageSkeleton v-if="initialLoading" />
    <AppPage
      v-else
      title="Links"
      description="Create, search, and manage your short links."
    >
      <div class="mb-6 flex flex-col gap-3 sm:flex-row">
        <button
          class="btn-gold min-h-11 rounded-xl px-5 text-base font-semibold sm:order-2"
          type="button"
          @click="openCreate"
        >
          New link
        </button>
        <button
          class="btn-secondary sm:order-1"
          type="button"
          @click="exportCsv"
        >
          Export CSV
        </button>
      </div>
      <p
        v-if="quotaMessage"
        class="mb-4 text-sm text-red-500"
        role="alert"
      >
        {{ quotaMessage }}
      </p>
      <p
        v-if="pageError"
        class="mb-4 text-sm text-red-500"
        role="alert"
      >
        {{ pageError }}
      </p>
      <LinkFilters
        :query="query"
        :sort="sort"
        :status="status"
        @update:query="onQuery"
        @update:sort="onSort"
        @update:status="onStatus"
      />
      <LinkList
        :filtered="filtered"
        :has-more="Boolean(nextCursor)"
        :items="items"
        :loading="loading"
        :selected-ids="selectedIds"
        @analytics="openAnalytics"
        @copy="copyLink"
        @delete="confirmDelete"
        @disable="setDisabled($event, true)"
        @edit="openEdit"
        @enable="setDisabled($event, false)"
        @load-more="loadMore"
        @toggle="toggleSelected"
      />
      <div
        v-if="selectedIds.length"
        data-bulk-bar
        class="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-g-border bg-g-surface py-3 pl-3 pr-20 shadow-lg lg:bottom-0"
      >
        <p class="text-sm text-g-muted">
          {{ selectedIds.length }} selected
        </p>
        <button
          aria-label="Disable selected"
          class="btn-secondary"
          type="button"
          @click="confirmBulkDisable"
        >
          Disable selected
        </button>
        <button
          aria-label="Delete selected"
          class="btn-secondary border-red-500 text-red-500"
          type="button"
          @click="confirmBulkDelete"
        >
          Delete selected
        </button>
      </div>
    </AppPage>
    <Teleport to="body">
      <LinkEditorPanel
        :destination="draftDestination"
        :link-id="editingId"
        :open="editorOpen"
        @close="closeEditor"
      />
      <AnalyticsPanel
        v-if="analyticsOpen"
        :is-open="true"
        :link-id="analyticsId"
        :short-url="analyticsShort"
        @close="analyticsOpen = false"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onScopeDispose, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/lib/api'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import {
  linksKey,
  useLinks,
  type LinkListItem,
  type LinkSort,
  type LinkStatusFilter,
} from '@/composables/useLinks'
import AppPage from '@/components/AppPage.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import LinkFilters from '@/components/links/LinkFilters.vue'
import LinkList from '@/components/links/LinkList.vue'
import LinkEditorPanel from '@/components/links/LinkEditorPanel.vue'

const AnalyticsPanel = defineAsyncComponent(() =>
  import('@/components/AnalyticsPanel.vue').then((mod) => mod.default),
)

const route = useRoute()
const dialog = useDialog()
const toast = useToast()
const links = useLinks()
provide(linksKey, links)

const {
  items,
  nextCursor,
  loading,
  error,
  quotaMessage,
  query,
  sort,
  status,
  load,
  loadMore,
  update,
  remove,
  bulk,
} = links

const selectedIds = ref<string[]>([])
const initialDestination = typeof route.query.url === 'string' ? route.query.url : ''
const editorOpen = ref(initialDestination.length > 0)
const editingId = ref<string | null>(null)
const draftDestination = ref(initialDestination)
const analyticsOpen = ref(false)
const analyticsId = ref<string | null>(null)
const analyticsShort = ref('')
const pageError = ref('')
const initialLoading = ref(true)
let searchTimer: ReturnType<typeof setTimeout> | undefined

const filtered = computed(() => query.value.trim().length > 0 || status.value !== 'all')

function prefillFromRoute() {
  const value = route.query.url
  if (typeof value !== 'string' || !value) return
  draftDestination.value = value
  editingId.value = null
  editorOpen.value = true
}

function openCreate() {
  editingId.value = null
  draftDestination.value = ''
  editorOpen.value = true
}

function openEdit(link: LinkListItem) {
  editingId.value = link.id
  draftDestination.value = link.url
  editorOpen.value = true
}

function closeEditor() {
  editorOpen.value = false
  editingId.value = null
}

function openAnalytics(link: LinkListItem) {
  analyticsId.value = link.id
  analyticsShort.value = `eypi.cc/${link.slug}`
  analyticsOpen.value = true
}

function toggleSelected(id: string, checked: boolean) {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value = [...selectedIds.value, id]
    return
  }
  selectedIds.value = selectedIds.value.filter((item) => item !== id)
}

async function reload() {
  selectedIds.value = []
  await load()
}

function onQuery(value: string) {
  query.value = value
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { void reload() }, 300)
}

function onSort(value: LinkSort) {
  sort.value = value
  void reload()
}

function onStatus(value: LinkStatusFilter) {
  status.value = value
  void reload()
}

async function copyLink(link: LinkListItem) {
  try {
    await navigator.clipboard.writeText(`https://eypi.cc/${link.slug}`)
    toast.success('Link copied.')
  } catch {
    toast.error('Could not copy the link.')
  }
}

async function confirmDelete(link: LinkListItem) {
  const ok = await dialog.confirm({
    title: 'Delete this link?',
    body: `Removes eypi.cc/${link.slug}. This cannot be undone.`,
    confirmLabel: 'Delete link',
  })
  if (!ok) return
  try {
    await remove(link.id)
    selectedIds.value = selectedIds.value.filter((id) => id !== link.id)
    toast.success('Link deleted.')
  } catch {
    toast.error('Could not delete the link.')
  }
}

async function confirmBulkDelete() {
  const count = selectedIds.value.length
  const ok = await dialog.confirm({
    title: `Delete ${count} links?`,
    body: 'Deleted links stop redirecting. This cannot be undone.',
    confirmLabel: 'Delete',
  })
  if (!ok) return
  try {
    await bulk('delete', selectedIds.value)
    selectedIds.value = []
    toast.success('Links deleted.')
  } catch {
    toast.error('Could not delete the selected links.')
  }
}

async function confirmBulkDisable() {
  const count = selectedIds.value.length
  const ok = await dialog.confirm({
    title: `Disable ${count} links?`,
    body: 'Disabled links stop redirecting until you enable them.',
    confirmLabel: 'Disable',
  })
  if (!ok) return
  try {
    await bulk('disable', selectedIds.value)
    selectedIds.value = []
    toast.success('Links disabled.')
  } catch {
    toast.error('Could not disable the selected links.')
  }
}

async function setDisabled(link: LinkListItem, disabled: boolean) {
  if (!disabled && (link.disabledReason === 'admin' || link.disabledReason === 'abuse')) {
    pageError.value = 'A moderator disabled this link.'
    return
  }
  try {
    await update(link.id, { disabled })
    pageError.value = ''
  } catch {
    pageError.value = disabled ? 'Could not disable this link.' : 'Could not enable this link.'
  }
}

async function exportCsv() {
  try {
    const res = await api.raw('/api/links/export.csv')
    if (!res.ok) {
      toast.error('Could not export links.')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'links.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  } catch {
    toast.error('Could not export links.')
  }
}

watch(() => route.query.url, () => { prefillFromRoute() })
watch(error, (value) => { pageError.value = value })

onMounted(() => {
  prefillFromRoute()
  void load().finally(() => { initialLoading.value = false })
})

onScopeDispose(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>
