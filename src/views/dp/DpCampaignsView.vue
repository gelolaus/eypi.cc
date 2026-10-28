<template>
  <div class="relative w-full">
    <PageSkeleton v-if="loading" />
    <AppPage
      v-else
      title="Frames"
      description="Shareable photo frames for your campaigns."
    >
      <div
        v-if="!isLocked"
        class="mb-6 flex flex-col gap-3 sm:flex-row"
      >
        <Input
          v-model="searchQuery"
          type="search"
          placeholder="Search frames..."
          aria-label="Search frames"
          class="min-w-0 flex-1"
        />
        <Button
          as-child
          class="px-6"
        >
          <router-link to="/manage/frames/new">
            New Campaign
          </router-link>
        </Button>
      </div>

      <div v-if="isLocked">
        <OrgLockout />
      </div>

      <Card
        v-else-if="error"
        class="rounded-2xl p-6 text-center"
      >
        <p
          role="alert"
          class="text-sm text-destructive"
        >
          {{ error }}
        </p>
      </Card>

      <Card
        v-else-if="!filteredCampaigns.length"
        class="relative rounded-3xl p-12 text-center"
      >
        <p class="text-sm font-medium text-muted-foreground">
          {{ campaigns.length ? 'No matching frames' : 'No campaigns yet' }}
        </p>
        <p class="mt-3 text-sm leading-relaxed text-muted-foreground">
          {{ campaigns.length ? 'Try another search term.' : 'Upload transparent PNG frames to generate a shareable frame link.' }}
        </p>
      </Card>

      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
      >
        <Card
          v-for="c in filteredCampaigns"
          :key="c.id"
          class="gap-3 rounded-3xl p-5 sm:p-6"
        >
          <h2 class="text-lg leading-tight font-semibold">
            {{ c.title }}
          </h2>
          <p
            v-if="c.description"
            class="line-clamp-2 text-sm leading-relaxed text-muted-foreground"
          >
            {{ c.description }}
          </p>

          <div class="mt-1 flex items-end gap-4">
            <div class="flex items-baseline gap-1.5">
              <span class="font-mono text-2xl font-bold">{{ c.downloadCount }}</span>
              <span class="text-xs text-muted-foreground">download{{ c.downloadCount === 1 ? '' : 's' }}</span>
            </div>
            <div class="flex items-baseline gap-1.5">
              <span class="font-mono text-2xl font-bold">{{ c.frameCount }}</span>
              <span class="text-xs text-muted-foreground">frame{{ c.frameCount === 1 ? '' : 's' }}</span>
            </div>
          </div>

          <div class="mt-auto flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              class="flex-1"
              @click="copyLink(c.slug)"
            >
              Copy link
            </Button>
            <Button
              as-child
              variant="outline"
            >
              <router-link :to="`/manage/frames/${c.slug}/edit`">
                Edit
              </router-link>
            </Button>
            <Button
              type="button"
              variant="destructive"
              :disabled="deletingId === c.id"
              @click="remove(c.id, c.title)"
            >
              {{ deletingId === c.id ? '...' : 'Delete' }}
            </Button>
          </div>
        </Card>
      </div>
    </AppPage>
  </div>
</template>

<script setup lang="ts">
import { api } from '@/lib/api'
import { ref, computed, watch } from 'vue'
import { invalidate, useQuery } from '@/lib/queryCache'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import type { DpCampaignSummary } from '@/types/dp'
import OrgLockout from '@/components/OrgLockout.vue'
import AppPage from '@/components/layout/AppPage.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const toast = useToast()
const dialog = useDialog()

const query = useQuery(
  () => `dp:list:${localStorage.getItem('active_org_id') ?? ''}`,
  async () => {
    const res = await api.raw(`/api/dp`)
    if (res.status === 403) return { locked: true, campaigns: [] as DpCampaignSummary[] }
    const data = await res.json() as { status: string; message?: string; campaigns?: DpCampaignSummary[] }
    if (!res.ok) throw new Error(data.message ?? 'Failed to load campaigns.')
    return { locked: false, campaigns: data.campaigns ?? [] }
  },
)
const campaigns = ref<DpCampaignSummary[]>([])
const loading = computed(() => query.status.value === 'loading')
const error = computed(() => {
  if (query.status.value !== 'error') return ''
  return query.error.value instanceof Error ? query.error.value.message : 'Failed to load campaigns.'
})
const isLocked = computed(() => query.data.value?.locked === true)
watch(query.data, (d) => { campaigns.value = d?.campaigns ?? [] }, { immediate: true })
watch(error, (message) => { if (message) toast.error(message) })
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
    invalidate('dp:')
    toast.success(`"${title}" deleted.`)
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Delete failed.')
  } finally {
    deletingId.value = null
  }
}

</script>

