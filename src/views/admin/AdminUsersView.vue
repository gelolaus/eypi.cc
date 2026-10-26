<template>
  <section>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <form class="flex w-full max-w-md gap-2" role="search" @submit.prevent="search">
        <label for="admin-user-search" class="sr-only">Search users</label>
        <Input
          id="admin-user-search"
          v-model="query"
          type="search"
          placeholder="Search by email or name"
          autocomplete="off"
        />
        <Button type="submit" class="shrink-0">
          Search
        </Button>
      </form>
      <p class="text-sm text-muted-foreground">
        {{ users.length }} {{ users.length === 1 ? 'user' : 'users' }}
      </p>
    </div>

    <div v-if="loading" class="h-40 animate-pulse rounded-2xl bg-muted" aria-hidden="true" />

    <p v-else-if="users.length === 0" class="rounded-2xl border border-border px-5 py-8 text-center text-sm text-muted-foreground">
      No users match that search.
    </p>

    <div v-else class="md:overflow-hidden md:rounded-2xl md:border md:border-border">
      <div class="overflow-x-auto">
        <div class="space-y-3 md:min-w-4xl md:space-y-0">
        <div class="hidden grid-cols-12 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground md:grid">
          <div class="col-span-4">User</div>
          <div class="col-span-2">Role</div>
          <div class="col-span-2">Status</div>
          <div class="col-span-2">Joined</div>
          <div class="col-span-2 text-right">Actions</div>
        </div>
        <div
          v-for="user in users"
          :key="user.id"
          data-admin-row
          class="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:grid md:grid-cols-12 md:items-center md:gap-0 md:rounded-none md:border-0 md:border-b md:bg-transparent md:last:border-0 md:hover:bg-muted/40"
        >
          <div class="min-w-0 md:col-span-4">
            <p class="truncate text-sm font-semibold text-foreground">
              {{ user.name || '(no name)' }}
              <span v-if="isSelf(user)" class="text-xs font-normal text-muted-foreground">(you)</span>
            </p>
            <p class="font-mono truncate text-xs text-muted-foreground">{{ user.email }}</p>
          </div>
          <div class="text-sm md:col-span-2">
            <span class="text-muted-foreground md:hidden">Role: </span>{{ user.role === 'admin' ? 'Admin' : 'User' }}
          </div>
          <div class="text-sm md:col-span-2">
            <span class="text-muted-foreground md:hidden">Status: </span><span :class="user.disabled ? 'text-destructive' : 'text-muted-foreground'">
              {{ user.disabled ? 'Disabled' : 'Active' }}
            </span>
          </div>
          <div class="font-mono text-xs text-muted-foreground md:col-span-2"><span class="md:hidden">Joined </span>{{ formatDate(user.createdAt) }}</div>
          <div class="flex flex-wrap gap-2 md:col-span-2 md:justify-end">
            <Button
              v-if="user.role === 'user'"
              type="button"
              variant="outline"
              :disabled="busyId === user.id"
              :aria-label="`Make ${user.email} an admin`"
              @click="setRole(user, 'admin')"
            >
              Make admin
            </Button>
            <Button
              v-else-if="!isSelf(user)"
              type="button"
              variant="outline"
              :disabled="busyId === user.id"
              :aria-label="`Make ${user.email} a regular user`"
              @click="setRole(user, 'user')"
            >
              Make user
            </Button>
            <Button
              type="button"
              variant="outline"
              :disabled="busyId === user.id"
              :aria-label="user.disabled ? `Enable ${user.email}` : `Disable ${user.email}`"
              @click="toggleDisabled(user)"
            >
              {{ user.disabled ? 'Enable' : 'Disable' }}
            </Button>
            <Button
              type="button"
              variant="outline"
              :disabled="busyId === user.id"
              :aria-label="`Force logout for ${user.email}`"
              @click="forceLogout(user)"
            >
              Log out
            </Button>
            <Button
              type="button"
              variant="destructive"
              :disabled="busyId === user.id"
              :aria-label="`Delete ${user.email}`"
              @click="remove(user)"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>

    <div v-if="nextCursor" class="mt-6 flex justify-center">
      <Button
        type="button"
        variant="outline"
        :disabled="loadingMore"
        @click="load(false)"
      >
        {{ loadingMore ? 'Loading...' : 'Load more' }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'
import { formatManilaDate } from '@/lib/manilaTime'
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
  return formatManilaDate(value)
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
