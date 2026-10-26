<template>
  <section>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <nav class="flex gap-2" aria-label="Report status">
        <button
          v-for="option in statuses"
          :key="option.value"
          type="button"
          :aria-pressed="status === option.value"
          :class="[
            'inline-flex min-h-[44px] items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            status === option.value
              ? 'bg-[#34418F] text-white dark:bg-slate-700 dark:text-slate-100'
              : 'bg-transparent text-gray-400 hover:text-[#34418F] dark:text-slate-400 dark:hover:text-slate-200',
          ]"
          data-cursor="nav"
          @click="setStatus(option.value)"
        >
          {{ option.label }}
        </button>
      </nav>
      <p class="text-sm text-g-muted">
        {{ reports.length }} {{ reports.length === 1 ? 'report' : 'reports' }}
      </p>
    </div>

    <div v-if="loading" class="mica-card h-40 animate-pulse rounded-3xl" aria-hidden="true" />

    <p v-else-if="reports.length === 0" class="rounded-2xl border border-g-border px-5 py-8 text-center text-sm text-g-muted">
      {{ status === 'open' ? 'No open reports. Nice.' : 'No resolved reports yet.' }}
    </p>

    <ul v-else class="space-y-4">
      <li
        v-for="report in reports"
        :key="report.id"
        class="rounded-2xl border border-g-border px-5 py-5"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <a
                :href="`/${report.slug}`"
                target="_blank"
                rel="noopener"
                class="text-data text-sm font-semibold text-g-primary hover:text-g-accent"
              >
                /{{ report.slug }}
              </a>
              <span class="rounded-full border border-g-border px-2 py-0.5 text-xs font-semibold text-g-muted">
                {{ reasonLabel(report.reason) }}
              </span>
              <span
                v-if="report.linkDisabled"
                class="rounded-full border border-red-500/60 px-2 py-0.5 text-xs font-semibold text-red-500"
              >
                Link disabled
              </span>
            </div>
            <p v-if="report.details" class="mt-3 whitespace-pre-line text-sm text-g-text">
              {{ report.details }}
            </p>
            <p class="mt-3 text-xs text-g-muted">
              Reported {{ formatDate(report.createdAt) }}
              <template v-if="report.ownerEmail">
                · owner {{ report.ownerEmail }}
              </template>
            </p>
            <p v-if="report.status === 'resolved'" class="mt-1 text-xs text-g-muted">
              {{ report.resolution === 'disable_link' ? 'Link disabled' : 'Dismissed' }}
              {{ report.resolvedAt ? `on ${formatDate(report.resolvedAt)}` : '' }}
            </p>
          </div>

          <div v-if="report.status === 'open'" class="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              class="min-h-[44px] rounded-lg border border-red-500/60 px-4 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-50"
              :disabled="busyId === report.id"
              :aria-label="`Disable /${report.slug} and resolve this report`"
              @click="resolve(report, 'disable_link')"
            >
              Disable link
            </button>
            <button
              type="button"
              class="min-h-[44px] rounded-lg border border-g-border px-4 py-2 text-xs font-semibold text-g-muted transition-colors hover:border-g-primary hover:text-g-primary disabled:opacity-50"
              :disabled="busyId === report.id"
              :aria-label="`Dismiss report for /${report.slug}`"
              @click="resolve(report, 'dismiss')"
            >
              Dismiss
            </button>
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
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
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
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
