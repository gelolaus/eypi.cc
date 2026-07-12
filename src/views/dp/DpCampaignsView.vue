<template>
  <section class="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col px-6 py-16">
    <div class="mb-8 flex flex-col gap-4 border-b border-g-border pb-8 md:flex-row md:items-end md:justify-between">
      <div>
        <h1
          class="text-page-title"
          data-cursor="text"
        >Frames</h1>
      </div>
      <div v-if="!isLocked" class="flex flex-wrap items-center gap-3">
        <OrgSwitcher />
        <router-link
          to="/manage/frames/new"
          class="rounded-xl bg-g-accent px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:opacity-90 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
          data-cursor="cta"
        >New Campaign</router-link>
      </div>
    </div>

    <input
      v-if="!isLocked"
      v-model="searchQuery"
      type="search"
      placeholder="Search frames..."
      class="mb-6 w-full rounded-2xl border-2 border-g-border bg-g-surface px-6 py-4 text-sm text-g-text outline-none transition-colors placeholder:text-g-muted focus:border-g-accent"
    />

    <div v-if="loading" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-44 animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <div v-else-if="isLocked">
      <OrgLockout />
    </div>

    <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-500 dark:border-red-900/40 dark:bg-red-900/10">{{ error }}</div>

    <div
      v-else-if="!filteredCampaigns.length"
      class="mica-card relative rounded-3xl border border-g-border p-12 text-center"
    >
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <p class="text-sm font-medium text-g-muted">{{ campaigns.length ? 'No matching frames' : 'No campaigns yet' }}</p>
      <p class="mt-3 text-sm leading-relaxed text-g-muted">{{ campaigns.length ? 'Try another search term.' : 'Upload transparent PNG frames to generate a shareable frame link.' }}</p>
    </div>

    <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="c in filteredCampaigns"
        :key="c.id"
        class="mica-card flex flex-col gap-3 rounded-3xl border border-g-border p-6"
      >
        <h2 class="text-card-title leading-tight">{{ c.title }}</h2>
        <p v-if="c.description" class="line-clamp-2 text-sm leading-relaxed text-g-muted">{{ c.description }}</p>

        <div class="mt-1 flex items-end gap-4">
          <div class="flex items-baseline gap-1.5">
            <span class="text-data text-2xl font-bold text-g-text">{{ c.downloadCount }}</span>
            <span class="text-xs text-g-muted">download{{ c.downloadCount === 1 ? '' : 's' }}</span>
          </div>
          <div class="flex items-baseline gap-1.5">
            <span class="text-data text-2xl font-bold text-g-text">{{ c.frameCount }}</span>
            <span class="text-xs text-g-muted">frame{{ c.frameCount === 1 ? '' : 's' }}</span>
          </div>
        </div>

        <div class="mt-auto flex items-center gap-2 pt-2">
          <button
            type="button"
            class="min-h-[44px] flex-1 rounded-lg border border-g-border px-3 py-2 text-sm font-semibold text-g-text transition-colors hover:border-g-accent hover:text-g-accent"
            @click="copyLink(c.slug)"
          >Copy link</button>
          <router-link
            :to="`/manage/frames/${c.slug}/edit`"
            class="min-h-[44px] rounded-lg border border-g-border px-3 py-2 text-sm font-semibold text-g-muted transition-colors hover:border-g-accent hover:text-g-text"
            data-cursor="nav"
          >Edit</router-link>
          <button
            :disabled="deletingId === c.id"
            class="min-h-[44px] rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-400 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:border-red-900/40 dark:text-red-400/70 dark:hover:border-red-700/60 dark:hover:bg-red-900/10 dark:hover:text-red-400"
            @click="remove(c.id, c.title)"
          >{{ deletingId === c.id ? '...' : 'Delete' }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { useAuth } from '@/composables/useAuth'
import type { DpCampaignSummary } from '@/types/dp'
import OrgLockout from '@/components/OrgLockout.vue'
import OrgSwitcher from '@/components/OrgSwitcher.vue'

const toast = useToast()
const dialog = useDialog()
const { authHeaders } = useAuth()

const campaigns = ref<DpCampaignSummary[]>([])
const loading = ref(true)
const error = ref('')
const isLocked = ref(false)
const deletingId = ref<string | null>(null)
const searchQuery = ref('')

const filteredCampaigns = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return campaigns.value
  return campaigns.value.filter((campaign) =>
    campaign.title.toLowerCase().includes(q) ||
    campaign.slug.toLowerCase().includes(q) ||
    (campaign.description ?? '').toLowerCase().includes(q)
  )
})

async function copyLink(slug: string) {
  try {
    await navigator.clipboard.writeText(`https://eypi.cc/frames/${slug}`)
    toast.success('Link copied to clipboard!')
  } catch {
    toast.error('Could not copy the link.')
  }
}

async function remove(id: string, title: string) {
  const ok = await dialog.confirm({
    title: 'Delete this campaign?',
    body: `Removes "${title}", its frames, and its public page. This cannot be undone.`,
    confirmLabel: 'Delete campaign',
    requireText: title,
  })
  if (!ok) return
  deletingId.value = id
  try {
    const res = await fetch(`${API_BASE_URL}/api/dp/${id}`, { method: 'DELETE', headers: authHeaders() })
    const data = await res.json() as { status: string; message?: string }
    if (!res.ok) throw new Error(data.message ?? 'Delete failed.')
    campaigns.value = campaigns.value.filter(c => c.id !== id)
    toast.success(`"${title}" deleted.`)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Delete failed.')
  } finally {
    deletingId.value = null
  }
}

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/dp`, { headers: authHeaders() })
    if (res.status === 403) {
      isLocked.value = true
      return
    }
    const data = await res.json() as { status: string; message?: string; campaigns?: DpCampaignSummary[] }
    if (!res.ok) throw new Error(data.message ?? 'Failed to load campaigns.')
    campaigns.value = data.campaigns ?? []
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to load campaigns.'
    toast.error(error.value)
  } finally {
    loading.value = false
  }
})
</script>

