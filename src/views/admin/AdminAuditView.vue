<template>
  <section>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="w-full max-w-xs">
        <Label
          for="admin-audit-action"
          class="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Action
        </Label>
        <select
          id="admin-audit-action"
          v-model="action"
          class="h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover [&>option]:text-popover-foreground"
          @change="load(true)"
        >
          <option value="">
            All actions
          </option>
          <option
            v-for="option in actions"
            :key="option"
            :value="option"
          >
            {{ actionLabel(option) }}
          </option>
        </select>
      </div>
      <p class="text-sm text-muted-foreground">
        {{ events.length }} {{ events.length === 1 ? 'entry' : 'entries' }}
      </p>
    </div>

    <ListSkeleton
      v-if="loading"
      :rows="6"
      :row-height="226"
      :md-row-height="77"
      :radius="16"
    />

    <p
      v-else-if="events.length === 0"
      class="rounded-2xl border border-border px-5 py-8 text-center text-sm text-muted-foreground"
    >
      No audit events yet.
    </p>

    <div
      v-else
      class="md:overflow-hidden md:rounded-2xl md:border md:border-border"
    >
      <div class="overflow-x-auto">
        <div class="space-y-3 md:min-w-3xl md:space-y-0">
          <div class="hidden grid-cols-12 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground md:grid">
            <div class="col-span-3">
              Action
            </div>
            <div class="col-span-3">
              Actor
            </div>
            <div class="col-span-3">
              Target
            </div>
            <div class="col-span-2">
              When
            </div>
            <div class="col-span-1 text-right">
              Meta
            </div>
          </div>
          <div
            v-for="event in events"
            :key="event.id"
            data-admin-row
            class="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:grid md:grid-cols-12 md:items-start md:gap-0 md:rounded-none md:border-0 md:border-b md:bg-transparent md:last:border-0 md:hover:bg-muted/40"
          >
            <div class="min-w-0 md:col-span-3">
              <p class="text-sm font-semibold text-foreground">
                {{ actionLabel(event.action) }}
              </p>
              <p class="font-mono text-xs text-muted-foreground">
                {{ event.action }}
              </p>
            </div>
            <div
              class="font-mono min-w-0 truncate text-xs text-muted-foreground md:col-span-3"
              :title="event.actorEmail ?? event.actorUserId"
            >
              {{ event.actorEmail ?? event.actorUserId ?? 'Unknown' }}
            </div>
            <div class="min-w-0 md:col-span-3">
              <p class="text-xs font-semibold text-muted-foreground">
                {{ event.targetType ?? 'None' }}
              </p>
              <p
                class="font-mono truncate text-xs text-muted-foreground"
                :title="event.targetId ?? ''"
              >
                {{ event.targetId ?? '' }}
              </p>
            </div>
            <div class="font-mono text-xs text-muted-foreground md:col-span-2">
              {{ formatDate(event.createdAt) }}
            </div>
            <div class="flex md:col-span-1 md:justify-end">
              <Button
                v-if="event.meta !== null"
                type="button"
                variant="ghost"
                :aria-label="`Show details for ${actionLabel(event.action)}`"
                :aria-expanded="expanded === event.id"
                @click="toggle(event.id)"
              >
                {{ expanded === event.id ? 'Hide' : 'Show' }}
              </Button>
            </div>
            <div
              v-if="expanded === event.id && event.meta !== null"
              class="md:col-span-12 md:mt-3"
            >
              <pre class="font-mono overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">{{ formatMeta(event.meta) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="nextCursor"
      class="mt-6 flex justify-center"
    >
      <Button
        type="button"
        variant="outline"
        :disabled="loadingMore"
        @click="load(false)"
      >
        {{ loadingMore ? 'LOADING...' : 'Load more' }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import ListSkeleton from '@/components/skeletons/ListSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
  'media.variants': 'Image optimized',
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
