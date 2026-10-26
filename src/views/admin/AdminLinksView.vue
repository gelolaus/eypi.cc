<template>
  <section>
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <form
        class="flex w-full max-w-md gap-2"
        role="search"
        @submit.prevent="search"
      >
        <label
          for="admin-link-search"
          class="sr-only"
        >Search links</label>
        <Input
          id="admin-link-search"
          v-model="query"
          type="search"
          placeholder="Search by slug, destination, or owner"
          autocomplete="off"
        />
        <Button
          type="submit"
          class="shrink-0"
        >
          Search
        </Button>
      </form>
      <p class="text-sm text-muted-foreground">
        {{ links.length }} {{ links.length === 1 ? 'link' : 'links' }}
      </p>
    </div>

    <div
      v-if="loading"
      class="h-40 animate-pulse rounded-2xl bg-muted"
      aria-hidden="true"
    />

    <p
      v-else-if="links.length === 0"
      class="rounded-2xl border border-border px-5 py-8 text-center text-sm text-muted-foreground"
    >
      No links match that search.
    </p>

    <div
      v-else
      class="md:overflow-hidden md:rounded-2xl md:border md:border-border"
    >
      <div class="overflow-x-auto">
        <div class="space-y-3 md:min-w-3xl md:space-y-0">
          <div class="hidden grid-cols-12 border-b border-border bg-muted/40 px-4 py-3 text-xs font-semibold text-muted-foreground md:grid">
            <div class="col-span-3">
              Slug
            </div>
            <div class="col-span-4">
              Destination
            </div>
            <div class="col-span-2">
              Owner
            </div>
            <div class="col-span-3 text-right">
              Moderation
            </div>
          </div>
          <div
            v-for="link in links"
            :key="link.id"
            data-admin-row
            class="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:grid md:grid-cols-12 md:items-center md:gap-0 md:rounded-none md:border-0 md:border-b md:bg-transparent md:last:border-0 md:hover:bg-muted/40"
          >
            <div class="min-w-0 md:col-span-3">
              <a
                :href="`/${link.slug}`"
                target="_blank"
                rel="noopener"
                class="font-mono inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:text-foreground"
              >
                /{{ link.slug }}
              </a>
              <p
                v-if="link.disabled && link.disabledReason"
                class="text-xs text-destructive"
              >
                {{ link.disabledReason === 'abuse' ? 'Disabled for abuse' : 'Disabled by admin' }}
              </p>
            </div>
            <div class="font-mono min-w-0 text-xs text-muted-foreground md:col-span-4">
              <span
                class="block truncate"
                :title="link.originalUrl"
              >{{ link.originalUrl }}</span>
            </div>
            <div class="min-w-0 md:col-span-2">
              <span
                class="font-mono block truncate text-xs text-muted-foreground"
                :title="link.ownerEmail ?? ''"
              >
                {{ link.ownerEmail ?? 'Deleted user' }}
              </span>
            </div>
            <div class="flex flex-wrap items-center gap-2 md:col-span-3 md:justify-end">
              <template v-if="!link.disabled">
                <label
                  :for="`reason-${link.id}`"
                  class="sr-only"
                >Disable reason for {{ link.slug }}</label>
                <select
                  :id="`reason-${link.id}`"
                  v-model="reasons[link.id]"
                  class="h-11 w-auto min-w-0 rounded-xl border border-input bg-transparent px-3.5 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [&>option]:bg-popover [&>option]:text-popover-foreground"
                >
                  <option value="abuse">
                    Abuse
                  </option>
                  <option value="admin">
                    Admin
                  </option>
                </select>
                <Button
                  type="button"
                  variant="destructive"
                  :disabled="busyId === link.id"
                  :aria-label="`Disable /${link.slug}`"
                  @click="disable(link)"
                >
                  Disable
                </Button>
              </template>
              <Badge
                v-else
                variant="destructive"
              >
                Disabled
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="nextCursor"
      class="mt-6 flex justify-center"
    >
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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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

