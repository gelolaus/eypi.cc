<template>
  <section>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <form class="flex w-full max-w-md gap-2" role="search" @submit.prevent="search">
        <label for="admin-link-search" class="sr-only">Search links</label>
        <input
          id="admin-link-search"
          v-model="query"
          type="search"
          class="field-input w-full"
          placeholder="Search by slug, destination, or owner"
          autocomplete="off"
        />
        <button type="submit" class="btn-gold inline-flex shrink-0 items-center rounded-xl px-5 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:opacity-90" data-cursor="cta">
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

    <div v-else class="overflow-x-auto rounded-2xl border border-g-border">
      <div class="min-w-[860px]">
        <div class="grid grid-cols-12 border-b border-g-border bg-white/40 px-4 py-3 text-xs font-semibold text-g-muted dark:bg-mica-navy-header">
          <div class="col-span-3">Slug</div>
          <div class="col-span-4">Destination</div>
          <div class="col-span-2">Owner</div>
          <div class="col-span-3 text-right">Moderation</div>
        </div>
        <div
          v-for="link in links"
          :key="link.id"
          class="grid grid-cols-12 items-center border-b border-g-border px-4 py-4 last:border-0 hover:bg-white/30 dark:hover:bg-mica-navy-row-hover"
        >
          <div class="col-span-3 min-w-0">
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
          <div class="text-data col-span-4 min-w-0 text-xs text-g-muted">
            <span class="block truncate" :title="link.originalUrl">{{ link.originalUrl }}</span>
          </div>
          <div class="col-span-2 min-w-0">
            <span class="text-data block truncate text-xs text-g-muted" :title="link.ownerEmail ?? ''">
              {{ link.ownerEmail ?? 'Deleted user' }}
            </span>
          </div>
          <div class="col-span-3 flex flex-wrap items-center justify-end gap-2">
            <template v-if="!link.disabled">
              <label :for="`reason-${link.id}`" class="sr-only">Disable reason for {{ link.slug }}</label>
              <select
                :id="`reason-${link.id}`"
                v-model="reasons[link.id]"
                class="rounded-lg border border-g-border bg-transparent px-2 py-1.5 text-xs text-g-text"
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
                class="min-h-[36px] rounded-lg border border-red-500/60 px-3 py-1.5 text-xs font-semibold text-red-500 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-50"
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

<style scoped>
.field-input {
  @apply rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-primary focus:bg-white disabled:opacity-60 dark:border-slate-600 dark:bg-mica-navy-input dark:text-slate-200 dark:focus:border-slate-500;
}
</style>
