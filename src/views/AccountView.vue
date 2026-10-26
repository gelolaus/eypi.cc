<template>
  <AppPage
    title="Account"
    class="!max-w-3xl"
  >
    <div class="flex flex-col gap-6">
    <AppSection title="Profile">
      <div class="flex flex-col gap-3">
        <p class="text-g-text">
          {{ name }}
        </p>
        <p class="text-data break-all text-sm text-g-muted">
          {{ email }}
        </p>
        <p>
          <span class="inline-flex min-h-6 items-center rounded-full border border-g-border px-2.5 py-0.5 text-xs font-semibold text-g-text">
            {{ roleLabel }}
          </span>
        </p>
        <p class="text-sm text-g-muted">
          Signed in with Microsoft (APC)
        </p>
      </div>
    </AppSection>

    <AppSection title="Sessions">
      <div class="flex flex-col gap-4">
      <p
        v-if="loadError"
        class="text-sm text-red-600 dark:text-red-400"
        role="alert"
      >
        {{ loadError }}
      </p>
      <p
        v-else-if="loadingSessions"
        class="text-sm text-g-muted"
      >
        Loading sessions.
      </p>
      <p
        v-else-if="sessions.length === 0"
        class="text-sm text-g-muted"
      >
        No sessions.
      </p>
      <ul
        v-else
        class="flex flex-col gap-3"
      >
        <li
          v-for="row in sessions"
          :key="row.id"
          class="mica-card flex flex-col gap-2 rounded-2xl border border-g-border p-4"
        >
          <p class="text-sm font-semibold text-g-text">
            {{ row.device }}
          </p>
          <p class="text-data text-sm text-g-muted">
            Last active
            <time :datetime="row.lastSeenAt">{{ manilaLabel(row.lastSeenAt) }}</time>
          </p>
          <p
            v-if="row.current"
            class="text-sm text-g-text"
          >
            Current
          </p>
          <button
            class="btn-secondary w-full sm:w-auto"
            type="button"
            @click="revoke(row)"
          >
            Revoke
          </button>
        </li>
      </ul>
      <p
        v-if="actionError"
        class="text-sm text-red-600 dark:text-red-400"
        role="alert"
      >
        {{ actionError }}
      </p>
      <button
        class="btn-secondary w-full sm:w-auto"
        type="button"
        @click="signOutEverywhere"
      >
        Sign out everywhere
      </button>
      </div>
    </AppSection>

    <AppSection title="Export">
      <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-3 sm:flex-row">
        <button
          class="btn-secondary w-full sm:w-auto"
          type="button"
          @click="downloadData"
        >
          Download my data (JSON)
        </button>
        <button
          class="btn-secondary w-full sm:w-auto"
          type="button"
          @click="downloadLinks"
        >
          Download my links (CSV)
        </button>
      </div>
      <p
        v-if="exportError"
        class="text-sm text-red-600 dark:text-red-400"
        role="alert"
      >
        {{ exportError }}
      </p>
      </div>
    </AppSection>

    <AppSection title="Delete account">
      <div class="flex flex-col gap-4">
      <p class="text-sm text-g-muted">
        This permanently deletes your links, sessions, and profile.
      </p>
      <form
        class="flex flex-col gap-4"
        @submit.prevent="onDelete"
      >
        <div class="flex flex-col gap-2">
          <label
            class="text-sm font-semibold text-g-text"
            for="delete-confirm-email"
          >
            Type your email to confirm
          </label>
          <input
            id="delete-confirm-email"
            v-model="confirmEmail"
            autocomplete="off"
            class="control"
            :aria-invalid="Boolean(deleteError)"
            :aria-describedby="deleteError ? 'delete-error' : undefined"
            type="email"
          >
        </div>
        <p
          v-if="deleteError"
          id="delete-error"
          class="text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {{ deleteError }}
        </p>
        <ul
          v-if="blockedOrgs.length > 0"
          class="flex flex-col gap-2"
        >
          <li
            v-for="org in blockedOrgs"
            :key="org.id"
          >
            <router-link
              class="text-sm font-semibold text-g-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]"
              :to="`/orgs/modify/${org.id}`"
            >
              {{ org.name }}
            </router-link>
          </li>
        </ul>
        <button
          class="btn-danger w-full sm:w-auto"
          type="submit"
          :disabled="!canDelete"
        >
          Delete account
        </button>
      </form>
      </div>
    </AppSection>
    </div>
  </AppPage>
</template>

