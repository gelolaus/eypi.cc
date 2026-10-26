<template>
  <section>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <form class="flex w-full max-w-md gap-2" role="search" @submit.prevent="search">
        <label for="admin-user-search" class="sr-only">Search users</label>
        <input
          id="admin-user-search"
          v-model="query"
          type="search"
          class="field-input w-full"
          placeholder="Search by email or name"
          autocomplete="off"
        />
        <button type="submit" class="btn-gold inline-flex shrink-0 items-center rounded-xl px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:opacity-90" data-cursor="cta">
          Search
        </button>
      </form>
      <p class="text-sm text-g-muted">
        {{ users.length }} {{ users.length === 1 ? 'user' : 'users' }}
      </p>
    </div>

    <div v-if="loading" class="mica-card h-40 animate-pulse rounded-3xl" aria-hidden="true" />

    <p v-else-if="users.length === 0" class="rounded-2xl border border-g-border px-5 py-8 text-center text-sm text-g-muted">
      No users match that search.
    </p>

    <div v-else class="overflow-x-auto rounded-2xl border border-g-border">
      <div class="min-w-[820px]">
        <div class="grid grid-cols-12 border-b border-g-border bg-white/40 px-4 py-3 text-xs font-semibold text-g-muted dark:bg-mica-navy-header">
          <div class="col-span-4">User</div>
          <div class="col-span-2">Role</div>
          <div class="col-span-2">Status</div>
          <div class="col-span-2">Joined</div>
          <div class="col-span-2 text-right">Actions</div>
        </div>
        <div
          v-for="user in users"
          :key="user.id"
          class="grid grid-cols-12 items-center border-b border-g-border px-4 py-4 last:border-0 hover:bg-white/30 dark:hover:bg-mica-navy-row-hover"
        >
          <div class="col-span-4 min-w-0">
            <p class="truncate text-sm font-semibold text-g-text">
              {{ user.name || '(no name)' }}
              <span v-if="isSelf(user)" class="text-xs font-normal text-g-muted">(you)</span>
            </p>
            <p class="text-data truncate text-xs text-g-muted">{{ user.email }}</p>
          </div>
          <div class="col-span-2 text-sm">
            {{ user.role === 'admin' ? 'Admin' : 'User' }}
          </div>
          <div class="col-span-2 text-sm">
            <span :class="user.disabled ? 'text-red-500' : 'text-g-muted'">
              {{ user.disabled ? 'Disabled' : 'Active' }}
            </span>
          </div>
          <div class="text-data col-span-2 text-xs text-g-muted">{{ formatDate(user.createdAt) }}</div>
          <div class="col-span-2 flex flex-wrap justify-end gap-2">
            <button
              v-if="user.role === 'user'"
              type="button"
              class="rounded-lg border border-g-border px-3 py-1.5 text-xs font-semibold text-g-primary transition-colors hover:border-g-accent hover:text-g-accent disabled:opacity-50"
              :disabled="busyId === user.id"
              :aria-label="`Make ${user.email} an admin`"
              @click="setRole(user, 'admin')"
            >
              Make admin
            </button>
            <button
              v-else-if="!isSelf(user)"
              type="button"
              class="rounded-lg border border-g-border px-3 py-1.5 text-xs font-semibold text-g-muted transition-colors hover:border-g-primary hover:text-g-primary disabled:opacity-50"
              :disabled="busyId === user.id"
              :aria-label="`Make ${user.email} a regular user`"
              @click="setRole(user, 'user')"
            >
              Make user
            </button>
            <button
              type="button"
              class="rounded-lg border border-g-border px-3 py-1.5 text-xs font-semibold text-g-muted transition-colors hover:border-g-primary hover:text-g-primary disabled:opacity-50"
              :disabled="busyId === user.id"
              :aria-label="user.disabled ? `Enable ${user.email}` : `Disable ${user.email}`"
              @click="toggleDisabled(user)"
            >
              {{ user.disabled ? 'Enable' : 'Disable' }}
            </button>
            <button
              type="button"
              class="rounded-lg border border-g-border px-3 py-1.5 text-xs font-semibold text-g-muted transition-colors hover:border-g-primary hover:text-g-primary disabled:opacity-50"
              :disabled="busyId === user.id"
              :aria-label="`Force logout for ${user.email}`"
              @click="forceLogout(user)"
            >
              Log out
            </button>
            <button
              type="button"
              class="rounded-lg border border-red-500/60 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-50"
              :disabled="busyId === user.id"
              :aria-label="`Delete ${user.email}`"
              @click="remove(user)"
            >
              Delete
            </button>
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
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import { useSession } from '@/stores/session'

