<template>
  <section class="relative flex min-h-screen w-full flex-col items-center px-4 py-24">
    <div class="w-full max-w-xl">
      <!-- Loading -->
      <div v-if="loading" class="space-y-4">
        <div class="mx-auto h-8 w-1/2 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-800/60" />
        <div class="h-72 animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800/60" />
      </div>

      <!-- Not found / error -->
      <div
        v-else-if="error"
        class="mica-card rounded-3xl border border-gray-200 p-12 text-center dark:border-slate-600"
      >
        <p class="font-mono text-sm uppercase tracking-widest text-red-500">{{ error }}</p>
        <router-link to="/manage/frames" class="mt-6 inline-block font-mono text-xs uppercase tracking-widest text-[#34418F] hover:text-[#DEAC4B] dark:text-slate-300">← All campaigns</router-link>
      </div>

      <template v-else>
        <div class="reveal mb-8 flex items-center justify-between">
          <div>
            <h1 class="font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200" style="font-size: clamp(1.75rem, 5vw, 2.5rem); letter-spacing: -0.03em;" data-cursor="text">Edit Campaign</h1>
            <p class="mt-1 font-mono text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">eypi.cc/frames/{{ form.slug }}</p>
          </div>
          <router-link
            :to="`/frames/${form.slug}`"
            class="shrink-0 rounded-lg border-2 border-gray-200 px-4 py-2 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-300"
          >View →</router-link>
        </div>

        <div class="mica-card reveal delay-1 relative flex flex-col gap-5 rounded-3xl border border-gray-200 p-8 md:p-10 dark:border-slate-600">
          <!-- Title -->
          <div>
            <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Title</label>
            <input v-model="form.title" type="text" maxlength="200" class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500" />
          </div>

          <!-- Slug -->
          <div>
            <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Link</label>
            <div class="flex items-center rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 transition-colors focus-within:border-[#34418F] dark:border-slate-600 dark:bg-mica-navy-input dark:focus-within:border-slate-500">
              <span class="mr-0.5 shrink-0 font-mono text-sm font-bold text-[#34418F] dark:text-slate-300">eypi.cc/frames/</span>
              <input v-model="form.slug" type="text" maxlength="60" class="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none text-gray-900 dark:text-slate-200" @input="sanitizeSlug" />
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Description <span class="text-gray-400 dark:text-slate-500">(optional)</span></label>
            <input v-model="form.description" type="text" maxlength="1000" class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500" />
          </div>

          <!-- Caption -->
          <div>
            <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Caption <span class="text-gray-400 dark:text-slate-500">(optional)</span></label>
            <textarea v-model="form.captionTemplate" rows="3" maxlength="2000" class="w-full resize-y rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm leading-relaxed outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:focus:border-slate-500" />
          </div>

          <!-- Save metadata -->
          <button
            type="button"
            :disabled="saving || !form.title.trim()"
            class="w-full rounded-xl bg-[#34418F] px-8 py-3.5 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all dark:bg-slate-700 dark:text-slate-100"
            :class="(saving || !form.title.trim()) ? 'cursor-not-allowed opacity-50' : 'hover:bg-[#2a3578]'"
            @click="saveDetails"
          >{{ saving ? 'Saving…' : 'Save Details' }}</button>

          <!-- Frames (persisted immediately) -->
          <div class="border-t border-gray-200 pt-5 dark:border-slate-700">
            <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Frames</label>
            <p class="mb-3 font-mono text-[0.65rem] uppercase tracking-wide text-gray-400 dark:text-slate-500">Changes here save instantly.</p>
            <DpFrameUploader :frames="frames" :busy-index="frameBusyIndex" @add="onAddFrame" @remove="onRemoveFrame" @reorder="onReorderFrame" />
          </div>
        </div>

        <div class="reveal delay-2 mt-6 text-center">
          <button
            type="button"
            class="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-red-400 transition-colors hover:text-red-500"
            @click="removeCampaign"
          >Delete this campaign</button>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/composables/useToast'
import { useReveal } from '@/composables/useReveal'
import { useAuth } from '@/composables/useAuth'
import DpFrameUploader from '@/components/dp/DpFrameUploader.vue'
import type { DpUploaderFrame, DpFrame } from '@/types/dp'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { authHeaders } = useAuth()
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
  if (!confirm('Delete this campaign?\n\nThis permanently removes it, its frames, and its public page. This cannot be undone.')) return
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
