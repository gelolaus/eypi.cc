<template>
  <div class="relative w-full">
    <AppPage title="Attendee Selection">
      <template #description>
        <router-link to="/manage/tix" class="-ml-1 inline-flex min-h-11 items-center px-1 text-sm font-medium text-g-muted hover:text-g-accent">← My events</router-link>
        <span v-if="eventName" class="block text-sm text-g-muted">{{ eventName }}</span>
      </template>

    <!-- Step progress bar -->
    <div class="mb-8 flex items-center gap-1">
      <template v-for="(_step, i) in visibleSteps" :key="i">
        <div
          :class="[
            'h-1.5 flex-1 rounded-full transition-all duration-300',
            stepIndex >= i ? 'bg-[#34418F] dark:bg-slate-400' : 'bg-gray-200 dark:bg-slate-700',
          ]"
        />
      </template>
    </div>
    <p class="mb-6 text-sm font-medium text-g-muted">
      Step {{ stepIndex + 1 }} of {{ visibleSteps.length }}
    </p>

    <UploadStep
      v-if="currentStep === 'upload'"
      :file-name="csvFile?.name ?? ''"
      :row-count="allRows.length"
      :column-count="columnHeaders.length"
      :error="csvError"
      :uploading="uploading"
      @file="loadFile"
      @upload="uploadCsv"
    />

    <MapColumnsStep
      v-else-if="currentStep === 'map-columns'"
      :column-headers="columnHeaders"
      :map-error="mapError"
      :get-col-role="getColRole"
      :set-col-role="setColRole"
      @back="currentStep = 'upload'"
      @continue="confirmMapping"
    />

    <ClustersStep
      v-else-if="currentStep === 'clusters'"
      :column-mapping="columnMapping"
      :clusters="clusters"
      :cluster-raw-count="clusterRawCount"
      :total-cluster-max="totalClusterMax"
      :cluster-error="clusterError"
      :saving-clusters="savingClusters"
      :set-cluster-max="setClusterMax"
      @back="currentStep = 'map-columns'"
      @continue="saveClusters"
    />

    <CriteriaStep
      v-else-if="currentStep === 'cluster-filter' || currentStep === 'filter'"
      :clusters="clusters"
      :criteria-columns="criteriaColumns"
      :open-clusters="openClusters"
      :total-eligible="totalEligible"
      :saving-criteria="savingCriteria"
      :cluster-raw-count="clusterRawCount"
      :cluster-eligible-count="clusterEligibleCount"
      :unique-values-for-cluster="uniqueValuesForCluster"
      :unique-values="uniqueValues"
      :is-checked="isChecked"
      :count-in-cluster="countInCluster"
      :count-in-all="countInAll"
      :toggle-cluster-open="toggleClusterOpen"
      :toggle-filter="toggleFilter"
      @leave="leaveCriteria"
    />

    <GuaranteeStep
      v-else-if="currentStep === 'guarantee'"
      v-model="guaranteeSearch"
      :guarantee-search-results="guaranteeSearchResults"
      :guaranteed-row-ids="guaranteedRowIds"
      :column-mapping="columnMapping"
      :get-display-name="getDisplayName"
      :get-email="getEmail"
      :row-by-id="rowById"
      :add-guarantee="addGuarantee"
      :remove-guarantee="removeGuarantee"
      @back="backFromGuarantee"
      @continue="currentStep = 'confirm'"
    />

    <ConfirmStep
      v-else-if="currentStep === 'confirm'"
      v-model="maxAttendeesEdit"
      :clusters="clusters"
      :total-cluster-max="totalClusterMax"
      :guaranteed-row-ids="guaranteedRowIds"
      :global-eligible-rows="globalEligibleRows"
      :has-unfilled-clusters="hasUnfilledClusters"
      :finalizing="finalizing"
      :finalizing-label="finalizingLabel"
      :guaranteed-count-for-cluster="guaranteedCountForCluster"
      :raffle-pool-for-cluster="rafflePoolForCluster"
      :needs-raffle-for-cluster="needsRaffleForCluster"
      :unfilled-slots-for-cluster="unfilledSlotsForCluster"
      @back="currentStep = 'guarantee'"
      @finalize="finalize"
    />

  </section>
