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
          class="w-full rounded-lg border border-g-border bg-transparent px-3 py-2.5 text-sm text-g-text"
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

    <div v-else class="overflow-x-auto rounded-2xl border border-g-border">
      <div class="min-w-[820px]">
        <div class="grid grid-cols-12 border-b border-g-border bg-white/40 px-4 py-3 text-xs font-semibold text-g-muted dark:bg-mica-navy-header">
          <div class="col-span-3">Action</div>
          <div class="col-span-3">Actor</div>
          <div class="col-span-3">Target</div>
          <div class="col-span-2">When</div>
          <div class="col-span-1 text-right">Meta</div>
        </div>
        <div
          v-for="event in events"
          :key="event.id"
          class="grid grid-cols-12 items-start border-b border-g-border px-4 py-4 last:border-0 hover:bg-white/30 dark:hover:bg-mica-navy-row-hover"
        >
          <div class="col-span-3 min-w-0">
            <p class="text-sm font-semibold text-g-text">{{ actionLabel(event.action) }}</p>
            <p class="text-data text-xs text-g-muted">{{ event.action }}</p>
          </div>
          <div class="text-data col-span-3 min-w-0 truncate text-xs text-g-muted" :title="event.actorEmail ?? event.actorUserId">
            {{ event.actorEmail ?? event.actorUserId ?? 'Unknown' }}
          </div>
          <div class="col-span-3 min-w-0">
            <p class="text-xs font-semibold text-g-muted">{{ event.targetType ?? '—' }}</p>
            <p class="text-data truncate text-xs text-g-muted" :title="event.targetId ?? ''">
              {{ event.targetId ?? '' }}
            </p>
          </div>
          <div class="text-data col-span-2 text-xs text-g-muted">{{ formatDate(event.createdAt) }}</div>
          <div class="col-span-1 flex justify-end">
            <button
              v-if="event.meta !== null"
              type="button"
              class="text-xs font-semibold text-g-primary hover:text-g-accent"
              :aria-label="`Show details for ${actionLabel(event.action)}`"
              :aria-expanded="expanded === event.id"
              @click="toggle(event.id)"
            >
              {{ expanded === event.id ? 'Hide' : 'Show' }}
            </button>
          </div>
          <div v-if="expanded === event.id && event.meta !== null" class="col-span-12 mt-3">
            <pre class="text-data overflow-x-auto rounded-lg border border-g-border bg-white/40 p-3 text-xs text-g-muted dark:bg-mica-navy-header">{{ formatMeta(event.meta) }}</pre>
          </div>
        </div>
      </div>
    </div>

    <div v-if="nextCursor" class="mt-6 flex justify-center">
      <button
        type="button"
        class="rounded-full border border-g-border px-5 py-2.5 text-sm font-semibold text-g-muted transition-colors hover:border-g-accent hover:text-g-text disabled:opacity-50"
        :disabled="loadingMore"
        data-cursor="nav"
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
]

const actionLabels: Record<string, string> = {
  'user.role': 'Role changed',
  'user.disable': 'User disabled',
  'user.enable': 'User enabled',
  'user.logout': 'User signed out',
  'user.delete': 'User deleted',
  'link.disable': 'Link disabled',
  'report.resolve': 'Report resolved',
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
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
