<template>
  <section class="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl flex-col px-4 py-12">
    <div v-if="loading" class="space-y-4">
      <div class="mx-auto h-8 w-1/2 animate-pulse rounded-lg bg-g-border" />
      <Card className="h-72 animate-pulse" />
    </div>

    <Card v-else-if="error" className="text-center">
      <p class="text-sm text-g-destructive">{{ error }}</p>
      <router-link to="/manage/frames" class="mt-6 inline-block text-sm font-semibold text-g-primary hover:text-g-accent">
        ← All campaigns
      </router-link>
    </Card>

    <template v-else>
      <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="font-display text-3xl font-bold text-g-text">Edit Campaign</h1>
          <p class="mt-1 text-sm text-g-muted">eypi.cc/frames/{{ form.slug }}</p>
        </div>
        <router-link
          :to="`/frames/${form.slug}`"
          :class="buttonVariants({ variant: 'secondary', size: 'sm' })"
        >
          View →
        </router-link>
      </div>

      <Card className="flex flex-col gap-5">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-g-muted">Title</label>
          <input v-model="form.title" type="text" maxlength="200" :class="fieldClasses()" />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-g-muted">Link</label>
          <div class="flex items-center rounded-xl border border-g-border bg-g-surface px-4 focus-within:ring-2 focus-within:ring-[var(--color-ring)]">
            <span class="mr-0.5 shrink-0 font-mono text-sm font-semibold text-g-muted">eypi.cc/frames/</span>
            <input
              v-model="form.slug"
              type="text"
              maxlength="60"
              class="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm text-g-text outline-none"
              @input="sanitizeSlug"
            />
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-g-muted">
            Description <span class="font-normal text-g-muted">(optional)</span>
          </label>
          <input v-model="form.description" type="text" maxlength="1000" :class="fieldClasses()" />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-g-muted">
            Caption <span class="font-normal text-g-muted">(optional)</span>
          </label>
          <textarea v-model="form.captionTemplate" rows="3" maxlength="2000" :class="textareaClasses()" />
        </div>

        <Button type="button" className="w-full" :disabled="saving || !form.title.trim()" @click="saveDetails">
          {{ saving ? 'Saving…' : 'Save Details' }}
        </Button>

        <div class="border-t border-g-border pt-5">
          <label class="mb-1.5 block text-sm font-medium text-g-muted">Frames</label>
          <p class="mb-3 text-xs text-g-muted">Changes here save instantly.</p>
          <DpFrameUploader :frames="frames" :busy-index="frameBusyIndex" @add="onAddFrame" @remove="onRemoveFrame" @reorder="onReorderFrame" />
        </div>
      </Card>

      <div class="mt-6 text-center">
        <Button type="button" variant="ghost" className="text-g-destructive hover:text-g-destructive" @click="removeCampaign">
          Delete this campaign
        </Button>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { useAuth } from '@/composables/useAuth'
import DpFrameUploader from '@/components/dp/DpFrameUploader.vue'
import type { DpUploaderFrame, DpFrame } from '@/types/dp'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import { buttonVariants } from '@/lib/ui/buttonVariants'
import { fieldClasses, textareaClasses } from '@/lib/ui/fieldClasses'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const dialog = useDialog()
const { authHeaders } = useAuth()

const slug = route.params.slug as string
const campaignId = ref('')

const loading = ref(true)
const error = ref('')
const saving = ref(false)
const frameBusyIndex = ref<number | null>(null)

const form = reactive({ title: '', slug: '', description: '', captionTemplate: '' })
const frames = ref<DpUploaderFrame[]>([])

function sanitizeSlug(e: Event) {
  const t = e.target as HTMLInputElement
  form.slug = t.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-')
}

