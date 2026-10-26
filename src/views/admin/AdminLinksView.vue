<template>
  <section>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <form class="flex w-full max-w-md gap-2" role="search" @submit.prevent="search">
        <label for="admin-link-search" class="sr-only">Search links</label>
        <input
          id="admin-link-search"
          v-model="query"
          type="search"
          class="control"
          placeholder="Search by slug, destination, or owner"
          autocomplete="off"
        />
        <button type="submit" class="btn-gold inline-flex min-h-11 shrink-0 items-center rounded-xl px-5 text-base font-semibold transition-all hover:opacity-90" data-cursor="cta">
          Search
        </button>
      </form>
      <p class="text-sm text-g-muted">
        {{ links.length }} {{ links.length === 1 ? 'link' : 'links' }}
      </p>
    </div>

    <div v-if="loading" class="mica-card h-40 animate-pulse rounded-3xl" aria-hidden="true" />

    <p v-else-if="links.length === 0" class="rounded-2xl border border-g-border px-5 py-8 text-center text-sm text-g-muted">
      No links match that search.
    </p>

    <div v-else class="space-y-3 md:space-y-0 md:overflow-hidden md:rounded-2xl md:border md:border-g-border">
      <div>
        <div class="hidden grid-cols-12 border-b border-g-border bg-g-surface px-4 py-3 text-xs font-semibold text-g-muted md:grid">
          <div class="col-span-3">Slug</div>
          <div class="col-span-4">Destination</div>
          <div class="col-span-2">Owner</div>
          <div class="col-span-3 text-right">Moderation</div>
        </div>
        <div
          v-for="link in links"
          :key="link.id"
          data-admin-row
          class="flex flex-col gap-3 rounded-2xl border border-g-border bg-g-surface p-4 md:grid md:grid-cols-12 md:items-center md:gap-0 md:rounded-none md:border-0 md:border-b md:bg-transparent md:last:border-0 md:hover:bg-white/30 dark:md:hover:bg-mica-navy-row-hover"
        >
          <div class="min-w-0 md:col-span-3">
            <a
              :href="`/${link.slug}`"
              target="_blank"
              rel="noopener"
              class="text-data inline-flex min-h-[44px] items-center text-sm font-semibold text-g-primary hover:text-g-accent"
            >
              /{{ link.slug }}
            </a>
            <p v-if="link.disabled && link.disabledReason" class="text-xs text-red-500">
              {{ link.disabledReason === 'abuse' ? 'Disabled for abuse' : 'Disabled by admin' }}
            </p>
          </div>
          <div class="text-data min-w-0 text-xs text-g-muted md:col-span-4">
            <span class="block truncate" :title="link.originalUrl">{{ link.originalUrl }}</span>
          </div>
          <div class="min-w-0 md:col-span-2">
            <span class="text-data block truncate text-xs text-g-muted" :title="link.ownerEmail ?? ''">
              {{ link.ownerEmail ?? 'Deleted user' }}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2 md:col-span-3 md:justify-end">
            <template v-if="!link.disabled">
              <label :for="`reason-${link.id}`" class="sr-only">Disable reason for {{ link.slug }}</label>
              <select
                :id="`reason-${link.id}`"
                v-model="reasons[link.id]"
                class="control !w-auto"
              >
                <option value="abuse">
                  Abuse
                </option>
                <option value="admin">
                  Admin
                </option>
              </select>
              <button
                type="button"
                class="btn-danger"
                :disabled="busyId === link.id"
                :aria-label="`Disable /${link.slug}`"
                @click="disable(link)"
              >
                Disable
              </button>
            </template>
            <span v-else class="text-xs font-semibold text-red-500">Disabled</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="nextCursor" class="mt-6 flex justify-center">
      <button
        type="button"
        class="btn-secondary"
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

type Reason = 'abuse' | 'admin'

interface AdminLink {
  id: string
  slug: string
  originalUrl: string
  ownerEmail: string | null
  createdAt: string
  disabled: boolean
  disabledReason: string | null
}

interface LinksPage {
  items: AdminLink[]
  nextCursor: string | null
}

const toast = useToast()
const dialog = useDialog()

const links = ref<AdminLink[]>([])
const query = ref('')
const nextCursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const busyId = ref<string | null>(null)
const reasons = ref<Record<string, Reason>>({})
let requestId = 0

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
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
    const data = await api.get<LinksPage>(`/api/admin/links${suffix ? `?${suffix}` : ''}`)
    if (id !== requestId) return
    links.value = reset ? data.items : [...links.value, ...data.items]
    nextCursor.value = data.nextCursor
  } catch (err) {
    if (id === requestId) toast.error(messageOf(err, 'Could not load links.'))
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

async function disable(link: AdminLink) {
  const reason: Reason = reasons.value[link.id] ?? 'abuse'
  const ok = await dialog.confirm({
    title: 'Disable this link?',
    body: `Takes /${link.slug} offline immediately. The owner cannot re-enable it themselves.`,
    confirmLabel: 'Disable link',
  })
  if (!ok) return
  busyId.value = link.id
  try {
    await api.post(`/api/admin/links/${encodeURIComponent(link.id)}/disable`, { reason })
    link.disabled = true
    link.disabledReason = reason
    toast.success(`/${link.slug} was disabled.`)
  } catch (err) {
    toast.error(messageOf(err, 'Could not disable the link.'))
  } finally {
    busyId.value = null
  }
}
</script>