</template>

<script setup lang="ts">
import { api } from '@/lib/api'
import AppPage from '@/components/AppPage.vue'
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { TIX_QR_RENDER_OPTIONS } from '@/utils/tix-qr'
import { selectAttendees } from '@/lib/tix/selection'
import { acceptsSpreadsheetFile, MAX_SPREADSHEET_ROWS, parseSpreadsheet } from '@/lib/tix/spreadsheet'
import UploadStep from '@/components/tix/selection/UploadStep.vue'
import MapColumnsStep from '@/components/tix/selection/MapColumnsStep.vue'
import ClustersStep from '@/components/tix/selection/ClustersStep.vue'
import CriteriaStep from '@/components/tix/selection/CriteriaStep.vue'
import GuaranteeStep from '@/components/tix/selection/GuaranteeStep.vue'
import ConfirmStep from '@/components/tix/selection/ConfirmStep.vue'
import type { CsvRow, ColumnMapping, ClusterConfig } from '@/types/selection'

const route  = useRoute()
const router = useRouter()
const toast  = useToast()

const slug = route.params.id as string

// ── event meta ────────────────────────────────────────────────────────────────
const eventName = ref('')

// ── wizard state ──────────────────────────────────────────────────────────────
type Step = 'upload' | 'map-columns' | 'clusters' | 'cluster-filter' | 'filter' | 'guarantee' | 'confirm'
const currentStep = ref<Step>('upload')

const STEP_META: Record<Step, string> = {
  'upload':         'Upload CSV',
  'map-columns':    'Map Columns',
  'clusters':       'Configure Clusters',
  'cluster-filter': 'Criteria',
  'filter':         'Criteria',
  'guarantee':      'Guarantees',
  'confirm':        'Confirm',
}

// Steps we actually display in the progress bar
const visibleSteps = computed(() => {
  const hasClusters = !!columnMapping.value?.clusterCol
  const keys: Step[] = hasClusters
    ? ['upload', 'map-columns', 'clusters', 'cluster-filter', 'guarantee', 'confirm']
    : ['upload', 'map-columns', 'filter', 'guarantee', 'confirm']
  return keys.map(k => ({ key: k, label: STEP_META[k] }))
})
const stepIndex = computed(() => visibleSteps.value.findIndex(s => s.key === currentStep.value))

// ── CSV upload ────────────────────────────────────────────────────────────────
const csvFile   = ref<File | null>(null)
const csvError  = ref('')
const uploading = ref(false)
const allRows   = ref<CsvRow[]>([])
const columnHeaders = ref<string[]>([])

// ── column mapping ────────────────────────────────────────────────────────────
const columnMapping = ref<ColumnMapping | null>(null)
const colRoles      = ref<Record<string, string>>({})
const mapError      = ref('')

function getColRole(col: string): string {
  return colRoles.value[col] ?? 'criteria'
}
function setColRole(col: string, role: string) {
  // Only one email col, first/last/full, cluster allowed
  if (role === 'email') {
    for (const k of Object.keys(colRoles.value)) {
      if (colRoles.value[k] === 'email') colRoles.value[k] = 'criteria'
    }
  }
  if (role === 'cluster') {
    for (const k of Object.keys(colRoles.value)) {
      if (colRoles.value[k] === 'cluster') colRoles.value[k] = 'criteria'
    }
  }
  colRoles.value[col] = role
}

function buildMapping(): ColumnMapping {
  const roles = colRoles.value
  const emailCol     = Object.keys(roles).find(k => roles[k] === 'email') ?? columnHeaders.value[0]
  const firstNameCol = Object.keys(roles).find(k => roles[k] === 'first_name') ?? null
  const lastNameCol  = Object.keys(roles).find(k => roles[k] === 'last_name')  ?? null
  const fullNameCol  = Object.keys(roles).find(k => roles[k] === 'full_name')  ?? null
  const clusterCol   = Object.keys(roles).find(k => roles[k] === 'cluster')    ?? null
  const criteriaColumns = Object.keys(roles).filter(k => roles[k] === 'criteria')
  return { emailCol, firstNameCol, lastNameCol, fullNameCol, clusterCol, criteriaColumns }
}

