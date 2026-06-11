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
        Upload a frame · share a link
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
            :to="`/dp/${createdId}`"
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
            rows="4"
            maxlength="2000"
            placeholder="The suggested caption people copy when they share…"
            class="w-full resize-y rounded-lg border-2 border-gray-200 bg-white/50 px-4 py-3 font-mono text-sm leading-relaxed outline-none transition-colors focus:border-[#34418F] dark:bg-mica-navy-input dark:border-slate-600 dark:text-slate-200 dark:placeholder-slate-400 dark:focus:border-slate-500"
          />
        </div>

        <!-- Frame upload drop-zone -->
        <div>
          <label class="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-[#34418F] dark:text-slate-300">Frame <span class="text-gray-400 dark:text-slate-500">(transparent PNG, ≤2 MB)</span></label>

          <div
            class="dp-dropzone relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors"
            :class="dragging ? 'dp-dropzone--active' : ''"
            @click="fileInput?.click()"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
          >
            <input ref="fileInput" type="file" accept="image/png" class="hidden" @change="onFilePicked" />

            <template v-if="framePreview">
              <div class="dp-checker mb-3 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700">
                <img :src="framePreview" alt="Frame preview" class="mx-auto block max-h-48 w-auto" />
              </div>
              <p class="font-mono text-[0.65rem] uppercase tracking-widest text-gray-400 dark:text-slate-500">Click to replace</p>
            </template>
            <template v-else>
              <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-gray-300 text-gray-400 dark:border-slate-600 dark:text-slate-500">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.9A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <p class="font-mono text-sm font-bold text-gray-500 dark:text-slate-400">Drop your PNG frame here</p>
              <p class="mt-1 font-mono text-[0.65rem] uppercase tracking-widest text-gray-400 dark:text-slate-500">or click to browse</p>
            </template>
          </div>
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

const toast = useToast()
const { authHeaders } = useAuth()
useReveal()

const FRAME_MAX_BYTES = 2 * 1024 * 1024

const form = reactive({
  title: '',
  description: '',
  captionTemplate: '',
})

const fileInput = ref<HTMLInputElement | null>(null)
const framePreview = ref('') // data:image/png;base64,…
const dragging = ref(false)
const submitting = ref(false)
const created = ref(false)
const createdId = ref('')

const canSubmit = computed(() => !!form.title.trim() && !!framePreview.value)
const shareDisplay = computed(() => `eypi.cc/dp/${createdId.value}`)

function readFrame(file: File) {
  if (file.type !== 'image/png') {
    toast.error('Frame must be a transparent PNG.')
    return
  }
  if (file.size > FRAME_MAX_BYTES) {
    toast.error('Frame must be smaller than 2 MB.')
    return
  }
  const reader = new FileReader()
  reader.onload = () => { framePreview.value = reader.result as string }
  reader.onerror = () => toast.error('Could not read that file.')
  reader.readAsDataURL(file)
}

function onFilePicked(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) readFrame(file)
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) readFrame(file)
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
        description: form.description.trim(),
        captionTemplate: form.captionTemplate.trim(),
        frameImage: framePreview.value,
      }),
    })
    const data = await res.json() as { status: string; message?: string; campaign?: { id: string } }
    if (!res.ok || !data.campaign) throw new Error(data.message ?? 'Failed to create campaign.')
    createdId.value = data.campaign.id
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
    await navigator.clipboard.writeText(`https://eypi.cc/dp/${createdId.value}`)
    toast.success('Link copied to clipboard!')
  } catch {
    toast.error('Could not copy the link.')
  }
}
</script>

<style scoped>
.dp-dropzone {
  border-color: var(--color-border);
  cursor: pointer;
}
.dp-dropzone:hover,
.dp-dropzone--active {
  border-color: #DEAC4B;
}
.dp-checker {
  background-color: #ffffff;
  background-image:
    linear-gradient(45deg, #e9e9e9 25%, transparent 25%),
    linear-gradient(-45deg, #e9e9e9 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e9e9e9 75%),
    linear-gradient(-45deg, transparent 75%, #e9e9e9 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}
:global(html.dark) .dp-checker {
  background-color: #0d0d0d;
  background-image:
    linear-gradient(45deg, #1c1c1c 25%, transparent 25%),
    linear-gradient(-45deg, #1c1c1c 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1c1c1c 75%),
    linear-gradient(-45deg, transparent 75%, #1c1c1c 75%);
}
</style>
