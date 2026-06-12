<template>
  <section class="relative mx-auto w-full max-w-5xl px-6 py-16">
    <div class="mb-10 flex items-end justify-between">
      <div>
        <h1
          class="font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200"
          style="font-size: clamp(2rem, 5vw, 3.5rem); letter-spacing: -0.03em;"
          data-cursor="text"
        >DP Blast</h1>
        <p class="mt-1 font-mono text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">Profile-frame campaigns</p>
      </div>
      <router-link
        v-if="!isLocked"
        to="/manage/frames/new"
        class="rounded-xl bg-[#DEAC4B] px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 dark:bg-eypi-gold-dark dark:text-slate-100 dark:hover:bg-eypi-gold-hover"
        data-cursor="cta"
      >New Campaign</router-link>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-44 animate-pulse rounded-3xl bg-gray-200 dark:bg-slate-800/60" />
    </div>

    <!-- Lockout state -->
    <div v-else-if="isLocked">
      <OrgLockout />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center font-mono text-sm text-red-500 dark:border-red-900/40 dark:bg-red-900/10">{{ error }}</div>

    <!-- Empty state -->
    <div
      v-else-if="!campaigns.length"
      class="mica-card relative rounded-3xl border border-gray-200 p-12 text-center dark:border-slate-600"
    >
      <div class="absolute left-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute right-3 top-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 left-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <div class="absolute bottom-3 right-3 h-2 w-2 rounded-full bg-gray-400 shadow-inner" />
      <p class="font-mono text-sm uppercase tracking-widest text-gray-500 dark:text-slate-400">No campaigns yet</p>
      <p class="mt-3 font-mono text-xs leading-relaxed text-gray-400 dark:text-slate-500">Upload transparent PNG frames to generate a shareable DP Blast link.</p>
    </div>

    <!-- Campaign grid -->
    <div v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="c in campaigns"
        :key="c.id"
        class="mica-card flex flex-col gap-3 rounded-3xl border border-gray-200 p-6 dark:border-slate-600"
      >
        <h2 class="font-mono text-lg font-bold leading-tight text-[#34418F] dark:text-slate-200">{{ c.title }}</h2>
        <p v-if="c.description" class="line-clamp-2 font-mono text-xs leading-relaxed text-gray-500 dark:text-slate-400">{{ c.description }}</p>

        <div class="mt-1 flex items-end gap-4 font-mono">
          <div class="flex items-baseline gap-1.5">
            <span class="text-2xl font-black text-[#34418F] dark:text-slate-200">{{ c.downloadCount }}</span>
            <span class="text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">download{{ c.downloadCount === 1 ? '' : 's' }}</span>
          </div>
          <div class="flex items-baseline gap-1.5">
            <span class="text-2xl font-black text-[#34418F] dark:text-slate-200">{{ c.frameCount }}</span>
            <span class="text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">frame{{ c.frameCount === 1 ? '' : 's' }}</span>
          </div>
        </div>

        <p class="truncate font-mono text-[0.7rem] text-gray-400 dark:text-slate-500">eypi.cc/frames/{{ c.slug }}</p>

        <div class="mt-auto flex items-center gap-2 pt-2">
          <button
            type="button"
            class="flex-1 rounded-lg bg-[#34418F] px-3 py-2 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#2a3578] dark:bg-slate-700 dark:hover:bg-slate-600"
            @click="copyLink(c.slug)"
          >Copy Link</button>
          <router-link
            :to="`/manage/frames/${c.slug}/edit`"
            class="rounded-lg border border-gray-200 px-3 py-2 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
            data-cursor="nav"
          >Edit</router-link>
          <button
            :disabled="deletingId === c.id"
            class="rounded-lg border border-red-200 px-3 py-2 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-red-400 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:border-red-900/40 dark:text-red-400/70 dark:hover:border-red-700/60 dark:hover:bg-red-900/10 dark:hover:text-red-400"
            @click="remove(c.id, c.title)"
          >{{ deletingId === c.id ? '…' : 'Delete' }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import type { DpCampaignSummary } from '@/types/dp'
import OrgLockout from '@/components/OrgLockout.vue'

const toast = useToast()
const { authHeaders } = useAuth()

const campaigns = ref<DpCampaignSummary[]>([])
const loading = ref(true)
const error = ref('')
const isLocked = ref(false)
const deletingId = ref<string | null>(null)

async function copyLink(slug: string) {
  try {
    await navigator.clipboard.writeText(`https://eypi.cc/frames/${slug}`)
    toast.success('Link copied to clipboard!')
  } catch {
    toast.error('Could not copy the link.')
  }
}

async function remove(id: string, title: string) {
  if (!confirm(`Delete "${title}"?\n\nThis permanently removes the campaign, its frames, and its public page. This cannot be undone.`)) return
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
