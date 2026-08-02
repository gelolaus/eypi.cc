<template>
  <section class="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl flex-col px-4 py-12">
    <header class="mb-8 text-center">
      <h1 class="font-display text-3xl font-bold text-g-text">New Campaign</h1>
      <p class="mt-2 text-sm text-g-muted">Upload frames and share a public link.</p>
    </header>

    <Card v-if="created" className="text-center">
      <p class="mb-2 text-sm font-medium text-emerald-600">Campaign created</p>
      <h2 class="mb-6 font-display text-xl font-semibold text-g-text">{{ form.title }}</h2>

      <div class="mb-6 flex items-center gap-2 rounded-xl border border-g-border bg-g-bg px-4 py-3">
        <span class="min-w-0 flex-1 truncate text-left font-mono text-sm font-semibold text-g-text">{{ shareDisplay }}</span>
        <Button type="button" variant="secondary" size="sm" @click="copyShare">Copy</Button>
      </div>

      <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <router-link :to="`/frames/${createdSlug}`" :class="buttonVariants({ variant: 'primary' })">
          Open public page
        </router-link>
        <router-link to="/manage/frames" :class="buttonVariants({ variant: 'secondary' })">
          All campaigns
        </router-link>
      </div>
    </Card>

    <Card v-else>
      <form class="flex flex-col gap-5" @submit.prevent="submit">
        <div>
          <label class="mb-1.5 block text-sm font-medium text-g-muted">Title</label>
          <input
            v-model="form.title"
            type="text"
            maxlength="200"
            placeholder="e.g. I'm attending CompSci Week 2026"
            required
            :class="fieldClasses()"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-g-muted">
            Link <span class="font-normal text-g-muted">(optional — auto from title)</span>
          </label>
          <div class="flex items-center rounded-xl border border-g-border bg-g-surface px-4 focus-within:ring-2 focus-within:ring-[var(--color-ring)]">
            <span class="mr-0.5 shrink-0 font-mono text-sm font-semibold text-g-muted">eypi.cc/frames/</span>
            <input
              v-model="form.slug"
              type="text"
              maxlength="60"
              placeholder="compsci-week"
              class="h-11 min-w-0 flex-1 bg-transparent font-mono text-sm text-g-text outline-none placeholder:text-g-muted"
              @input="sanitizeSlug"
            />
          </div>
          <p class="mt-1 text-xs text-g-muted">Lowercase letters, numbers, and hyphens.</p>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-g-muted">
            Description <span class="font-normal text-g-muted">(optional)</span>
          </label>
          <input
            v-model="form.description"
            type="text"
            maxlength="1000"
            placeholder="A short line shown on the public page"
            :class="fieldClasses()"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-g-muted">
            Caption <span class="font-normal text-g-muted">(optional)</span>
          </label>
          <textarea
            v-model="form.captionTemplate"
            rows="3"
            maxlength="2000"
            placeholder="The suggested caption people copy when they share…"
            :class="textareaClasses()"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-medium text-g-muted">
            Frames <span class="font-normal text-g-muted">(at least one)</span>
          </label>
          <DpFrameUploader :frames="frames" @add="onAddFrame" @remove="onRemoveFrame" @reorder="onReorderFrame" />
        </div>

        <Button type="submit" className="w-full" :disabled="!canSubmit || submitting">
          {{ submitting ? 'Creating…' : 'Create Campaign' }}
        </Button>
      </form>
    </Card>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { API_BASE_URL } from '@/config/api'
import { useToast } from '@/composables/useToast'
import { useAuth } from '@/composables/useAuth'
import DpFrameUploader from '@/components/dp/DpFrameUploader.vue'
import type { DpUploaderFrame } from '@/types/dp'
import Card from '@/components/ui/Card.vue'
import Button from '@/components/ui/Button.vue'
import { buttonVariants } from '@/lib/ui/buttonVariants'
import { fieldClasses, textareaClasses } from '@/lib/ui/fieldClasses'

const toast = useToast()
const { authHeaders } = useAuth()

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
const shareDisplay = computed(() => `eypi.cc/frames/${createdSlug.value}`)

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
  const [moved] = frames.value.splice(from, 1)
  frames.value.splice(to, 0, moved)
}

async function copyShare() {
  try {
    await navigator.clipboard.writeText(`https://eypi.cc/frames/${createdSlug.value}`)
    toast.success('Link copied to clipboard!')
  } catch {
    toast.error('Could not copy the link.')
  }
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
</script>
