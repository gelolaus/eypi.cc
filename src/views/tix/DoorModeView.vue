<template>
  <AppPage
    title="Door mode"
    description="Scan guests in. Check-ins are saved on this device and sent when the connection is back."
  >
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <Button
          as-child
          variant="outline"
        >
          <router-link :to="`/manage/tix/${slug}`">
            ← Event
          </router-link>
        </Button>
        <p
          data-door-counters
          class="font-mono text-sm text-muted-foreground"
        >
          <span class="font-semibold text-foreground">{{ shown.checkedIn }}</span> of {{ shown.confirmed }} checked in
          <template v-if="live && online">
            · {{ live.last10min }} in the last 10 min
          </template>
        </p>
      </div>

      <div
        v-if="banner"
        data-door-banner
        role="status"
        class="rounded-2xl border border-border bg-accent px-4 py-3 text-base font-medium"
      >
        {{ banner }}
      </div>

      <p
        v-if="notice"
        data-door-notice
        role="status"
        class="rounded-2xl border border-border px-4 py-3 text-sm text-muted-foreground"
      >
        {{ notice }}
      </p>

      <div
        v-if="loadError"
        role="alert"
        class="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-base text-destructive"
      >
        {{ loadError }}
      </div>

      <template v-if="state === 'ready'">
        <div class="grid gap-4 lg:grid-cols-2">
          <ScannerPanel
            :slug="slug"
            emit-only
            @scan="onScan"
          />

          <div class="space-y-4">
            <div
              role="status"
              aria-live="assertive"
              aria-atomic="true"
              data-door-result-region
            >
              <div
                v-if="result"
                :key="result.seq"
                data-door-result
                :data-result="result.kind"
                :class="RESULT_CLASS[result.kind]"
                class="rounded-3xl px-5 py-8 text-center"
              >
                <p class="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {{ RESULT_TEXT[result.kind] }}
                </p>
                <p
                  v-if="result.name"
                  class="mt-2 text-xl"
                >
                  {{ result.name }}
                </p>
              </div>
              <p
                v-else
                class="rounded-3xl border border-dashed border-border px-5 py-8 text-center text-base text-muted-foreground"
              >
                Waiting for the first scan.
              </p>
            </div>

            <section
              v-if="conflicts.length"
              data-door-conflicts
              class="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-4"
            >
              <h2 class="text-base font-semibold text-destructive">
                Check these guests
              </h2>
              <ul class="space-y-1 text-sm">
                <li
                  v-for="conflict in conflicts"
                  :key="conflict.id"
                >
                  <span class="font-medium">{{ conflict.name }}</span>: {{ conflict.message }}
                </li>
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                @click="dismissConflicts"
              >
                Dismiss
              </Button>
            </section>

            <section class="space-y-2">
              <label
                for="door-search"
                class="text-base font-semibold"
              >Find a guest by name</label>
              <Input
                id="door-search"
                v-model="query"
                type="search"
                autocomplete="off"
                placeholder="Type a name"
              />
              <ul
                v-if="hits.length"
                class="divide-y divide-border rounded-2xl border border-border"
              >
                <li
                  v-for="hit in hits"
                  :key="hit.id"
                  class="flex items-center justify-between gap-3 px-4 py-2"
                >
                  <span class="min-w-0 truncate text-base">{{ hit.firstName }} {{ hit.lastName }}</span>
                  <Button
                    type="button"
                    size="sm"
                    :variant="hit.checkedIn ? 'secondary' : 'default'"
                    :disabled="hit.checkedIn"
                    @click="checkInManually(hit.id)"
                  >
                    {{ hit.checkedIn ? 'Checked in' : 'Check in' }}
                  </Button>
                </li>
              </ul>
              <p
                v-else-if="query.trim()"
                class="text-sm text-muted-foreground"
              >
                No guest matches that name.
              </p>
            </section>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-door-clear
            @click="clearOfflineData"
          >
            Clear offline data
          </Button>
          <p class="text-sm text-muted-foreground">
            Removes the guest list and any unsent check-ins from this device.
          </p>
        </div>
      </template>

      <div
        v-else-if="state === 'cleared'"
        class="space-y-3"
      >
        <p class="text-base text-muted-foreground">
          Offline data removed from this device.
        </p>
        <Button
          type="button"
          @click="start"
        >
          Download the guest list again
        </Button>
      </div>

      <Button
        v-else-if="state === 'failed'"
        type="button"
        @click="start"
      >
        Try again
      </Button>

      <p
        v-else-if="state === 'loading'"
        class="text-base text-muted-foreground"
      >
        Loading the guest list…
      </p>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppPage from '@/components/layout/AppPage.vue'
