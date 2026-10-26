<template>
  <div class="relative w-full">
    <AppPage title="New DP Blast">
      <div class="mx-auto w-full max-w-xl">
        <!-- Success state -->
        <Card
          v-if="created"
          class="relative gap-0 rounded-3xl p-5 text-center sm:p-8"
        >
          <p class="mb-2 text-sm font-medium text-primary">
            Campaign Created
          </p>
          <h2 class="mb-6 font-mono text-xl font-bold text-foreground">
            {{ form.title }}
          </h2>

          <div class="mb-6 flex items-center gap-2 rounded-xl border border-input bg-muted px-4 py-3">
            <span class="min-w-0 flex-1 truncate text-left font-mono text-sm font-bold text-foreground">{{ shareDisplay }}</span>
            <Button
              type="button"
              class="min-w-11 shrink-0"
              @click="copyShare"
            >
              Copy
            </Button>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button as-child>
              <router-link :to="`/frames/${createdSlug}`">
                Open Public Page →
              </router-link>
            </Button>
            <Button
              as-child
              variant="outline"
            >
              <router-link to="/manage/frames">
                All Campaigns
              </router-link>
            </Button>
          </div>
        </Card>

        <!-- Form -->
        <Card
          v-else
          class="relative gap-0 rounded-3xl p-5 sm:p-8"
        >
          <form
            class="flex flex-col gap-5"
            @submit.prevent="submit"
          >
            <!-- Title -->
            <div class="space-y-1.5">
              <Label for="new-campaign-title">Title</Label>
              <Input
                id="new-campaign-title"
                v-model="form.title"
                type="text"
                maxlength="200"
                placeholder="e.g. I'm attending CompSci Week 2026"
                required
                class="font-mono"
              />
            </div>

            <!-- Slug -->
            <div class="space-y-1.5">
              <Label for="new-campaign-slug">Link <span class="text-muted-foreground">(optional, auto from title)</span></Label>
              <div class="flex h-11 min-w-0 items-center rounded-xl border border-input bg-transparent px-3.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
                <span class="mr-0.5 shrink-0 font-mono text-sm font-bold text-foreground">eypi.cc/frames/</span>
                <input
                  id="new-campaign-slug"
                  v-model="form.slug"
                  type="text"
                  maxlength="60"
                  placeholder="compsci-week"
                  class="min-w-0 flex-1 bg-transparent font-mono text-base text-foreground outline-none placeholder:text-muted-foreground"
                  @input="sanitizeSlug"
                >
              </div>
              <p class="text-xs font-medium text-muted-foreground">
                Lowercase letters, numbers, and hyphens.
              </p>
            </div>

            <!-- Description -->
            <div class="space-y-1.5">
              <Label for="new-campaign-description">Description <span class="text-muted-foreground">(optional)</span></Label>
              <Input
                id="new-campaign-description"
                v-model="form.description"
                type="text"
                maxlength="1000"
                placeholder="A short line shown on the public page"
                class="font-mono"
              />
            </div>

            <!-- Caption template -->
            <div class="space-y-1.5">
              <Label for="new-campaign-caption">Caption <span class="text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="new-campaign-caption"
                v-model="form.captionTemplate"
                rows="3"
                maxlength="2000"
                placeholder="The suggested caption people copy when they share…"
                class="resize-y font-mono"
              />
            </div>

            <!-- Frames -->
            <div class="space-y-1.5">
              <p class="text-base font-medium">
                Frames <span class="text-muted-foreground">(at least one)</span>
              </p>
              <DpFrameUploader
                :frames="frames"
                @add="onAddFrame"
                @remove="onRemoveFrame"
                @reorder="onReorderFrame"
              />
            </div>

            <!-- Submit -->
            <Button
              type="submit"
              size="lg"
              :disabled="!canSubmit || submitting"
              class="mt-2 w-full font-semibold"
            >
              {{ submitting ? 'Creating…' : 'Create Campaign' }}
            </Button>
          </form>
        </Card>
      </div>
    </AppPage>
  </div>
</template>

<script setup lang="ts">
import AppPage from '@/components/layout/AppPage.vue'
import { api } from '@/lib/api'
import { ref, reactive, computed } from 'vue'
import { useToast } from '@/composables/useToast'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import DpFrameUploader from '@/components/dp/DpFrameUploader.vue'
import type { DpUploaderFrame } from '@/types/dp'

const toast = useToast()

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
  const arr = frames.value
  const [moved] = arr.splice(from, 1)
  arr.splice(to, 0, moved)
}

async function submit() {
  if (!canSubmit.value || submitting.value) return
  submitting.value = true
  try {
    const res = await api.raw(`/api/dp`, {
      method: 'POST',
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
    await navigator.clipboard.writeText(`https://eypi.cc/frames/${createdSlug.value}`)
    toast.success('Link copied to clipboard!')
  } catch {
    toast.error('Could not copy the link.')
  }
}
</script>