function autoDetectRoles(headers: string[]): Record<string, string> {
  const n = (h: string) => h.toLowerCase().replace(/[\s_"'.?()-]/g, '')
  const roles: Record<string, string> = {}
  for (const h of headers) {
    const norm = n(h)
    if (norm.includes('email')) roles[h] = 'email'
    else if (['firstname', 'first', 'givenname'].includes(norm)) roles[h] = 'first_name'
    else if (['lastname', 'last', 'surname', 'familyname'].includes(norm)) roles[h] = 'last_name'
    else if (['fullname', 'name', 'completename'].includes(norm)) roles[h] = 'full_name'
    else roles[h] = 'criteria'
  }
  return roles
}


function loadFile(file: File) {
  csvError.value = ''
  if (!acceptsSpreadsheetFile(file.name)) {
    csvError.value = 'Please upload an .xlsx file.'
    return
  }
  const reader = new FileReader()
  reader.onload = async ev => {
    try {
      const buffer = ev.target?.result
      if (!(buffer instanceof ArrayBuffer)) throw new Error('Invalid file.')
      const { headers, rows } = await parseSpreadsheet(buffer)
      if (rows.length > MAX_SPREADSHEET_ROWS) throw new Error('Spreadsheets are limited to 5,000 rows.')
      if (!rows.length) throw new Error('No data rows found in the spreadsheet.')
      csvFile.value = file
      columnHeaders.value = headers
      allRows.value = rows.map((rawData, i) => ({ id: '', rowIndex: i, rawData }))
      colRoles.value = autoDetectRoles(headers)
    } catch (err: unknown) {
      csvError.value = err instanceof Error ? err.message : 'Invalid file.'
      csvFile.value = null
      allRows.value = []
    }
  }
  reader.readAsArrayBuffer(file)
}

async function uploadCsv() {
  if (!allRows.value.length) return
  if (allRows.value.length > MAX_SPREADSHEET_ROWS) {
    toast.error('Spreadsheets are limited to 5,000 rows.')
    return
  }
  uploading.value = true
  try {
    const mapping = buildMapping()
    const res = await api.raw(`/api/events/${slug}/upload-csv`, {
      method: 'POST',
      body: JSON.stringify({ rows: allRows.value.map(r => r.rawData), columnMapping: mapping }),
    })
    const data = await res.json() as { status: string; message?: string; error?: { message?: string }; rowIds?: string[] }
    if (!res.ok) throw new Error(data.message ?? data.error?.message ?? 'Upload failed.')
    if (data.rowIds) {
      allRows.value = allRows.value.map((r, i) => ({ ...r, id: data.rowIds![i] ?? r.id }))
    }
    columnMapping.value = mapping
    currentStep.value = 'map-columns'
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Upload failed.')
  } finally {
    uploading.value = false
  }
}

// ── mapping confirmation ──────────────────────────────────────────────────────
async function confirmMapping() {
  mapError.value = ''
  const emailCol = Object.keys(colRoles.value).find(k => colRoles.value[k] === 'email')
  if (!emailCol) { mapError.value = 'You must assign one column as Email.'; return }
  const mapping = buildMapping()
  columnMapping.value = mapping
  // Persist the confirmed mapping to DB so finalize uses the correct column names
  api.raw(`/api/events/${slug}/column-mapping`, {
    method: 'PATCH',
    body: JSON.stringify({
      emailCol:        mapping.emailCol,
      firstNameCol:    mapping.firstNameCol,
      lastNameCol:     mapping.lastNameCol,
      fullNameCol:     mapping.fullNameCol,
      clusterCol:      mapping.clusterCol,
      criteriaColumns: mapping.criteriaColumns,
    }),
  }).catch(() => { /* non-fatal; finalize body carries the mapping as well */ })
  currentStep.value = mapping.clusterCol ? 'clusters' : 'filter'
}

// ── clusters ──────────────────────────────────────────────────────────────────
const clusters      = ref<ClusterConfig[]>([])
const clusterError  = ref('')
const savingClusters = ref(false)
const openClusters  = ref<Set<string>>(new Set())

const totalClusterMax = computed(() => clusters.value.reduce((s, c) => s + (c.maxCount || 0), 0))

watch(() => columnMapping.value?.clusterCol, (col) => {
  if (!col) { clusters.value = []; return }
  // Build cluster list from unique values in that column
  const seen = new Set<string>()
  for (const row of allRows.value) {
    const v = row.rawData[col]?.trim()
    if (v) seen.add(v)
  }
  // Preserve existing maxCount/filters if cluster values haven't changed
  const existing = new Map(clusters.value.map(c => [c.value, c]))
  clusters.value = [...seen].map(v => existing.get(v) ?? { value: v, maxCount: 0, filters: {} })
})

function clusterRawCount(value: string): number {
  if (!columnMapping.value?.clusterCol) return 0
  const col = columnMapping.value.clusterCol
  return allRows.value.filter(r => r.rawData[col] === value).length
}

function setClusterMax(value: string, maxCount: number) {
  const cluster = clusters.value.find((item) => item.value === value)
  if (cluster) cluster.maxCount = maxCount
}

async function persistClusters() {
  const res = await api.raw(`/api/events/${slug}/clusters`, {
    method: 'POST',
    body: JSON.stringify({
      clusterCol: columnMapping.value!.clusterCol,
      clusters: clusters.value.map(c => ({ value: c.value, maxCount: c.maxCount, filters: c.filters })),
    }),
  })
  const data = await res.json() as { status: string; message?: string }
  if (!res.ok) throw new Error(data.message ?? 'Failed to save clusters.')
}

async function saveClusters() {
  clusterError.value = ''
  if (clusters.value.some(c => (c.maxCount ?? 0) <= 0)) {
    clusterError.value = 'All clusters must have a quota greater than 0.'
    return
  }
  savingClusters.value = true
  try {
    await persistClusters()
    currentStep.value = 'cluster-filter'
  } catch (err: unknown) {
    clusterError.value = err instanceof Error ? err.message : 'Failed to save.'
  } finally {
    savingClusters.value = false
  }
}

function toggleClusterOpen(value: string) {
  if (openClusters.value.has(value)) openClusters.value.delete(value)
  else openClusters.value.add(value)
}

// ── criteria filters ──────────────────────────────────────────────────────────
// Structure: Map<clusterValue | '__global__', Map<column, Set<allowedValues>>>
const filters = ref<Map<string, Map<string, Set<string>>>>(new Map())

const GLOBAL = '__global__'

function getFilterMap(clusterValue: string | null): Map<string, Set<string>> {
  const key = clusterValue ?? GLOBAL
  if (!filters.value.has(key)) filters.value.set(key, new Map())
  return filters.value.get(key)!
}

function isChecked(clusterValue: string | null, col: string, val: string): boolean {
  const m = getFilterMap(clusterValue)
  return m.get(col)?.has(val) ?? false
}

function toggleFilter(clusterValue: string | null, col: string, val: string) {
  const m = getFilterMap(clusterValue)
  if (!m.has(col)) m.set(col, new Set())
  const s = m.get(col)!
  if (s.has(val)) s.delete(val); else s.add(val)
  // Also update the ClusterConfig.filters for saving
  if (clusterValue) {
    const cl = clusters.value.find(c => c.value === clusterValue)
    if (cl) {
      if (!cl.filters[col]) cl.filters[col] = []
      if (s.has(val)) { if (!cl.filters[col].includes(val)) cl.filters[col].push(val) }
      else cl.filters[col] = cl.filters[col].filter(v => v !== val)
    }
  }
}

const criteriaColumns = computed(() => columnMapping.value?.criteriaColumns ?? [])

function uniqueValues(col: string): string[] {
  const seen = new Set<string>()
  for (const r of allRows.value) { const v = r.rawData[col]?.trim(); if (v) seen.add(v) }
  return [...seen].sort()
}

function uniqueValuesForCluster(col: string, clusterValue: string): string[] {
  if (!columnMapping.value?.clusterCol) return uniqueValues(col)
  const clusterCol = columnMapping.value.clusterCol
  const seen = new Set<string>()
  for (const r of allRows.value) {
    if (r.rawData[clusterCol] !== clusterValue) continue
    const v = r.rawData[col]?.trim(); if (v) seen.add(v)
  }
  return [...seen].sort()
}

function countInAll(col: string, val: string): number {
  return allRows.value.filter(r => r.rawData[col] === val).length
}

function countInCluster(col: string, val: string, clusterValue: string): number {
  if (!columnMapping.value?.clusterCol) return countInAll(col, val)
  const cc = columnMapping.value.clusterCol
  return allRows.value.filter(r => r.rawData[cc] === clusterValue && r.rawData[col] === val).length
}

function rowPassesFilters(row: CsvRow, clusterValue: string | null): boolean {
  const m = getFilterMap(clusterValue)
  for (const [col, vals] of m.entries()) {
    if (vals.size > 0 && !vals.has(row.rawData[col] ?? '')) return false
  }
  return true
}

function clusterEligibleCount(clusterValue: string): number {
  if (!columnMapping.value?.clusterCol) return 0
  const cc = columnMapping.value.clusterCol
  return allRows.value.filter(r => r.rawData[cc] === clusterValue && rowPassesFilters(r, clusterValue)).length
}

const globalEligibleRows = computed(() => {
  if (clusters.value.length) return []
  return allRows.value.filter(r => rowPassesFilters(r, null))
})

const totalEligible = computed(() => {
  if (clusters.value.length) return clusters.value.reduce((s, c) => s + clusterEligibleCount(c.value), 0)
  return globalEligibleRows.value.length
})

function backFromFilter() {
  currentStep.value = columnMapping.value?.clusterCol ? 'clusters' : 'map-columns'
}

const savingCriteria = ref(false)

function syncClusterFiltersFromMap() {
  for (const cl of clusters.value) {
    const selected = filters.value.get(cl.value)
    if (!selected) continue
    const record: Record<string, string[]> = {}
    for (const [col, vals] of selected) {
      if (vals.size > 0) record[col] = [...vals]
    }
    cl.filters = record
  }
}

function hydrateCriteriaFilters(clusterList: ClusterConfig[]) {
  const next = new Map<string, Map<string, Set<string>>>()
  for (const cl of clusterList) {
    const selected = new Map<string, Set<string>>()
    for (const [col, vals] of Object.entries(cl.filters ?? {})) {
      if (vals.length > 0) selected.set(col, new Set(vals))
    }
    next.set(cl.value, selected)
  }
  filters.value = next
}

async function leaveCriteria(direction: 'back' | 'forward') {
  syncClusterFiltersFromMap()
  if (clusters.value.length && columnMapping.value?.clusterCol) {
    savingCriteria.value = true
    try {
      await persistClusters()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save criteria.')
      return
    } finally {
      savingCriteria.value = false
    }
  }
  if (direction === 'back') backFromFilter()
  else currentStep.value = 'guarantee'
}

function globalFilterRecord(): Record<string, string[]> {
  const selected = filters.value.get(GLOBAL)
  const record: Record<string, string[]> = {}
  if (!selected) return record
  for (const [col, vals] of selected) {
    if (vals.size > 0) record[col] = [...vals]
  }
  return record
}

// ── guarantee ─────────────────────────────────────────────────────────────────
const guaranteeSearch        = ref('')
const guaranteedRowIds       = ref<Set<string>>(new Set())
const guaranteeSearchResults = computed(() => {
  const q = guaranteeSearch.value.trim().toLowerCase()
  if (!q) return []
  return allRows.value.filter(r => {
    const name  = getDisplayName(r).toLowerCase()
    const email = getEmail(r).toLowerCase()
    return name.includes(q) || email.includes(q)
  }).slice(0, 20)
})

function getDisplayName(row: CsvRow | undefined): string {
  if (!row) return ''
  const m = columnMapping.value
  if (!m) return ''
  if (m.firstNameCol && m.lastNameCol) return `${row.rawData[m.firstNameCol] ?? ''} ${row.rawData[m.lastNameCol] ?? ''}`.trim()
  if (m.fullNameCol) return row.rawData[m.fullNameCol] ?? ''
  return ''
}
function getEmail(row: CsvRow | undefined): string {
  if (!row || !columnMapping.value) return ''
  return row.rawData[columnMapping.value.emailCol] ?? ''
}
function rowById(id: string): CsvRow | undefined {
  return allRows.value.find(r => r.id === id)
}
function addGuarantee(id: string) {
  guaranteedRowIds.value.add(id)
}
function removeGuarantee(id: string) {
  guaranteedRowIds.value.delete(id)
}

function backFromGuarantee() {
  currentStep.value = columnMapping.value?.clusterCol ? 'cluster-filter' : 'filter'
}

// ── confirm / summary ─────────────────────────────────────────────────────────
const maxAttendeesEdit = ref<number | null>(null)

watch(totalClusterMax, (v) => { if (v > 0) maxAttendeesEdit.value = v })

function clusterForRow(rowId: string): string | null {
  const row = rowById(rowId)
  if (!row || !columnMapping.value?.clusterCol) return null
  return row.rawData[columnMapping.value.clusterCol] ?? null
}
function guaranteedCountForCluster(clusterValue: string): number {
  return [...guaranteedRowIds.value].filter(id => clusterForRow(id) === clusterValue).length
}
function eligibleNonGuaranteedForCluster(clusterValue: string): CsvRow[] {
  if (!columnMapping.value?.clusterCol) return []
  const cc = columnMapping.value.clusterCol
  return allRows.value.filter(r =>
    r.rawData[cc] === clusterValue &&
    !guaranteedRowIds.value.has(r.id) &&
    rowPassesFilters(r, clusterValue)
  )
}
function rafflePoolForCluster(clusterValue: string): number {
  return eligibleNonGuaranteedForCluster(clusterValue).length
}
function remainingSlotsForCluster(clusterValue: string): number {
  const cl = clusters.value.find(c => c.value === clusterValue)
  if (!cl) return 0
  return Math.max(0, (cl.maxCount ?? 0) - guaranteedCountForCluster(clusterValue))
}
function needsRaffleForCluster(clusterValue: string): boolean {
  return rafflePoolForCluster(clusterValue) > remainingSlotsForCluster(clusterValue)
}
function unfilledSlotsForCluster(clusterValue: string): number {
  const pool = rafflePoolForCluster(clusterValue)
  const slots = remainingSlotsForCluster(clusterValue)
  return Math.max(0, slots - pool)
}
const hasUnfilledClusters = computed(() => clusters.value.some(c => unfilledSlotsForCluster(c.value) > 0))

// ── raffle algorithm ──────────────────────────────────────────────────────────
function buildSelectedRows(): { rowId: string; clusterValue: string | null }[] {
  const mapping = columnMapping.value
  if (!mapping) return []
  syncClusterFiltersFromMap()
  const { selected } = selectAttendees(allRows.value, {
    mapping,
    clusters: clusters.value.map(cl => ({
      value: cl.value,
      maxCount: cl.maxCount,
      filters: cl.filters,
    })),
    globalFilters: globalFilterRecord(),
    guaranteed: [...guaranteedRowIds.value],
    seed: crypto.randomUUID(),
    maxAttendees: clusters.value.length ? null : maxAttendeesEdit.value,
  })
  const clusterCol = mapping.clusterCol
  return selected.filter(row => row.id).map(row => ({
    rowId: row.id,
    clusterValue: clusterCol ? (row.rawData[clusterCol] ?? null) : null,
  }))
}

// ── finalize ──────────────────────────────────────────────────────────────────
const finalizing      = ref(false)
const finalizingLabel = ref('Finalize & Generate QR Codes')

async function finalize() {
  finalizing.value = true
  finalizingLabel.value = 'Running raffle…'
  try {
    // If rows are missing server IDs (uploaded in this session without a refresh),
    // fetch them now before building the selected set.
    if (allRows.value.some(r => !r.id)) {
      const csvRes = await api.raw(`/api/events/${slug}/csv-data`)
      const csvData = await csvRes.json() as { status: string; rows: CsvRow[] }
      if (csvRes.ok && csvData.rows.length) allRows.value = csvData.rows
    }

    const selectedRows = buildSelectedRows()
    if (!selectedRows.length) throw new Error('No attendees selected.')

    finalizingLabel.value = 'Saving selection…'
    const res = await api.raw(`/api/events/${slug}/finalize`, {
      method: 'POST',
      body: JSON.stringify({
        selectedRows,
        maxAttendees: maxAttendeesEdit.value ?? null,
        columnMapping: columnMapping.value ? {
          emailCol:     columnMapping.value.emailCol,
          firstNameCol: columnMapping.value.firstNameCol,
          lastNameCol:  columnMapping.value.lastNameCol,
          fullNameCol:  columnMapping.value.fullNameCol,
        } : undefined,
      }),
    })
    const data = await res.json() as { status: string; message?: string; attendees?: { id: string; firstName: string; lastName: string; email: string; qrToken: string; clusterValue: string | null }[] }
    if (!res.ok) throw new Error(data.message ?? 'Finalization failed.')

    const attendees = data.attendees!
    finalizingLabel.value = `Generating ${attendees.length} QR codes…`

    const { default: QRCodeStyling } = await import('qr-code-styling')
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()

    for (const a of attendees) {
      const qr = new QRCodeStyling({
        width: 400, height: 400, type: 'canvas',
        data: a.qrToken,
        ...TIX_QR_RENDER_OPTIONS,
      })
      const blob = await qr.getRawData('png')
      if (blob) {
        const name = `${a.firstName}_${a.lastName}`.replace(/[^a-zA-Z0-9_]/g, '_')
        zip.file(`${name}.png`, blob)
      }
    }

    finalizingLabel.value = 'Preparing ZIP…'
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const link = document.createElement('a')
    link.href = url
    link.download = `${slug}-tickets.zip`
    link.click()
    URL.revokeObjectURL(url)

    toast.success(`${attendees.length} tickets generated. Redirecting to event…`)
    router.push(`/manage/tix/${slug}`)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Finalization failed.')
    finalizingLabel.value = 'Finalize & Generate QR Codes'
  } finally {
    finalizing.value = false
  }
}

// ── onMounted: load event info + resume if CSV already uploaded ───────────────
onMounted(async () => {
  // Fetch event name
  try {
    const res = await api.raw(`/api/events/${slug}`)
    const data = await res.json() as { status: string; event?: { name: string; isLead: boolean; selectionLocked: boolean } }
    if (res.ok && data.event) {
      eventName.value = data.event.name
      if (!data.event.isLead) { router.replace(`/manage/tix/${slug}`); return }
      if (data.event.selectionLocked) { router.replace(`/manage/tix/${slug}`); return }
    }
  } catch { /* ignore */ }

  // Try to resume from previously uploaded CSV
  try {
    const res = await api.raw(`/api/events/${slug}/csv-data`)
    const data = await res.json() as {
      status: string
      columnMapping: ColumnMapping | null
      rows: CsvRow[]
      clusters: ClusterConfig[]
    }
    if (res.ok && data.rows.length) {
      allRows.value = data.rows
      if (data.rows.length) {
        // Reconstruct column headers from the first row's keys
        columnHeaders.value = Object.keys(data.rows[0].rawData)
      }
      if (data.columnMapping) {
        columnMapping.value = data.columnMapping
        // Reconstruct colRoles from mapping
        const m = data.columnMapping
        const roles: Record<string, string> = {}
        for (const h of columnHeaders.value) roles[h] = 'criteria'
        if (m.emailCol)     roles[m.emailCol]     = 'email'
        if (m.firstNameCol) roles[m.firstNameCol] = 'first_name'
        if (m.lastNameCol)  roles[m.lastNameCol]  = 'last_name'
        if (m.fullNameCol)  roles[m.fullNameCol]  = 'full_name'
        if (m.clusterCol)   roles[m.clusterCol]   = 'cluster'
        for (const c of (m.criteriaColumns ?? [])) roles[c] = 'criteria'
        colRoles.value = roles
      }
      if (data.clusters.length) {
        clusters.value = data.clusters
        hydrateCriteriaFilters(data.clusters)
        currentStep.value = 'cluster-filter'
      } else if (data.columnMapping) {
        currentStep.value = 'filter'
      } else {
        currentStep.value = 'map-columns'
      }
    }
  } catch { /* fresh start */ }
})
</script>
