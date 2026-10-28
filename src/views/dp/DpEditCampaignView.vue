<template>
  <div class="relative w-full">
    <AppPage title="Edit Campaign">
      <div class="mx-auto w-full max-w-xl">
        <!-- Loading -->
        <DetailSkeleton
          v-if="loading"
          align="center"
          :title-height="32"
          :body-height="288"
        />

        <!-- Not found / error -->
        <Card
          v-else-if="error"
          class="gap-0 rounded-3xl p-8 text-center sm:p-12"
        >
          <p
            role="alert"
            class="font-mono text-sm text-destructive"
          >
            {{ error }}
          </p>
          <Button
            as-child
            variant="outline"
            class="mx-auto mt-6"
          >
            <router-link to="/manage/frames">
              ← All campaigns
            </router-link>
          </Button>
        </Card>

        <template v-else>
          <div class="mb-6 flex items-center justify-between gap-3">
            <p class="min-w-0 break-all font-mono text-sm text-muted-foreground">
              eypi.cc/frames/{{ form.slug }}
            </p>
            <Button
              as-child
              variant="outline"
              class="shrink-0"
            >
              <router-link :to="`/frames/${form.slug}`">
                View →
              </router-link>
            </Button>
          </div>

          <div
            role="tablist"
            aria-label="Campaign sections"
            class="mb-6 flex gap-2"
          >
            <Button
              v-for="(item, index) in tabs"
              :id="`campaign-tab-${item.id}`"
              :key="item.id"
              type="button"
              role="tab"
              :variant="tab === item.id ? 'default' : 'ghost'"
              :aria-selected="tab === item.id"
              aria-controls="campaign-tabpanel"
              :tabindex="tab === item.id ? 0 : -1"
              class="text-sm font-semibold"
              @click="tab = item.id"
              @keydown="onTabKeydown($event, tabs.length, index, (i) => (tab = tabs[i].id))"
            >
              {{ item.label }}
            </Button>
          </div>

          <div
            id="campaign-tabpanel"
            role="tabpanel"
            tabindex="0"
            :aria-labelledby="`campaign-tab-${tab}`"
            class="outline-none"
          >
            <FramesInsights
              v-if="tab === 'insights'"
              :campaign-id="campaignId"
              :public-path="`/frames/${form.slug}`"
            />
            <template v-else>
              <Card class="relative gap-5 rounded-3xl p-5 sm:p-8">
                <!-- Title -->
                <div class="space-y-1.5">
                  <Label for="edit-campaign-title">Title</Label>
                  <Input
                    id="edit-campaign-title"
                    v-model="form.title"
                    type="text"
                    maxlength="200"
                    class="font-mono"
                  />
                </div>

                <!-- Slug -->
                <div class="space-y-1.5">
                  <Label for="edit-campaign-slug">Link</Label>
                  <div class="flex h-11 min-w-0 items-center rounded-xl border border-input bg-transparent px-3.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                    <span class="mr-0.5 shrink-0 font-mono text-sm font-bold text-foreground">eypi.cc/frames/</span>
                    <input
                      id="edit-campaign-slug"
                      v-model="form.slug"
                      type="text"
                      maxlength="60"
                      class="min-w-0 flex-1 bg-transparent font-mono text-base text-foreground outline-none placeholder:text-muted-foreground"
                      @input="sanitizeSlug"
                    >
                  </div>
                </div>

                <!-- Description -->
                <div class="space-y-1.5">
                  <Label for="edit-campaign-description">Description <span class="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="edit-campaign-description"
                    v-model="form.description"
                    type="text"
                    maxlength="1000"
                    class="font-mono"
                  />
                </div>

                <!-- Caption -->
                <div class="space-y-1.5">
                  <Label for="edit-campaign-caption">Caption <span class="text-muted-foreground">(optional)</span></Label>
                  <Textarea
                    id="edit-campaign-caption"
                    v-model="form.captionTemplate"
                    rows="3"
                    maxlength="2000"
                    class="resize-y font-mono"
                  />
                </div>

                <!-- Save metadata -->
                <Button
                  type="button"
                  size="lg"
                  :disabled="saving || !form.title.trim()"
                  class="w-full font-semibold"
                  @click="saveDetails"
                >
                  {{ saving ? 'Saving…' : 'Save Details' }}
                </Button>

                <!-- Frames (persisted immediately) -->
                <div class="border-t border-border pt-5">
                  <p class="mb-1 text-base font-medium">
                    Frames
                  </p>
                  <p class="mb-3 text-xs text-muted-foreground">
                    Changes here save instantly.
                  </p>
                  <DpFrameUploader
                    :frames="frames"
                    :busy-index="frameBusyIndex"
                    @add="onAddFrame"
                    @remove="onRemoveFrame"
                    @reorder="onReorderFrame"
                  />
                </div>
              </Card>

              <div class="mt-6 text-center">
                <Button
                  type="button"
                  variant="destructive"
                  @click="removeCampaign"
                >
                  Delete this campaign
                </Button>
              </div>
            </template>
          </div>
        </template>
      </div>
    </AppPage>
  </div>
</template>

<script setup lang="ts">
import { api } from '@/lib/api'
import AppPage from '@/components/layout/AppPage.vue'
import DetailSkeleton from '@/components/skeletons/DetailSkeleton.vue'
import { defineAsyncComponent, ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useDialog } from '@/composables/useDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import DpFrameUploader from '@/components/dp/DpFrameUploader.vue'
import { onTabKeydown } from '@/lib/tix/tabKeys'
import { uploadVariants } from '@/lib/images/uploadVariants'
import type { DpUploaderFrame, DpFrame } from '@/types/dp'

const FramesInsights = defineAsyncComponent(() => import('@/components/insights/FramesInsights.vue'))
type CampaignTab = 'details' | 'insights'
const tab = ref<CampaignTab>('details')
const tabs: { id: CampaignTab; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'insights', label: 'Insights' },
]

const route = useRoute()
const router = useRouter()
const toast = useToast()
const dialog = useDialog()

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

async function onAddFrame(dataUrl: string, file?: File) {
  frameBusyIndex.value = frames.value.length
  try {
    const res = await api.raw(`/api/dp/${campaignId.value}/frames`, {
      method: 'POST',
      body: JSON.stringify({ imageData: dataUrl }),
    })
    const data = await res.json() as { status: string; message?: string; frame?: { id: string; key?: string } }
    if (!res.ok || !data.frame) throw new Error(data.message ?? 'Could not add frame.')
    frames.value.push({ id: data.frame.id, src: dataUrl })
    toast.success('Frame added.')
    // Best-effort: the frame is saved, so variants never fail the add.
    const key = data.frame.key
    if (file && key) {
      const meta = await uploadVariants(file, 'frame', key).catch(() => null)
      const added = frames.value.find((f) => f.id === data.frame!.id)
      if (meta && added) added.meta = meta
    }
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
    frames.value = data.campaign.frames.map(f => ({ id: f.id, src: f.url, meta: f.imageMeta ?? null }))
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Campaign not found.'
  } finally {
    loading.value = false
  }
})
</script>
