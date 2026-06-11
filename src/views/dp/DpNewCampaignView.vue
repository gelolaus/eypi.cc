<template>
  <section class="relative flex min-h-screen w-full flex-col items-center px-4 py-24">
    <div class="w-full max-w-xl">
      <h1
        class="reveal mb-2 text-center font-mono font-black tracking-tight text-[#34418F] dark:text-slate-200"
        style="font-size: clamp(2rem, 5vw, 3rem); letter-spacing: -0.03em;"
        data-cursor="text"
      >
        New DP Blast
      </h1>
      <p class="reveal delay-1 mb-8 text-center font-mono text-xs uppercase tracking-widest text-gray-500 dark:text-slate-400">
        Upload frames · share a link
      </p>

      <!-- Success state -->
      <div
        v-if="created"
        class="mica-card reveal relative rounded-3xl border border-gray-200 p-8 text-center dark:border-slate-600"
      >
        <p class="mb-2 font-mono text-xs uppercase tracking-widest text-emerald-500">Campaign Created</p>
        <h2 class="mb-6 font-mono text-xl font-bold text-[#34418F] dark:text-slate-200">{{ form.title }}</h2>

        <div class="mb-6 flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white/50 px-4 py-3 dark:border-slate-600 dark:bg-mica-navy-input">
          <span class="min-w-0 flex-1 truncate text-left font-mono text-sm font-bold text-[#34418F] dark:text-slate-200">{{ shareDisplay }}</span>
          <button
            type="button"
            class="shrink-0 rounded-lg bg-[#34418F] px-3 py-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#2a3578] dark:bg-slate-700 dark:hover:bg-slate-600"
            @click="copyShare"
          >Copy</button>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <router-link
            :to="`/dp/${createdSlug}`"
            class="rounded-xl bg-[#DEAC4B] px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 dark:bg-eypi-gold-dark dark:text-slate-100"
            data-cursor="cta"
          >Open Public Page →</router-link>
          <router-link
            to="/manage/dp-blast"
            class="rounded-xl border-2 border-gray-200 px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-gray-500 transition-colors hover:border-[#34418F] hover:text-[#34418F] dark:border-slate-600 dark:text-slate-300"
          >All Campaigns</router-link>
        </div>
      </div>

      <!-- Form -->
      <form
        v-else
        class="mica-card reveal delay-1 relative flex flex-col gap-5 rounded-3xl border border-gray-200 p-8 md:p-10 dark:border-slate-600"
        @submit.prevent="submit"
      >
        <!-- Title -->
        <div>
          <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Title</label>
          <input
            v-model="form.title"
            type="text"
            maxlength="200"
            placeholder="e.g. I'm attending CompSci Week 2026"
            required
            class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
          />
        </div>

        <!-- Slug -->
        <div>
          <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Link <span class="text-gray-400 dark:text-slate-500">(optional — auto from title)</span></label>
          <div class="flex items-center rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 transition-colors focus-within:border-[#34418F] dark:border-slate-600 dark:bg-mica-navy-input dark:focus-within:border-slate-500">
            <span class="mr-0.5 shrink-0 font-mono text-sm font-bold text-[#34418F] dark:text-slate-300">eypi.cc/dp/</span>
            <input
              v-model="form.slug"
              type="text"
              maxlength="60"
              placeholder="compsci-week"
              class="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none text-gray-900 placeholder-gray-400 dark:text-slate-200 dark:placeholder-slate-500"
              @input="sanitizeSlug"
            />
          </div>
          <p class="mt-1 font-mono text-[0.65rem] uppercase tracking-wide text-gray-400 dark:text-slate-500">Lowercase letters, numbers, and hyphens.</p>
        </div>

        <!-- Description -->
        <div>
          <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Description <span class="text-gray-400 dark:text-slate-500">(optional)</span></label>
          <input
            v-model="form.description"
            type="text"
            maxlength="1000"
            placeholder="A short line shown on the public page"
            class="w-full rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
          />
        </div>

        <!-- Caption template -->
        <div>
          <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Caption <span class="text-gray-400 dark:text-slate-500">(optional)</span></label>
          <textarea
            v-model="form.captionTemplate"
            rows="3"
            maxlength="2000"
            placeholder="The suggested caption people copy when they share…"
            class="w-full resize-y rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm leading-relaxed outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
          />
        </div>

        <!-- Frames -->
        <div>
          <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Frames <span class="text-gray-400 dark:text-slate-500">(at least one)</span></label>
          <DpFrameUploader :frames="frames" @add="onAddFrame" @remove="onRemoveFrame" @reorder="onReorderFrame" />
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="!canSubmit || submitting"
          class="mt-2 w-full rounded-xl bg-[#DEAC4B] px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider text-white transition-all dark:bg-eypi-gold-dark dark:text-slate-100"
          :class="(!canSubmit || submitting) ? 'cursor-not-allowed opacity-50' : 'hover:brightness-110 hover:-translate-y-0.5'"
        >
          {{ submitting ? 'Creating…' : 'Create Campaign' }}
        </button>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/composables/useToast'
import { useReveal } from '@/composables/useReveal'
import { useAuth } from '@/composables/useAuth'
import DpFrameUploader from '@/components/dp/DpFrameUploader.vue'
import type { DpUploaderFrame } from '@/types/dp'

const toast = useToast()
const { authHeaders } = useAuth()
useReveal()

const form = reactive({
  title: '',
  slug: '',
  description: '',
  captionTemplate: '',
})

const frames = ref<DpUploaderFrame[]>([])
const submitting = ref(false)
const created = ref(false)
const createdSlug = ref('')

const canSubmit = computed(() => !!form.title.trim() && frames.value.length > 0)
const shareDisplay = computed(() => `eypi.cc/dp/${createdSlug.value}`)

function sanitizeSlug(e: Event) {
  const t = e.target as HTMLInputElement
  form.slug = t.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-')
}

function onAddFrame(dataUrl: string) {
  frames.value.push({ src: dataUrl })
}
function onRemoveFrame(index: number) {
  frames.value.splice(index, 1)
}
function onReorderFrame(from: number, to: number) {
  if (from === to) return
  const arr = frames.value
  const [moved] = arr.splice(from, 1)
  arr.splice(to, 0, moved)
}

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/api/dp`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: form.title.trim(),
        slug: form.slug.trim().replace(/^-+|-+$/g, ''),
        description: form.description.trim(),
        captionTemplate: form.captionTemplate.trim(),
        frames: frames.value.map(f => ({ imageData: f.src })),
      }),
    })
    const data = await res.json() as { status: string; message?: string; campaign?: { id: string; slug: string } }
    if (!res.ok || !data.campaign) throw new Error(data.message ?? 'Failed to create campaign.')
    createdSlug.value = data.campaign.slug
    created.value = true
    toast.success('Campaign created!')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Failed to create campaign.')
  } finally {
    submitting.value = false
  }
}

async function copyShare() {
  try {
    await navigator.clipboard.writeText(`https://eypi.cc/dp/${createdSlug.value}`)
    toast.success('Link copied to clipboard!')
  } catch {
    toast.error('Could not copy the link.')
  }
}
</script>
