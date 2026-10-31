<template>
  <div class="relative w-full">
    <PageSkeleton v-if="initialLoading" />
    <AppPage
      v-else
      title="Links"
      description="Create, search, and manage your short links."
    >
      <div
        v-if="hasLinks"
        class="mb-6 flex flex-col gap-3 sm:flex-row"
      >
        <Button
          class="sm:order-2"
          type="button"
          @click="openCreate"
        >
          New link
        </Button>
        <Button
          class="sm:order-1"
          variant="outline"
          type="button"
          @click="exportCsv"
        >
          Export CSV
        </Button>
      </div>
      <p
        v-if="quotaMessage"
        class="mb-4 text-base text-destructive"
        role="alert"
      >
        {{ quotaMessage }}
      </p>
      <p
        v-if="pageError"
        class="mb-4 text-base text-destructive"
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
        @create="openCreate"
        @delete="deleteLink"
        @disable="setDisabled($event, true)"
        @edit="openEdit"
        @enable="setDisabled($event, false)"
        @load-more="loadMore"
        @toggle="toggleSelected"
      />
      <div
        v-if="selectedIds.length"
        data-bulk-bar
        class="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-popover py-3 pl-3 pr-20 shadow-lg lg:bottom-0"
      >
        <p class="text-base text-muted-foreground">
          {{ selectedIds.length }} selected
        </p>
        <Button
          aria-label="Disable selected"
          variant="outline"
          type="button"
          @click="disableSelected"
        >
          Disable selected
        </Button>
        <Button
          aria-label="Delete selected"
          variant="destructive"
          type="button"
          @click="confirmBulkDelete"
        >
          Delete selected
        </Button>
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
import { copyShortLink } from '@/lib/copyShortLink'
import { activeOrgHeaders, activeOrgId, previousKey, reinsert, runWithUndo } from '@/composables/useUndoToast'
import {
  linksKey,
  useLinks,
  type LinkListItem,
  type LinkSort,
  type LinkStatusFilter,
} from '@/composables/useLinks'
import { Button } from '@/components/ui/button'
import AppPage from '@/components/layout/AppPage.vue'
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
// The header actions only hide when the account has no links at all. A filter that matches
// nothing, a reload in flight, or a failed load keeps them so the header never flickers or vanishes.
const hasLinks = computed(() => items.value.length > 0 || filtered.value || loading.value || Boolean(error.value))

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
  await copyShortLink(link.slug)
}

// Delete waits out the undo window before it is sent, so nothing is lost if Undo is tapped.
// Reverts work per link id so overlapping Undo actions never undo each other.
function deleteLink(link: LinkListItem) {
  const prev = previousKey(items.value, link.id, (row) => row.id)
  const wasSelected = selectedIds.value.includes(link.id)
  const headers = activeOrgHeaders()
  const orgId = activeOrgId()
  const same = () => activeOrgId() === orgId
  runWithUndo({
    message: 'Link deleted.',
    apply: () => {
      items.value = items.value.filter((item) => item.id !== link.id)
      selectedIds.value = selectedIds.value.filter((id) => id !== link.id)
    },
    revert: () => {
      if (!same()) return
      items.value = reinsert(items.value, link, prev, (row) => row.id)
      if (wasSelected && !selectedIds.value.includes(link.id)) selectedIds.value = [...selectedIds.value, link.id]
    },
    commit: () => remove(link.id, { headers }),
  })
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

function disableSelected() {
  const ids = selectedIds.value.slice()
  if (ids.length === 0) return
  const stamp = new Date().toISOString()
  const headers = activeOrgHeaders()
  const orgId = activeOrgId()
  const same = () => activeOrgId() === orgId
  const changed = new Map<string, { disabledAt: string | null; disabledReason: string | null }>()
  runWithUndo({
    message: ids.length === 1 ? 'Link disabled.' : `${ids.length} links disabled.`,
    apply: () => {
      items.value = items.value.map((item) => {
        if (!ids.includes(item.id) || item.disabledAt) return item
        changed.set(item.id, { disabledAt: item.disabledAt, disabledReason: item.disabledReason })
        return { ...item, disabledAt: stamp, disabledReason: 'user' }
      })
      selectedIds.value = selectedIds.value.filter((id) => !ids.includes(id))
    },
    revert: () => {
      if (!same()) return
      items.value = items.value.map((item) => {
        const original = changed.get(item.id)
        return original ? { ...item, ...original } : item
      })
      selectedIds.value = [...selectedIds.value, ...ids.filter((id) => !selectedIds.value.includes(id))]
    },
    commit: () => bulk('disable', ids, { headers }),
  })
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