import ScannerPanel from '@/components/tix/ScannerPanel.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDialog } from '@/composables/useDialog'
import { api } from '@/lib/api'
import {
  openDoorStore,
  type DoorConflict,
  type DoorStore,
  type RosterRow,
  type ScanOutcome,
  type ScanReturn,
  type SyncResult,
} from '@/lib/tix/doorStore'

const SYNC_EVERY_MS = 5000
const LIVE_EVERY_MS = 10_000
const SYNC_BATCH = 100
const MAX_BACKOFF_MS = 60_000

const RESULT_TEXT: Record<ScanOutcome, string> = {
  ok: 'Checked in',
  already: 'Already checked in',
  unknown: 'Not on the guest list',
  not_confirmed: 'Not confirmed',
}
// Colour never carries the result alone: every card also says it in words.
const RESULT_CLASS: Record<ScanOutcome, string> = {
  ok: 'bg-emerald-700 text-white',
  already: 'bg-amber-700 text-white',
  unknown: 'bg-destructive text-white',
  not_confirmed: 'bg-destructive text-white',
}
const VIBRATION: Record<ScanOutcome, number | number[]> = {
  ok: 60,
  already: [50, 60, 50],
  unknown: 400,
  not_confirmed: 400,
}

interface ShownResult { kind: ScanOutcome; name: string; seq: number }
interface LiveCounts { confirmed: number; checkedIn: number; last10min: number }

const route = useRoute()
const slug = route.params.id as string
const dialog = useDialog()

const state = ref<'loading' | 'ready' | 'failed' | 'cleared'>('loading')
const loadError = ref('')
const notice = ref('')
const store = shallowRef<DoorStore | null>(null)
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const pendingCount = ref(0)
const local = ref({ confirmed: 0, checkedIn: 0 })
const live = ref<LiveCounts | null>(null)
const conflicts = ref<DoorConflict[]>([])
const result = ref<ShownResult | null>(null)
const query = ref('')
const hits = ref<RosterRow[]>([])

let seq = 0
let syncing = false
let failures = 0
let backoffUntil = 0
let etag = ''
let syncTimer: ReturnType<typeof setInterval> | null = null
let liveTimer: ReturnType<typeof setInterval> | null = null
let wakeLock: { release: () => Promise<void> } | null = null
let unmounted = false

const shown = computed(() => (online.value && live.value ? live.value : local.value))

const banner = computed(() => {
  const n = pendingCount.value
  if (!online.value) return `Offline — ${n} ${n === 1 ? 'check-in' : 'check-ins'} waiting to sync`
  if (n > 0) return `${n} ${n === 1 ? 'check-in' : 'check-ins'} waiting to sync`
  return ''
})

function refreshLocal() {
  const s = store.value
  if (!s) return
  local.value = s.counts()
  pendingCount.value = s.pendingCount()
  conflicts.value = s.conflicts()
  hits.value = s.search(query.value)
}

function show(out: ScanReturn) {
  seq += 1
  const name = out.attendee ? `${out.attendee.firstName} ${out.attendee.lastName}`.trim() : ''
  result.value = { kind: out.result, name, seq }
  try {
    navigator.vibrate?.(VIBRATION[out.result])
  } catch { /* haptics are optional */ }
  refreshLocal()
  if (out.result === 'ok') void syncOnce()
}

function onScan(token: string) {
  if (!store.value) return
  show(store.value.scan(token, new Date()))
}

function checkInManually(attendeeId: string) {
  if (!store.value) return
  show(store.value.checkInAttendee(attendeeId, new Date()))
}

function dismissConflicts() {
  store.value?.dismissConflicts()
  refreshLocal()
}

watch(query, () => { hits.value = store.value?.search(query.value) ?? [] })

