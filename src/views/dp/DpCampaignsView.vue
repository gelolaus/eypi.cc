<template>
  <section class="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col px-4 py-12 sm:px-6">
    <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="font-display text-3xl font-bold text-g-text">Frames</h1>
        <p class="mt-2 text-g-muted">Upload frames and share a link for matching profile pictures.</p>
      </div>
      <div v-if="!isLocked" class="flex flex-wrap items-center gap-3">
        <OrgSwitcher />
        <Button @click="router.push('/manage/frames/new')">New Campaign</Button>
      </div>
    </div>

    <Input
      v-if="!isLocked"
      :value="searchQuery"
      type="search"
      placeholder="Search frames..."
      className="mb-6"
      @input="onSearchInput"
    />

    <div v-if="loading" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Card v-for="i in 3" :key="i" className="h-44 animate-pulse" />
    </div>

    <div v-else-if="isLocked">
      <OrgLockout />
    </div>

    <Card v-else-if="error" className="border-g-destructive/30 text-center text-sm text-g-destructive">
      {{ error }}
    </Card>

    <Card v-else-if="!filteredCampaigns.length">
      <EmptyState
        :title="campaigns.length ? 'No matching frames' : 'No campaigns yet'"
        :description="campaigns.length ? 'Try another search term.' : 'Upload transparent PNG frames to generate a shareable frame link.'"
      >
        <Button v-if="!campaigns.length" @click="router.push('/manage/frames/new')">New Campaign</Button>
      </EmptyState>
    </Card>

    <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Card
        v-for="c in filteredCampaigns"
        :key="c.id"
        className="flex flex-col gap-3"
      >
        <h2 class="font-display text-lg font-semibold leading-tight text-g-text">{{ c.title }}</h2>
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

        <div class="mt-auto flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
          <Button type="button" variant="secondary" size="sm" className="flex-1" @click="copyLink(c.slug)">
            Copy link
          </Button>
          <Button type="button" variant="ghost" size="sm" @click="router.push(`/manage/frames/${c.slug}/edit`)">
            Edit
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            :disabled="deletingId === c.id"
            @click="remove(c.id, c.title)"
          >
            {{ deletingId === c.id ? '…' : 'Delete' }}
          </Button>
        </div>
      </Card>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { useAuth } from '@/composables/useAuth'
import type { DpCampaignSummary } from '@/types/dp'
import OrgLockout from '@/components/OrgLockout.vue'
import OrgSwitcher from '@/components/OrgSwitcher.vue'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

const router = useRouter()
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
    (campaign.description ?? '').toLowerCase().includes(q),
  )
})

function onSearchInput(e: Event) {
  searchQuery.value = (e.target as HTMLInputElement).value
}

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