type Role = 'admin' | 'user'

interface AdminUser {
  id: string
  email: string
  name: string
  role: Role
  disabled: boolean
  createdAt: string
}

interface UsersPage {
  items: AdminUser[]
  nextCursor: string | null
}

const toast = useToast()
const dialog = useDialog()
const session = useSession()

const users = ref<AdminUser[]>([])
const query = ref('')
const nextCursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const busyId = ref<string | null>(null)
let requestId = 0

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function isSelf(user: AdminUser): boolean {
  return session.user.value?.id === user.id
}

function formatDate(value: string): string {
  if (!value) return 'Unknown'
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function replaceUser(next: AdminUser) {
  const index = users.value.findIndex((item) => item.id === next.id)
  if (index > -1) users.value.splice(index, 1, next)
}

async function load(reset: boolean) {
  const id = ++requestId
  if (reset) {
    loading.value = true
    nextCursor.value = null
  } else {
    loadingMore.value = true
  }
  try {
    const params = new URLSearchParams()
    if (query.value.trim()) params.set('q', query.value.trim())
    if (!reset && nextCursor.value) params.set('cursor', nextCursor.value)
    const suffix = params.toString()
    const data = await api.get<UsersPage>(`/api/admin/users${suffix ? `?${suffix}` : ''}`)
    if (id !== requestId) return
    users.value = reset ? data.items : [...users.value, ...data.items]
    nextCursor.value = data.nextCursor
  } catch (err) {
    if (id === requestId) toast.error(messageOf(err, 'Could not load users.'))
  } finally {
    if (id === requestId) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function search() {
  void load(true)
}

onMounted(() => {
  void load(true)
})

async function patchUser(user: AdminUser, body: { role?: Role; disabled?: boolean }, success: string) {
  busyId.value = user.id
  try {
    const data = await api.patch<{ item: AdminUser }>(`/api/admin/users/${encodeURIComponent(user.id)}`, body)
    replaceUser(data.item)
    toast.success(success)
  } catch (err) {
    toast.error(messageOf(err, 'Could not update the user.'))
  } finally {
    busyId.value = null
  }
}

function setRole(user: AdminUser, role: Role) {
  if (role === user.role) return
  void patchUser(user, { role }, role === 'admin' ? `${user.email} is now an admin.` : `${user.email} is now a user.`)
}

async function toggleDisabled(user: AdminUser) {
  if (!user.disabled) {
    const ok = await dialog.confirm({
      title: 'Disable this account?',
      body: `Disables ${user.email} and signs them out everywhere. They can be enabled again later.`,
      confirmLabel: 'Disable account',
    })
    if (!ok) return
    await patchUser(user, { disabled: true }, `${user.email} is disabled.`)
    return
  }
  await patchUser(user, { disabled: false }, `${user.email} is enabled.`)
}

async function forceLogout(user: AdminUser) {
  const ok = await dialog.confirm({
    title: 'Sign this user out?',
    body: `Removes every active session for ${user.email}. Their account stays active.`,
    confirmLabel: 'Sign out',
  })
  if (!ok) return
  busyId.value = user.id
  try {
    await api.post(`/api/admin/users/${encodeURIComponent(user.id)}/logout`)
    toast.success(`${user.email} was signed out.`)
  } catch (err) {
    toast.error(messageOf(err, 'Could not sign the user out.'))
  } finally {
    busyId.value = null
  }
}

async function remove(user: AdminUser) {
  const ok = await dialog.confirm({
    title: 'Delete this account?',
    body: `Permanently deletes ${user.email}, their links, and their data. This cannot be undone.`,
    confirmLabel: 'Delete account',
    requireText: user.email,
  })
  if (!ok) return
  busyId.value = user.id
  try {
    await api.del(`/api/admin/users/${encodeURIComponent(user.id)}`)
    users.value = users.value.filter((item) => item.id !== user.id)
    toast.success(`${user.email} was deleted.`)
  } catch (err) {
    toast.error(messageOf(err, 'Could not delete the user.'))
  } finally {
    busyId.value = null
  }
}
</script>

<style scoped>
.field-input {
  @apply rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-primary focus:bg-white disabled:opacity-60 dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500;
}
</style>