async function saveDetails() {
  if (saving.value || !form.title.trim()) return
  saving.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/dp/${campaignId.value}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({
        title: form.title.trim(),
        slug: form.slug.trim().replace(/^-+|-+$/g, ''),
        description: form.description.trim(),
        captionTemplate: form.captionTemplate.trim(),
      }),
    })
    const data = await res.json() as { status: string; message?: string; slug?: string }
    if (!res.ok) throw new Error(data.message ?? 'Save failed.')
    if (data.slug) form.slug = data.slug
    toast.success('Saved.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Save failed.')
  } finally {
    saving.value = false
  }
}

async function onAddFrame(dataUrl: string) {
  frameBusyIndex.value = frames.value.length
  try {
    const res = await fetch(`${API_BASE_URL}/api/dp/${campaignId.value}/frames`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ imageData: dataUrl }),
    })
    const data = await res.json() as { status: string; message?: string; frame?: { id: string } }
    if (!res.ok || !data.frame) throw new Error(data.message ?? 'Could not add frame.')
    frames.value.push({ id: data.frame.id, src: dataUrl })
    toast.success('Frame added.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Could not add frame.')
  } finally {
    frameBusyIndex.value = null
  }
}

async function onRemoveFrame(index: number) {
  const frame = frames.value[index]
  if (!frame?.id) { frames.value.splice(index, 1); return }
  if (frames.value.length <= 1) { toast.error('A campaign needs at least one frame.'); return }
  frameBusyIndex.value = index
  try {
    const res = await fetch(`${API_BASE_URL}/api/dp/${campaignId.value}/frames/${frame.id}`, { method: 'DELETE', headers: authHeaders() })
    const data = await res.json() as { status: string; message?: string }
    if (!res.ok) throw new Error(data.message ?? 'Could not remove frame.')
    frames.value.splice(index, 1)
    toast.success('Frame removed.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Could not remove frame.')
  } finally {
    frameBusyIndex.value = null
  }
}

async function onReorderFrame(from: number, to: number) {
  if (from === to) return
  const arr = frames.value
  const [moved] = arr.splice(from, 1)
  arr.splice(to, 0, moved) // optimistic
  try {
    const res = await fetch(`${API_BASE_URL}/api/dp/${campaignId.value}/frames/order`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ orderedIds: arr.map(f => f.id as string) }),
    })
    const data = await res.json() as { status: string; message?: string }
    if (!res.ok) throw new Error(data.message ?? 'Could not save order.')
  } catch (err: unknown) {
    // Revert the optimistic move on failure.
    const [back] = arr.splice(to, 1)
    arr.splice(from, 0, back)
    toast.error(err instanceof Error ? err.message : 'Could not save order.')
  }
}

async function removeCampaign() {
  const campaignName = form.title || form.slug
  const ok = await dialog.confirm({
    title: 'Delete this campaign?',
    body: `Removes "${campaignName}", its frames, and its public page. This cannot be undone.`,
    confirmLabel: 'Delete campaign',
    requireText: campaignName,
  })
  if (!ok) return
  try {
    const res = await fetch(`${API_BASE_URL}/api/dp/${campaignId.value}`, { method: 'DELETE', headers: authHeaders() })
    const data = await res.json() as { status: string; message?: string }
    if (!res.ok) throw new Error(data.message ?? 'Delete failed.')
    toast.success('Campaign deleted.')
    router.push('/manage/frames')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Delete failed.')
  }
}

onMounted(async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/dp/${slug}/edit`, { headers: authHeaders() })
    let data: { status?: string; message?: string; campaign?: { id: string; title: string; slug: string; description: string | null; captionTemplate: string | null; frames: DpFrame[] } } = {}
    try { data = await res.json() } catch { /* non-JSON */ }
    if (!res.ok || !data.campaign) throw new Error(data.message ?? 'Campaign not found.')
    campaignId.value = data.campaign.id
    form.title = data.campaign.title
    form.slug = data.campaign.slug
    form.description = data.campaign.description ?? ''
    form.captionTemplate = data.campaign.captionTemplate ?? ''
    frames.value = data.campaign.frames.map(f => ({ id: f.id, src: f.imageUrl }))
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Campaign not found.'
  } finally {
    loading.value = false
  }
})
</script>