/** True when the door has a guest list to work from: fresh from the server or saved on this device. */
async function loadRoster(s: DoorStore): Promise<boolean> {
  try {
    const res = await api.raw(`/api/events/${slug}/roster`)
    if (res.ok) {
      const data = await res.json() as { attendees: RosterRow[]; generatedAt?: string }
      s.loadRoster(data.attendees, data.generatedAt)
      notice.value = ''
      return true
    }
    if (res.status === 403 || res.status === 404) {
      loadError.value = 'You can not open the door for this event.'
      return false
    }
  } catch { /* offline: fall through to the saved list */ }
  if (s.hasRoster()) {
    notice.value = 'Using the guest list saved on this device.'
    return true
  }
  loadError.value = 'Connect once to download the guest list before the event.'
  return false
}

async function start() {
  loadError.value = ''
  state.value = 'loading'
  try {
    const s = await openDoorStore(slug)
    if (unmounted) { s.close(); return }
    store.value = s
    const usable = await loadRoster(s)
    refreshLocal()
    state.value = usable ? 'ready' : 'failed'
    if (usable) {
      void syncOnce()
      void pollLive()
    }
  } catch {
    state.value = 'failed'
    loadError.value = 'This browser can not keep an offline guest list. Use a current version of Chrome, Safari or Firefox.'
  }
}

async function syncOnce() {
  const s = store.value
  if (!s || syncing || !navigator.onLine || Date.now() < backoffUntil) return
  syncing = true
  try {
    for (;;) {
      const items = (await s.pending()).slice(0, SYNC_BATCH)
      if (!items.length) break
      const res = await api.raw(`/api/events/${slug}/checkins/sync`, {
        method: 'POST',
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error('sync failed')
      const data = await res.json() as { results?: SyncResult[] }
      s.applyServerResults(data.results ?? [])
      failures = 0
      refreshLocal()
      if (items.length < SYNC_BATCH) break
    }
  } catch {
    failures += 1
    backoffUntil = Date.now() + Math.min(MAX_BACKOFF_MS, SYNC_EVERY_MS * 2 ** failures)
  } finally {
    syncing = false
  }
}

async function pollLive() {
  if (!store.value || document.hidden || !navigator.onLine) return
  try {
    const res = await api.raw(`/api/events/${slug}/live`, etag ? { headers: { 'If-None-Match': etag } } : {})
    if (res.status === 304 || !res.ok) return
    live.value = await res.json() as LiveCounts
    etag = res.headers.get('ETag') ?? ''
  } catch { /* the counters keep their last values */ }
}

async function requestWakeLock() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
    if (!nav.wakeLock || document.hidden) return
    wakeLock = await nav.wakeLock.request('screen')
  } catch { /* the screen may sleep; scanning still works */ }
}

function onOnline() {
  online.value = true
  backoffUntil = 0
  void syncOnce()
  void pollLive()
}

function onOffline() {
  online.value = false
}

function onVisibility() {
  if (document.hidden) return
  void pollLive()
  void requestWakeLock()
}

async function clearOfflineData() {
  const n = pendingCount.value
  const body = n > 0
    ? `${n} ${n === 1 ? 'check-in has' : 'check-ins have'} not been sent yet and will be lost.`
    : 'You can download the guest list again while online.'
  const ok = await dialog.confirm({ title: 'Clear offline data?', body, confirmLabel: 'Clear' })
  if (!ok || !store.value) return
  await store.value.clear()
  store.value = null
  result.value = null
  live.value = null
  etag = ''
  query.value = ''
  hits.value = []
  conflicts.value = []
  pendingCount.value = 0
  local.value = { confirmed: 0, checkedIn: 0 }
  notice.value = ''
  state.value = 'cleared'
}

onMounted(() => {
  void start()
  syncTimer = setInterval(() => { void syncOnce() }, SYNC_EVERY_MS)
  liveTimer = setInterval(() => { void pollLive() }, LIVE_EVERY_MS)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisibility)
  void requestWakeLock()
})

onBeforeUnmount(() => {
  unmounted = true
  if (syncTimer) clearInterval(syncTimer)
  if (liveTimer) clearInterval(liveTimer)
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  document.removeEventListener('visibilitychange', onVisibility)
  void wakeLock?.release().catch(() => undefined)
  store.value?.close()
})
</script>
