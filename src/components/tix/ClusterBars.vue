<template>
  <div class="mb-6">
    <button
      type="button"
      class="mb-2 flex items-center gap-1 text-sm font-medium text-gray-400 transition-colors hover:text-[#34418F] dark:text-slate-500 dark:hover:text-slate-300"
      @click="showClusters = !showClusters"
    >
      <span>{{ showClusters ? '▼' : '▶' }}</span> Clusters
    </button>
    <div v-if="showClusters" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div
        v-for="cluster in clusters"
        :key="cluster.value"
        class="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-600 dark:bg-slate-800/60"
      >
        <div class="flex flex-1 items-start justify-between gap-3 px-4 py-2.5">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold leading-tight text-gray-800 dark:text-slate-200">{{ cluster.value }}</p>
            <p class="flex items-center gap-1 font-mono text-xs text-gray-500 dark:text-slate-400">
              <span>{{ cluster.currentCount }}</span>
              <span>/</span>
              <template v-if="editingMaxCluster === cluster.value">
                <input
                  v-model.number="clusterMaxEditValue"
                  type="number"
                  :aria-label="`Max for ${cluster.value}`"
                  min="1"
                  placeholder="∞"
                  class="w-14 rounded border border-[#34418F] px-1 py-0 font-mono text-xs outline-none dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200"
                  @keydown.enter="saveClusterMax(cluster.value)"
                  @keydown.escape="editingMaxCluster = ''"
                  @blur="saveClusterMax(cluster.value)"
                />
              </template>
              <template v-else>
                <span>{{ cluster.maxCount ?? '∞' }}</span>
                <button
                  type="button"
                  class="font-mono text-[0.6rem] text-gray-400 transition-colors hover:text-[#34418F] dark:text-slate-500 dark:hover:text-slate-300"
                  title="Edit max"
                  @click="startEditClusterMax(cluster.value, cluster.maxCount)"
                >
                  Edit
                </button>
              </template>
              <span v-if="(cluster.remainingSlots ?? 0) > 0" class="text-amber-500">({{ cluster.remainingSlots }} open)</span>
            </p>
          </div>
          <button
            v-if="cluster.id && (cluster.remainingSlots ?? 0) > 0"
            type="button"
            :disabled="rafflingCluster === cluster.value"
            class="flex-shrink-0 rounded-lg px-2.5 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-wide transition-colors"
            :class="rafflingCluster === cluster.value
              ? 'cursor-not-allowed bg-gray-100 text-gray-400 opacity-50 dark:bg-slate-700 dark:text-slate-500'
              : 'bg-[#34418F]/10 text-[#34418F] hover:bg-[#34418F] hover:text-white dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'"
            @click="reRaffle(cluster.value)"
          >
            {{ rafflingCluster === cluster.value ? '…' : 'Re-raffle' }}
          </button>
        </div>
        <div v-if="cluster.maxCount" class="h-1 w-full bg-gray-100 dark:bg-slate-700">
          <div
            class="h-1 rounded-full bg-[#34418F] transition-all duration-500 dark:bg-slate-400"
            :style="`width: ${Math.min(100, ((cluster.currentCount ?? 0) / cluster.maxCount) * 100)}%`"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { api } from '@/lib/api'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import { downloadAttendeeQr } from '@/lib/tix/qrFiles'

export interface EventClusterBar {
  id?: string | null
  value: string
  maxCount: number | null
  currentCount?: number
  remainingSlots?: number | null
}

const props = defineProps<{
  slug: string
  clusters: EventClusterBar[]
}>()

const emit = defineEmits<{ updated: [] }>()

const toast = useToast()
const dialog = useDialog()
const showClusters = ref(true)
const editingMaxCluster = ref('')
const clusterMaxEditValue = ref<number | null>(null)
const rafflingCluster = ref('')

function startEditClusterMax(value: string, current: number | null) {
  editingMaxCluster.value = value
  clusterMaxEditValue.value = current
}

async function saveClusterMax(value: string) {
  if (editingMaxCluster.value !== value) return
  editingMaxCluster.value = ''
  try {
    const res = await api.raw(`/api/events/${props.slug}/clusters/${encodeURIComponent(value)}/max-count`, {
      method: 'PATCH',
      body: JSON.stringify({ maxCount: clusterMaxEditValue.value ?? null }),
    })
    if (!res.ok) throw new Error((await res.json() as { message?: string }).message ?? 'Failed.')
    toast.success('Max updated.')
    emit('updated')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Update failed.')
  }
}

async function reRaffle(clusterValue: string) {
  const ok = await dialog.confirm({
    title: 'Re-raffle this cluster?',
    body: `Randomly adds attendees to "${clusterValue}" from unselected eligible respondents.`,
    confirmLabel: 'Re-raffle cluster',
    requireText: clusterValue,
  })
  if (!ok) return
  rafflingCluster.value = clusterValue
  try {
    const res = await api.raw(`/api/events/${props.slug}/clusters/${encodeURIComponent(clusterValue)}/raffle`, {
      method: 'POST',
    })
    const data = await res.json() as {
      message?: string
      attendees?: { id: string; firstName: string; lastName: string; qrToken: string }[]
    }
    if (!res.ok) throw new Error(data.message ?? 'Re-raffle failed.')
    for (const attendee of data.attendees ?? []) {
      await downloadAttendeeQr(attendee)
    }
    toast.success(`${data.attendees?.length ?? 0} new attendee(s) added to ${clusterValue}.`)
    emit('updated')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Re-raffle failed.')
  } finally {
    rafflingCluster.value = ''
  }
}
</script>
