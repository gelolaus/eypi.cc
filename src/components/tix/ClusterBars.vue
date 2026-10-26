<template>
  <div class="mb-6">
    <Button
      type="button"
      variant="ghost"
      class="mb-2 -ml-2 gap-1 px-2 text-muted-foreground"
      @click="showClusters = !showClusters"
    >
      <span>{{ showClusters ? '▼' : '▶' }}</span> Clusters
    </Button>
    <div v-if="showClusters" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Card
        v-for="cluster in clusters"
        :key="cluster.value"
        data-cluster-bar
        class="gap-0 py-0"
      >
        <div class="flex flex-1 items-start justify-between gap-3 px-4 py-2.5">
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold leading-tight text-foreground">{{ cluster.value }}</p>
            <p class="flex flex-wrap items-center gap-1 font-mono text-xs text-muted-foreground">
              <span>{{ cluster.currentCount }}</span>
              <span>/</span>
              <template v-if="editingMaxCluster === cluster.value">
                <Input
                  v-model.number="clusterMaxEditValue"
                  type="number"
                  :aria-label="`Max for ${cluster.value}`"
                  min="1"
                  placeholder="∞"
                  class="w-20"
                  @keydown.enter="saveClusterMax(cluster.value)"
                  @keydown.escape="editingMaxCluster = ''"
                  @blur="saveClusterMax(cluster.value)"
                />
              </template>
              <template v-else>
                <span>{{ cluster.maxCount ?? '∞' }}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="h-11 min-w-11 font-mono text-xs text-muted-foreground"
                  title="Edit max"
                  @click="startEditClusterMax(cluster.value, cluster.maxCount)"
                >
                  Edit
                </Button>
              </template>
              <span v-if="(cluster.remainingSlots ?? 0) > 0" class="text-primary">({{ cluster.remainingSlots }} open)</span>
            </p>
          </div>
          <Button
            v-if="cluster.id && (cluster.remainingSlots ?? 0) > 0"
            type="button"
            variant="secondary"
            :disabled="rafflingCluster === cluster.value"
            class="min-w-11 shrink-0 font-mono text-xs font-bold uppercase tracking-wide"
            @click="reRaffle(cluster.value)"
          >
            {{ rafflingCluster === cluster.value ? '…' : 'Re-raffle' }}
          </Button>
        </div>
        <div v-if="cluster.maxCount" class="h-1 w-full bg-muted">
          <div
            data-cluster-fill
            class="h-1 rounded-full transition-all duration-500"
            :style="`background-color: var(--chart-1); width: ${Math.min(100, ((cluster.currentCount ?? 0) / cluster.maxCount) * 100)}%`"
          />
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
