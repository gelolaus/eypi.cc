<template>
  <section>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="w-full max-w-xs">
        <label for="admin-audit-action" class="mb-2 block text-xs font-semibold uppercase tracking-wide text-g-muted">
          Action
        </label>
        <select
          id="admin-audit-action"
          v-model="action"
          class="control"
          @change="load(true)"
        >
          <option value="">
            All actions
          </option>
          <option v-for="option in actions" :key="option" :value="option">
            {{ actionLabel(option) }}
          </option>
        </select>
      </div>
      <p class="text-sm text-g-muted">
        {{ events.length }} {{ events.length === 1 ? 'entry' : 'entries' }}
      </p>
    </div>

    <div v-if="loading" class="mica-card h-40 animate-pulse rounded-3xl" aria-hidden="true" />

    <p v-else-if="events.length === 0" class="rounded-2xl border border-g-border px-5 py-8 text-center text-sm text-g-muted">
      No audit events yet.
    </p>

    <div v-else class="space-y-3 md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-g-border">
      <div>
        <div class="hidden grid-cols-12 border-b border-g-border bg-g-surface px-4 py-3 text-xs font-semibold text-g-muted md:grid">
          <div class="col-span-3">Action</div>
          <div class="col-span-3">Actor</div>
          <div class="col-span-3">Target</div>
          <div class="col-span-2">When</div>
          <div class="col-span-1 text-right">Meta</div>
        </div>
        <div
          v-for="event in events"
          :key="event.id"
          data-admin-row
          class="flex flex-col gap-3 rounded-2xl border border-g-border bg-g-surface p-4 md:grid md:grid-cols-12 md:items-start md:gap-0 md:rounded-none md:border-0 md:border-b md:bg-transparent md:last:border-0 md:hover:bg-white/30 dark:md:hover:bg-mica-navy-row-hover"
        >
          <div class="min-w-0 md:col-span-3">
            <p class="text-sm font-semibold text-g-text">{{ actionLabel(event.action) }}</p>
            <p class="text-data text-xs text-g-muted">{{ event.action }}</p>
          </div>
          <div class="text-data min-w-0 truncate text-xs text-g-muted md:col-span-3" :title="event.actorEmail ?? event.actorUserId">
            {{ event.actorEmail ?? event.actorUserId ?? 'Unknown' }}
          </div>
          <div class="min-w-0 md:col-span-3">
            <p class="text-xs font-semibold text-g-muted">{{ event.targetType ?? '—' }}</p>
            <p class="text-data truncate text-xs text-g-muted" :title="event.targetId ?? ''">
              {{ event.targetId ?? '' }}
            </p>
          </div>
          <div class="text-data text-xs text-g-muted md:col-span-2">{{ formatDate(event.createdAt) }}</div>
          <div class="flex md:col-span-1 md:justify-end">
            <button
              v-if="event.meta !== null"
              type="button"
              class="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-g-primary hover:text-g-accent md:text-xs"
              :aria-label="`Show details for ${actionLabel(event.action)}`"
              :aria-expanded="expanded === event.id"
              @click="toggle(event.id)"
            >
              {{ expanded === event.id ? 'Hide' : 'Show' }}
            </button>
          </div>
          <div v-if="expanded === event.id && event.meta !== null" class="md:col-span-12 md:mt-3">
            <pre class="text-data overflow-x-auto rounded-lg border border-g-border bg-white/40 p-3 text-xs text-g-muted dark:bg-mica-navy-header">{{ formatMeta(event.meta) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div v-if="nextCursor" class="mt-6 flex justify-center">
      <button
        type="button"
        class="btn-secondary"
        :disabled="loadingMore"
       
        @click="load(false)"
      >
        {{ loadingMore ? 'Loading...' : 'Load more' }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { formatManilaDateTime } from '@/lib/manilaTime'
import { useToast } from '@/composables/useToast'

interface AuditEvent {
  id: string
  actorUserId: string
  actorEmail: string | null
  action: string
  targetType: string | null
  targetId: string | null
  meta: unknown
  createdAt: string
}

interface AuditPage {
  items: AuditEvent[]
  nextCursor: string | null
}

const actions = [
  'user.role',
  'user.disable',
  'user.enable',
  'user.logout',
  'user.delete',
  'link.disable',
  'report.resolve',
  'org.create',
  'org.update',
  'org.transfer',
  'org.delete',
]

const actionLabels: Record<string, string> = {
  'user.role': 'Role changed',
  'user.disable': 'User disabled',
  'user.enable': 'User enabled',
  'user.logout': 'User signed out',
  'user.delete': 'User deleted',
  'link.disable': 'Link disabled',
  'report.resolve': 'Report resolved',
  'org.create': 'Organization created',
  'org.update': 'Organization updated',
  'org.transfer': 'Ownership transferred',
  'org.delete': 'Organization deleted',
}

const toast = useToast()

const events = ref<AuditEvent[]>([])
const action = ref('')
const nextCursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const expanded = ref<string | null>(null)
let requestId = 0

function actionLabel(value: string): string {
  return actionLabels[value] ?? value
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function formatDate(value: string): string {
  if (!value) return 'unknown'
  return formatManilaDateTime(value)
}

function formatMeta(meta: unknown): string {
  if (typeof meta === 'string') return meta
  try {
    return JSON.stringify(meta, null, 2)
  } catch {
    return String(meta)
  }
}

function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
}

async function load(reset: boolean) {
  const id = ++requestId
  if (reset) {
    loading.value = true
    nextCursor.value = null
    expanded.value = null
  } else {
    loadingMore.value = true
  }
  try {
    const params = new URLSearchParams()
    if (action.value) params.set('action', action.value)
    if (!reset && nextCursor.value) params.set('cursor', nextCursor.value)
    const suffix = params.toString()
    const data = await api.get<AuditPage>(`/api/admin/audit${suffix ? `?${suffix}` : ''}`)
    if (id !== requestId) return
    events.value = reset ? data.items : [...events.value, ...data.items]
    nextCursor.value = data.nextCursor
  } catch (err) {
    if (id === requestId) toast.error(messageOf(err, 'Could not load the audit log.'))
  } finally {
    if (id === requestId) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

onMounted(() => {
  void load(true)
})
</script>