<script setup lang="ts">
import AppPage from '@/components/layout/AppPage.vue'
import AppSection from '@/components/layout/AppSection.vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, api } from '@/lib/api'
import { useSession } from '@/stores/session'

type AccountSession = {
  id: string
  device: string
  lastSeenAt: string
  expiresAt: string
  current: boolean
}

type OwnedOrg = {
  id: string
  name: string
}

const router = useRouter()
const session = useSession()

const sessions = ref<AccountSession[]>([])
const loadingSessions = ref(true)
const loadError = ref('')
const actionError = ref('')
const exportError = ref('')
const deleteError = ref('')
const blockedOrgs = ref<OwnedOrg[]>([])
const confirmEmail = ref('')
const pending = ref(false)

const name = computed(() => session.user.value?.name ?? '')
const email = computed(() => session.user.value?.email ?? '')
const roleLabel = computed(() => (session.user.value?.role === 'admin' ? 'Admin' : 'User'))
const canDelete = computed(() => {
  const expected = email.value.trim().toLowerCase()
  if (!expected || pending.value) return false
  return confirmEmail.value.trim().toLowerCase() === expected
})

function manilaLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${pick('year')}-${pick('month')}-${pick('day')} ${pick('hour')}:${pick('minute')}`
}

function filenameFrom(header: string | null, fallback: string): string {
  if (!header) return fallback
  const match = /filename="([^"]+)"/.exec(header)
  return match?.[1] || fallback
}

async function leave() {
  session.reset()
  await router.push({ name: 'login' })
}

async function loadSessions() {
  loadError.value = ''
  loadingSessions.value = true
  try {
    const data = await api.get<{ sessions?: AccountSession[] }>('/api/account/sessions')
    sessions.value = Array.isArray(data.sessions) ? data.sessions : []
  } catch (error) {
    loadError.value = error instanceof ApiError ? error.message : 'Could not load sessions.'
  } finally {
    loadingSessions.value = false
  }
}

async function revoke(row: AccountSession) {
  actionError.value = ''
  try {
    await api.del(`/api/account/sessions/${encodeURIComponent(row.id)}`)
    if (row.current) {
      await leave()
      return
    }
    await loadSessions()
  } catch (error) {
    actionError.value = error instanceof ApiError ? error.message : 'Could not revoke that session.'
  }
}

async function signOutEverywhere() {
  actionError.value = ''
  try {
    await api.post('/api/account/sessions/revoke-all')
    await leave()
  } catch (error) {
    actionError.value = error instanceof ApiError ? error.message : 'Could not sign out everywhere.'
  }
}

async function saveFile(path: string, fallback: string) {
  exportError.value = ''
  try {
    const res = await api.raw(path)
    if (!res.ok) {
      exportError.value = 'Could not download that file.'
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filenameFrom(res.headers.get('Content-Disposition'), fallback)
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  } catch {
    exportError.value = 'Could not download that file.'
  }
}

function downloadData() {
  return saveFile('/api/account/export.json', 'eypi-data.json')
}

function downloadLinks() {
  return saveFile('/api/links/export.csv', 'links.csv')
}

function ownedOrgsFrom(value: unknown): OwnedOrg[] {
  if (!Array.isArray(value)) return []
  const orgs: OwnedOrg[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const id = (entry as { id?: unknown }).id
    const orgName = (entry as { name?: unknown }).name
    if (typeof id !== 'string' || typeof orgName !== 'string') continue
    orgs.push({ id, name: orgName })
  }
  return orgs
}

async function onDelete() {
  if (!canDelete.value) return
  deleteError.value = ''
  blockedOrgs.value = []
  pending.value = true
  try {
    const res = await api.raw('/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmEmail: confirmEmail.value.trim().toLowerCase() }),
    })
    if (res.status === 204) {
      await leave()
      return
    }
    let message = 'Could not delete this account.'
    let orgs: OwnedOrg[] = []
    try {
      const data = await res.json() as { error?: { message?: unknown }; orgs?: unknown }
      if (typeof data.error?.message === 'string' && data.error.message.length > 0) {
        message = data.error.message
      }
      if (res.status === 409) orgs = ownedOrgsFrom(data.orgs)
    } catch {
      // A non-JSON error still uses the sentence above.
    }
    deleteError.value = message
    blockedOrgs.value = orgs
  } catch {
    deleteError.value = 'Could not delete this account.'
  } finally {
    pending.value = false
  }
}

onMounted(() => {
  void loadSessions()
})
</script>
