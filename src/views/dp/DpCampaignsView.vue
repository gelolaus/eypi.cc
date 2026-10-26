<template>
  <div class="relative w-full">
    <PageSkeleton v-if="loading" />
    <AppPage
      v-else
      title="Frames"
      description="Shareable photo frames for your campaigns."
    >
      <div v-if="!isLocked" class="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          v-model="searchQuery"
          type="search"
          placeholder="Search frames..."
          aria-label="Search frames"
          class="control min-w-0 flex-1"
        />
        <router-link
          to="/manage/frames/new"
          class="btn-gold inline-flex min-h-11 items-center justify-center rounded-xl px-6 text-base font-semibold transition-all duration-200 hover:opacity-90"
         
        >New Campaign</router-link>
      </div>

      <div v-if="isLocked">
        <OrgLockout />
      </div>

      <div v-else-if="error" role="alert" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-400">{{ error }}</div>

      <div
        v-else-if="!filteredCampaigns.length"
        class="mica-card relative rounded-3xl border border-g-border p-12 text-center"
      >
        <p class="text-sm font-medium text-g-muted">{{ campaigns.length ? 'No matching frames' : 'No campaigns yet' }}</p>
        <p class="mt-3 text-sm leading-relaxed text-g-muted">{{ campaigns.length ? 'Try another search term.' : 'Upload transparent PNG frames to generate a shareable frame link.' }}</p>
      </div>

      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        <div
          v-for="c in filteredCampaigns"
          :key="c.id"
          class="mica-card flex flex-col gap-3 rounded-3xl border border-g-border p-5 sm:p-6"
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
              class="btn-secondary flex-1"
              @click="copyLink(c.slug)"
            >Copy link</button>
            <router-link
              :to="`/manage/frames/${c.slug}/edit`"
              class="btn-secondary"
             
            >Edit</router-link>
            <button
              type="button"
              :disabled="deletingId === c.id"
              class="btn-secondary border-red-300 text-red-600 dark:border-red-900/60 dark:text-red-400"
              @click="remove(c.id, c.title)"
            >{{ deletingId === c.id ? '...' : 'Delete' }}</button>
          </div>
        </div>
      </div>
    </AppPage>
  </div>
</template>

<script setup lang="ts">
import { api } from '@/lib/api'
import { ref, computed, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import type { DpCampaignSummary } from '@/types/dp'
import OrgLockout from '@/components/OrgLockout.vue'
import AppPage from '@/components/layout/AppPage.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'

const toast = useToast()
const dialog = useDialog()

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
    const res = await api.raw(`/api/dp/${id}`, { method: 'DELETE' })
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
    const res = await api.raw(`/api/dp`)
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

