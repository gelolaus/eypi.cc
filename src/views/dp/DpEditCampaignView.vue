<template>
  <div class="relative w-full">
    <AppPage title="Edit Campaign">
    <div class="mx-auto w-full max-w-xl">
      <!-- Loading -->
      <div v-if="loading" role="status" aria-busy="true" class="space-y-4"><span class="sr-only">Loading</span>
        <div class="mx-auto h-8 w-1/2 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-800/60" />
        <div class="h-72 animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800/60" />
      </div>

      <!-- Not found / error -->
      <div
        v-else-if="error"
        class="mica-card rounded-3xl border border-gray-200 p-8 text-center sm:p-12 dark:border-slate-600"
      >
        <p class="font-mono text-sm uppercase tracking-widest text-red-500">{{ error }}</p>
        <router-link to="/manage/frames" class="btn-secondary mt-6">← All campaigns</router-link>
      </div>

      <template v-else>
        <div class="reveal mb-6 flex items-center justify-between gap-3">
          <div>
            <p class="min-w-0 break-all font-mono text-sm text-g-muted">eypi.cc/frames/{{ form.slug }}</p>
          </div>
          <router-link
            :to="`/frames/${form.slug}`"
            class="btn-secondary shrink-0"
          >View →</router-link>
        </div>

        <div class="mica-card reveal delay-1 relative flex flex-col gap-5 rounded-3xl border border-gray-200 p-5 sm:p-8 dark:border-slate-600">
          <!-- Title -->
          <div>
            <label for="edit-campaign-title" class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">Title</label>
            <input id="edit-campaign-title" v-model="form.title" type="text" maxlength="200" class="control font-mono" />
          </div>

          <!-- Slug -->
          <div>
            <label for="edit-campaign-slug" class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">Link</label>
            <div class="control flex items-center focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-[var(--color-focus)]">
              <span class="mr-0.5 shrink-0 font-mono text-sm font-bold text-[#34418F] dark:text-slate-300">eypi.cc/frames/</span>
              <input id="edit-campaign-slug" v-model="form.slug" type="text" maxlength="60" class="min-w-0 flex-1 bg-transparent font-mono text-base text-g-text outline-none placeholder:text-g-muted" @input="sanitizeSlug" />
            </div>
          </div>

          <!-- Description -->
          <div>
            <label for="edit-campaign-description" class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">Description <span class="text-gray-400 dark:text-slate-500">(optional)</span></label>
            <input id="edit-campaign-description" v-model="form.description" type="text" maxlength="1000" class="control font-mono" />
          </div>

          <!-- Caption -->
          <div>
            <label for="edit-campaign-caption" class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">Caption <span class="text-gray-400 dark:text-slate-500">(optional)</span></label>
            <textarea id="edit-campaign-caption" v-model="form.captionTemplate" rows="3" maxlength="2000" class="control resize-y font-mono" />
          </div>

          <!-- Save metadata -->
          <button
            type="button"
            :disabled="saving || !form.title.trim()"
            class="btn-primary w-full"
                        @click="saveDetails"
          >{{ saving ? 'Saving…' : 'Save Details' }}</button>

          <!-- Frames (persisted immediately) -->
          <div class="border-t border-gray-200 pt-5 dark:border-slate-700">
            <p class="mb-1 block text-sm font-semibold text-[#34418F] dark:text-slate-300">Frames</p>
            <p class="mb-3 font-mono text-xs uppercase tracking-wide text-gray-400 dark:text-slate-500">Changes here save instantly.</p>
            <DpFrameUploader :frames="frames" :busy-index="frameBusyIndex" @add="onAddFrame" @remove="onRemoveFrame" @reorder="onReorderFrame" />
          </div>
        </div>

        <div class="reveal delay-2 mt-6 text-center">
          <button
            type="button"
            class="btn-secondary border-red-300 text-red-600 dark:border-red-900/60 dark:text-red-400"
            @click="removeCampaign"
          >Delete this campaign</button>
        </div>
      </template>
    </div>
    </AppPage>
  </div>
</template>

<script setup lang="ts">
import { api } from '@/lib/api'
import AppPage from '@/components/AppPage.vue'
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { useReveal } from '@/composables/useReveal'
import DpFrameUploader from '@/components/dp/DpFrameUploader.vue'
import type { DpUploaderFrame, DpFrame } from '@/types/dp'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const dialog = useDialog()
useReveal()

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
    const res = await api.raw(`/api/dp/${campaignId.value}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: form.title.trim(),
        slug: form.slug.trim().replace(/^-+|-+$/g, ''),
        description: form.description.trim(),
        captionTemplate: form.captionTemplate.trim(),
      }),
    })
    const data = await res.json() as { status: string; message?: string; slug?: string }
    if (!res.ok) throw new Error(data.message ?? 'Save failed.')
    if (data.slug) {
      form.slug = data.slug
      const currentSlug = Array.isArray(route.params.slug) ? route.params.slug[0] : route.params.slug
      if (data.slug !== currentSlug) {
        await router.replace({ name: 'dp-edit', params: { slug: data.slug } })
      }
    }
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
    const res = await api.raw(`/api/dp/${campaignId.value}/frames`, {
      method: 'POST',
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
    const res = await api.raw(`/api/dp/${campaignId.value}/frames/${frame.id}`, { method: 'DELETE' })
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
    const res = await api.raw(`/api/dp/${campaignId.value}/frames/order`, {
      method: 'PATCH',
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
    const res = await api.raw(`/api/dp/${campaignId.value}`, { method: 'DELETE' })
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
    const res = await api.raw(`/api/dp/${slug}/edit`)
    let data: { status?: string; message?: string; campaign?: { id: string; title: string; slug: string; description: string | null; captionTemplate: string | null; frames: DpFrame[] } } = {}
    try { data = await res.json() } catch { /* non-JSON */ }
    if (!res.ok || !data.campaign) throw new Error(data.message ?? 'Campaign not found.')
    campaignId.value = data.campaign.id
    form.title = data.campaign.title
    form.slug = data.campaign.slug
    form.description = data.campaign.description ?? ''
    form.captionTemplate = data.campaign.captionTemplate ?? ''
    frames.value = data.campaign.frames.map(f => ({ id: f.id, src: f.url }))
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Campaign not found.'
  } finally {
    loading.value = false
  }
})
</script>
