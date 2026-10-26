<template>
  <section>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <nav class="flex min-w-0 gap-2 overflow-x-auto" aria-label="Report status">
        <Button
          v-for="option in statuses"
          :key="option.value"
          type="button"
          :variant="status === option.value ? 'secondary' : 'ghost'"
          :aria-pressed="status === option.value"
          class="shrink-0"
          @click="setStatus(option.value)"
        >
          {{ option.label }}
        </Button>
      </nav>
      <p class="text-sm text-muted-foreground">
        {{ reports.length }} {{ reports.length === 1 ? 'report' : 'reports' }}
      </p>
    </div>

    <div v-if="loading" class="h-40 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />

    <p v-else-if="reports.length === 0" class="rounded-2xl border border-border px-5 py-8 text-center text-sm text-muted-foreground">
      {{ status === 'open' ? 'No open reports. Nice.' : 'No resolved reports yet.' }}
    </p>

    <ul v-else class="space-y-4">
      <li
        v-for="report in reports"
        :key="report.id"
        data-admin-row
        class="rounded-2xl border border-border bg-card p-4 sm:px-5 sm:py-5"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <a
                :href="`/${report.slug}`"
                target="_blank"
                rel="noopener"
                class="font-mono inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:text-foreground"
              >
                /{{ report.slug }}
              </a>
              <Badge variant="outline">
                {{ reasonLabel(report.reason) }}
              </Badge>
              <Badge
                v-if="report.linkDisabled"
                variant="destructive"
              >
                Link disabled
              </Badge>
            </div>
            <p v-if="report.details" class="mt-3 whitespace-pre-line text-sm text-foreground">
              {{ report.details }}
            </p>
            <p class="mt-3 text-xs text-muted-foreground">
              Reported {{ formatDate(report.createdAt) }}
              <template v-if="report.ownerEmail">
                · owner {{ report.ownerEmail }}
              </template>
            </p>
            <p v-if="report.status === 'resolved'" class="mt-1 text-xs text-muted-foreground">
              {{ report.resolution === 'disable_link' ? 'Link disabled' : 'Dismissed' }}
              {{ report.resolvedAt ? `on ${formatDate(report.resolvedAt)}` : '' }}
            </p>
          </div>

          <div v-if="report.status === 'open'" class="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              variant="destructive"
              :disabled="busyId === report.id"
              :aria-label="`Disable /${report.slug} and resolve this report`"
              @click="resolve(report, 'disable_link')"
            >
              Disable link
            </Button>
            <Button
              type="button"
              variant="outline"
              :disabled="busyId === report.id"
              :aria-label="`Dismiss report for /${report.slug}`"
              @click="resolve(report, 'dismiss')"
            >
              Dismiss
            </Button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { formatManilaDate } from '@/lib/manilaTime'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'

type Status = 'open' | 'resolved'
type Resolution = 'disable_link' | 'dismiss'

interface AdminReport {
  id: string
  linkId: string | null
  slug: string
  reason: string
  details: string | null
  status: Status
  resolution: Resolution | null
  createdAt: string
  resolvedAt: string | null
  resolvedBy: string | null
  ownerEmail: string | null
  linkSlug: string | null
  linkDisabled: boolean
}

interface ReportsPage {
  items: AdminReport[]
}

const statuses: { value: Status; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
]

const toast = useToast()
const dialog = useDialog()

const status = ref<Status>('open')
const reports = ref<AdminReport[]>([])
const loading = ref(true)
const busyId = ref<string | null>(null)
let requestId = 0

const reasonLabels: Record<string, string> = {
  spam: 'Spam',
  phishing: 'Phishing',
  malware: 'Malware',
  abuse: 'Abuse',
  other: 'Other',
}

function reasonLabel(reason: string): string {
  return reasonLabels[reason] ?? reason
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function formatDate(value: string): string {
  if (!value) return 'unknown'
  return formatManilaDate(value)
}

async function load() {
  const id = ++requestId
  loading.value = true
  try {
    const data = await api.get<ReportsPage>(`/api/admin/reports?status=${status.value}`)
    if (id !== requestId) return
    reports.value = data.items
  } catch (err) {
    if (id === requestId) toast.error(messageOf(err, 'Could not load reports.'))
  } finally {
    if (id === requestId) loading.value = false
  }
}

function setStatus(next: Status) {
  if (status.value === next) return
  status.value = next
  void load()
}

onMounted(() => {
  void load()
})

async function resolve(report: AdminReport, action: Resolution) {
  const ok = await dialog.confirm({
    title: action === 'disable_link' ? 'Disable this link?' : 'Dismiss this report?',
    body: action === 'disable_link'
      ? `Takes /${report.slug} offline immediately for abuse and marks the report resolved.`
      : `Closes the report for /${report.slug} without changing the link.`,
    confirmLabel: action === 'disable_link' ? 'Disable link' : 'Dismiss report',
  })
  if (!ok) return
  busyId.value = report.id
  try {
    const data = await api.post<{ item: { status: Status; resolution: Resolution; resolvedAt: string } }>(
      `/api/admin/reports/${encodeURIComponent(report.id)}/resolve`,
      { action },
    )
    report.status = data.item.status
    report.resolution = data.item.resolution
    report.resolvedAt = data.item.resolvedAt
    if (action === 'disable_link') report.linkDisabled = true
    toast.success(action === 'disable_link' ? `/${report.slug} was disabled.` : 'Report dismissed.')
    if (status.value === 'open') {
      reports.value = reports.value.filter((item) => item.id !== report.id)
    }
  } catch (err) {
    toast.error(messageOf(err, 'Could not resolve the report.'))
  } finally {
    busyId.value = null
  }
}
</script>
