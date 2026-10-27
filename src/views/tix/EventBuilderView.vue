<template>
  <div class="relative w-full">
    <PageSkeleton v-if="loading" />
    <AppPage
      v-else
      :title="isEdit ? 'Edit event' : 'New event'"
    >
      <div
        v-if="loadError"
        role="alert"
        class="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive"
      >
        {{ loadError }}
        <router-link
          to="/manage/tix"
          class="mt-3 block font-medium underline"
        >
          Back to events
        </router-link>
      </div>

      <form
        v-else
        class="mx-auto flex w-full max-w-2xl flex-col gap-6"
        novalidate
        @submit.prevent="saveDraftOrChanges"
      >
        <div
          v-if="isEdit && status"
          class="flex flex-wrap items-center gap-3"
        >
          <Badge :variant="statusVariant(status)">
            {{ STATUS_LABELS[status] }}
          </Badge>
          <router-link
            :to="`/manage/tix/${slugValue}`"
            class="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open event
          </router-link>
        </div>

        <p
          v-if="readOnly"
          role="status"
          class="rounded-2xl border border-border bg-muted p-4 text-sm"
        >
          A cancelled event cannot be edited.
        </p>

        <div
          ref="summaryEl"
          data-error-summary
          aria-live="assertive"
          tabindex="-1"
          class="outline-none"
        >
          <div
            v-if="errorList.length"
            class="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <p class="font-semibold">
              {{ errorList.length === 1 ? 'Fix 1 problem to continue.' : `Fix ${errorList.length} problems to continue.` }}
            </p>
            <ul class="mt-2 list-disc space-y-1 pl-5">
              <li
                v-for="item in errorList"
                :key="item.key"
              >
                <a
                  :href="`#${fieldId(item.key)}`"
                  class="underline"
                  @click.prevent="focusField(item.key)"
                >{{ item.message }}</a>
              </li>
            </ul>
          </div>
        </div>

        <fieldset
          :disabled="readOnly"
          class="contents"
        >
          <AppSection title="Basics">
            <div class="flex flex-col gap-4">
              <div class="space-y-1.5">
                <Label for="field-name">Event name</Label>
                <Input
                  id="field-name"
                  v-model="form.name"
                  type="text"
                  placeholder="e.g. JPCS General Assembly"
                  :aria-invalid="errors.name ? 'true' : undefined"
                  :aria-describedby="errors.name ? 'err-name' : undefined"
                  @update:model-value="onNameInput"
                />
                <FieldError
                  id="err-name"
                  :message="errors.name"
                />
              </div>

              <div class="space-y-1.5">
                <Label for="field-slug">Link</Label>
                <div
                  class="flex h-11 min-w-0 items-center rounded-xl border border-input bg-transparent px-3.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
                  :class="errors.slug ? 'border-destructive' : ''"
                >
                  <span class="mr-0.5 shrink-0 font-mono text-sm font-bold text-foreground">eypi.cc/tix/</span>
                  <input
                    id="field-slug"
                    :value="form.slug"
                    type="text"
                    placeholder="bwai2026"
                    autocapitalize="none"
                    autocomplete="off"
                    spellcheck="false"
                    :readonly="isEdit"
                    :aria-invalid="errors.slug ? 'true' : undefined"
                    :aria-describedby="errors.slug ? 'err-slug' : 'help-slug'"
                    class="min-w-0 flex-1 bg-transparent font-mono text-base text-foreground outline-none placeholder:text-muted-foreground read-only:text-muted-foreground"
                    @input="onSlugInput"
                  >
                </div>
                <p
                  v-if="!errors.slug"
                  id="help-slug"
                  class="text-xs font-medium text-muted-foreground"
                >
                  {{ isEdit ? 'The link cannot change after the event is created.' : 'Lowercase letters and numbers only.' }}
                </p>
                <FieldError
                  id="err-slug"
                  :message="errors.slug"
                />
              </div>

              <div class="flex flex-col gap-4 sm:flex-row">
                <div class="flex-1 space-y-1.5">
                  <Label for="field-date">Date</Label>
                  <Input
                    id="field-date"
                    v-model="form.date"
                    type="date"
                    :aria-invalid="errors.date ? 'true' : undefined"
                    :aria-describedby="errors.date ? 'err-date' : undefined"
                  />
                  <FieldError
                    id="err-date"
                    :message="errors.date"
                  />
                </div>
                <div class="flex-1 space-y-1.5">
                  <Label for="field-time">Starts (Manila time)</Label>
                  <Input
                    id="field-time"
                    v-model="form.time"
                    type="time"
                    :aria-invalid="errors.time ? 'true' : undefined"
                    :aria-describedby="errors.time ? 'err-time' : undefined"
                  />
                  <FieldError
                    id="err-time"
                    :message="errors.time"
                  />
                </div>
                <div class="flex-1 space-y-1.5">
                  <Label for="field-endTime">Ends (Manila time, optional)</Label>
                  <Input
                    id="field-endTime"
                    v-model="form.endTime"
                    type="time"
                    :aria-invalid="errors.endTime ? 'true' : undefined"
                    :aria-describedby="errors.endTime ? 'err-endTime' : undefined"
                  />
                  <FieldError
                    id="err-endTime"
                    :message="errors.endTime"
                  />
                </div>
              </div>

              <div class="space-y-1.5">
                <Label for="field-location">Location</Label>
                <Input
                  id="field-location"
                  v-model="form.location"
                  type="text"
                  placeholder="e.g. APC Auditorium"
                  :aria-invalid="errors.location ? 'true' : undefined"
                  :aria-describedby="errors.location ? 'err-location' : undefined"
                />
                <FieldError
                  id="err-location"
                  :message="errors.location"
                />
              </div>

              <div class="space-y-1.5">
                <div class="flex items-end justify-between gap-3">
                  <Label for="field-description">Description (optional)</Label>
                  <div
                    class="flex gap-1 rounded-xl border border-border bg-muted p-1"
                    role="group"
                    aria-label="Description view"
                  >
                    <Button
                      type="button"
                      size="sm"
                      :variant="preview ? 'ghost' : 'default'"
                      :aria-pressed="!preview"
                      @click="preview = false"
                    >
                      Write
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      :variant="preview ? 'default' : 'ghost'"
                      :aria-pressed="preview"
                      @click="showPreview"
                    >
                      Preview
                    </Button>
                  </div>
                </div>
                <Textarea
                  v-show="!preview"
                  id="field-description"
                  v-model="form.description"
                  rows="6"
                  placeholder="Markdown works: **bold**, lists and links."
                  :aria-invalid="errors.description ? 'true' : undefined"
                  :aria-describedby="errors.description ? 'err-description count-description' : 'count-description'"
                />
                <!-- eslint-disable vue/no-v-html -- sanitized by DOMPurify in renderMarkdown -->
                <div
                  v-if="preview"
                  data-description-preview
                  class="min-h-24 rounded-xl border border-input p-3.5 text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_ul]:ml-5 [&_ul]:list-disc"
                  v-html="previewHtml || '<p class=&quot;text-muted-foreground&quot;>Nothing to preview.</p>'"
                />
                <!-- eslint-enable vue/no-v-html -->
                <p
                  id="count-description"
                  data-description-count
                  class="text-xs font-medium"
                  :class="form.description.length > DESCRIPTION_MAX ? 'text-destructive' : 'text-muted-foreground'"
                >
                  {{ form.description.length }} / {{ DESCRIPTION_MAX }}
                </p>
                <FieldError
                  id="err-description"
                  :message="errors.description"
                />
              </div>
            </div>
          </AppSection>

          <AppSection title="Cover image">
            <div class="flex flex-col gap-3">
              <div
                v-if="coverPreview"
                class="relative aspect-[16/6] overflow-hidden rounded-xl border border-border"
              >
                <img
                  v-if="pendingCoverUrl"
                  :src="pendingCoverUrl"
                  alt="Cover preview"
                  class="h-full w-full object-cover"
                >
                <AppImage
                  v-else
                  :src="coverPreview"
                  :meta="existingCoverMeta"
                  sizes="(min-width: 768px) 672px, 100vw"
                  alt="Cover preview"
                  class="h-full w-full object-cover"
                />
              </div>
              <label class="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border px-4 py-3 text-center text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
                {{ coverPreview ? 'Replace image' : 'Choose image' }}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="sr-only"
                  aria-describedby="help-cover"
                  @change="onCoverPicked"
                >
              </label>
              <p
                id="help-cover"
                class="text-xs font-medium text-muted-foreground"
              >
                JPEG, PNG or WebP up to 10 MB. Uploaded when you save.
              </p>
              <FieldError
                id="err-cover"
                :message="errors.cover"
              />
              <Button
                v-if="coverPreview"
                type="button"
                variant="outline"
                class="w-fit"
                @click="removeCover"
              >
                Remove cover
              </Button>
            </div>
          </AppSection>

          <AppSection title="Admission">
            <fieldset class="flex flex-col gap-3">
              <legend class="sr-only">
                Admission mode
              </legend>
              <label
                v-for="mode in MODES"
                :key="mode.value"
                class="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border p-3 has-checked:border-primary has-checked:bg-primary/10 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <input
                  v-model="form.admissionMode"
                  type="radio"
                  name="admissionMode"
                  :value="mode.value"
                  class="mt-0.5 size-5 accent-primary"
                  :aria-describedby="errors.admissionMode ? 'err-admissionMode' : undefined"
                >
                <span>
                  <span class="block text-sm font-semibold">{{ mode.label }}</span>
                  <span class="block text-sm text-muted-foreground">{{ mode.help }}</span>
                </span>
              </label>
              <FieldError
                id="err-admissionMode"
                :message="errors.admissionMode"
              />
            </fieldset>
            <p
              v-if="!selfRegistration"
              class="mt-3 text-sm text-muted-foreground"
            >
              After you save, upload the attendee list and set clusters on the next page.
            </p>

            <fieldset class="mt-5 flex flex-col gap-3">
              <legend class="mb-1 text-sm font-semibold">
                Who can find it
              </legend>
              <label
                v-for="option in VISIBILITIES"
                :key="option.value"
                class="flex min-h-11 cursor-pointer items-center gap-3 text-sm"
              >
                <input
                  v-model="form.visibility"
                  type="radio"
                  name="visibility"
                  :value="option.value"
                  class="size-5 accent-primary"
                >
                <span><span class="font-medium">{{ option.label }}</span> <span class="text-muted-foreground">{{ option.help }}</span></span>
              </label>
            </fieldset>
          </AppSection>

          <AppSection title="Capacity">
            <div class="flex flex-col gap-4">
              <div class="space-y-1.5">
                <Label for="field-capacity">Capacity (optional)</Label>
                <Input
                  id="field-capacity"
                  v-model="form.capacity"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  step="1"
                  placeholder="No limit"
                  :aria-invalid="errors.capacity ? 'true' : undefined"
                  :aria-describedby="errors.capacity ? 'err-capacity' : undefined"
                />
                <FieldError
                  id="err-capacity"
                  :message="errors.capacity"
                />
              </div>
              <div
                v-if="waitlistAllowed"
                class="flex min-h-11 items-center gap-3"
              >
                <Switch
                  id="field-waitlistEnabled"
                  :model-value="form.waitlistEnabled"
                  @update:model-value="(v: boolean | 'indeterminate') => (form.waitlistEnabled = v === true)"
                />
                <Label for="field-waitlistEnabled">Waitlist when full</Label>
              </div>
              <FieldError
                id="err-waitlistEnabled"
                :message="errors.waitlistEnabled"
              />
            </div>
          </AppSection>

          <AppSection
            v-if="selfRegistration"
            title="Registration window"
          >
            <div class="flex flex-col gap-4 sm:flex-row">
              <div class="flex-1 space-y-1.5">
                <Label for="field-opensAt">Opens (Manila time)</Label>
                <Input
                  id="field-opensAt"
                  v-model="form.opensAt"
                  type="datetime-local"
                  :aria-invalid="errors.opensAt ? 'true' : undefined"
                />
              </div>
              <div class="flex-1 space-y-1.5">
                <Label for="field-closesAt">Closes (Manila time)</Label>
                <Input
                  id="field-closesAt"
                  v-model="form.closesAt"
                  type="datetime-local"
                  :aria-invalid="errors.closesAt ? 'true' : undefined"
                  :aria-describedby="errors.closesAt ? 'err-closesAt' : undefined"
                />
                <FieldError
                  id="err-closesAt"
                  :message="errors.closesAt"
                />
              </div>
            </div>
            <p class="mt-3 text-xs font-medium text-muted-foreground">
              Leave both empty to accept registrations until the event is closed.
            </p>
          </AppSection>

          <AppSection
            v-if="selfRegistration"
            title="Questions"
          >
            <div
              id="field-questions"
              tabindex="-1"
              class="outline-none"
            >
              <EventQuestionsEditor v-model="form.questions" />
              <FieldError
                id="err-questions"
                :message="errors.questions"
                class="mt-3"
              />
            </div>
          </AppSection>
        </fieldset>

        <div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            v-if="canPublish"
            type="button"
            size="lg"
            :disabled="busy || readOnly"
            @click="openPublish"
          >
            Publish
          </Button>
          <Button
            type="submit"
            size="lg"
            :variant="canPublish ? 'outline' : 'default'"
            :disabled="busy || readOnly"
          >
            {{ saveLabel }}
          </Button>
        </div>
      </form>
    </AppPage>

    <EventPublishDialog
      v-model:open="publishOpen"
      :busy="busy"
      :rows="summaryRows"
      @confirm="confirmPublish"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, nextTick, onMounted, reactive, ref, watch, type PropType } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import AppImage from '@/components/AppImage.vue'
import AppPage from '@/components/layout/AppPage.vue'
import AppSection from '@/components/layout/AppSection.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import EventPublishDialog from '@/components/tix/EventPublishDialog.vue'
import EventQuestionsEditor from '@/components/tix/EventQuestionsEditor.vue'
import { readImageAsDataUrl } from '@/composables/useImageUpload'
import { useDialog } from '@/composables/useDialog'
import { useToast } from '@/composables/useToast'
import { ApiError, api } from '@/lib/api'
import type { ImageMeta } from '@/lib/images/variants'
import { uploadVariants } from '@/lib/images/uploadVariants'
import { formatManilaDate } from '@/lib/manilaTime'
import {
  DESCRIPTION_MAX, allowsWaitlist, blankForm, formFromEvent, slugFromName, takesSelfRegistration, toPayload, validateForm,
  type AdmissionMode, type EventStatus, type ManagedEvent, type Visibility,
} from '@/lib/tix/eventForm'

const FieldError = defineComponent({
  props: { id: { type: String, required: true }, message: { type: String as PropType<string | undefined>, default: undefined } },
  setup(props) {
    return () => (props.message ? h('p', { id: props.id, class: 'text-sm font-medium text-destructive' }, props.message) : null)
  },
})

const MODES: { value: AdmissionMode; label: string; help: string }[] = [
  { value: 'fcfs', label: 'First come, first served', help: 'Seats go to the first people who register.' },
  { value: 'lottery', label: 'Lottery', help: 'People enter, then you draw winners.' },
  { value: 'approval', label: 'Approval', help: 'You approve or decline each request.' },
  { value: 'import', label: 'CSV import', help: 'Upload an attendee list and issue tickets yourself.' },
]
const VISIBILITIES: { value: Visibility; label: string; help: string }[] = [
  { value: 'unlisted', label: 'Unlisted', help: 'Only people with the link can find it.' },
  { value: 'public', label: 'Public', help: 'Listed on the organization profile.' },
]
const STATUS_LABELS: Record<EventStatus, string> = { draft: 'Draft', published: 'Published', closed: 'Closed', cancelled: 'Cancelled' }
const ADMISSION_LOCKED = 'The admission mode cannot be changed once people have registered or the lottery has been drawn.'
const FIELD_ORDER = ['name', 'slug', 'date', 'time', 'endTime', 'location', 'description', 'cover', 'admissionMode', 'capacity', 'waitlistEnabled', 'opensAt', 'closesAt', 'questions']

const route = useRoute()
const router = useRouter()
const toast = useToast()
const dialog = useDialog()

const form = reactive(blankForm())
const loadedSlug = ref('')
const status = ref<EventStatus | null>(null)
const loading = ref(false)
const loadError = ref('')
const busy = ref(false)
const errors = ref<Record<string, string>>({})
const summaryEl = ref<HTMLElement | null>(null)
const publishOpen = ref(false)
const preview = ref(false)
const previewHtml = ref('')
const slugEdited = ref(false)

const pendingCover = ref<{ file: File; dataUrl: string } | null>(null)
const existingCover = ref('')
const existingCoverMeta = ref<ImageMeta | null>(null)
const coverRemoved = ref(false)
const pendingCoverUrl = computed(() => pendingCover.value?.dataUrl ?? '')
const coverPreview = computed(() => pendingCover.value?.dataUrl || (coverRemoved.value ? '' : existingCover.value))

const isEdit = computed(() => Boolean(loadedSlug.value || route.params.id))
const slugValue = computed(() => loadedSlug.value || String(route.params.id ?? ''))
const readOnly = computed(() => status.value === 'cancelled')
const selfRegistration = computed(() => takesSelfRegistration(form.admissionMode))
const waitlistAllowed = computed(() => allowsWaitlist(form.admissionMode))
const canPublish = computed(() => !isEdit.value || status.value === 'draft')
const saveLabel = computed(() => {
  if (busy.value) return 'SAVING...'
  return canPublish.value ? 'Save draft' : 'Save changes'
})

// Compared with the last saved state to decide whether Publish needs a PATCH first.
const comparable = () => {
  const { slug: _slug, ...rest } = toPayload(form)
  return JSON.stringify(rest)
}
const savedSnapshot = ref(comparable())
const dirty = computed(() => comparable() !== savedSnapshot.value || pendingCover.value !== null || coverRemoved.value)

const errorList = computed(() => {
  const keys = Object.keys(errors.value)
  keys.sort((a, b) => (FIELD_ORDER.indexOf(a) + 100) % 100 - (FIELD_ORDER.indexOf(b) + 100) % 100)
  return keys.map((key) => ({ key, message: errors.value[key] }))
})

const fieldId = (key: string) => (key === 'body' ? 'field-name' : `field-${key}`)

async function focusField(key: string) {
  await nextTick()
  const el = document.getElementById(fieldId(key)) ?? document.getElementById('field-name')
  el?.focus()
}

async function showErrors(next: Record<string, string>) {
  errors.value = next
  await nextTick()
  summaryEl.value?.focus()
}

function statusVariant(s: EventStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'published') return 'default'
  if (s === 'cancelled') return 'destructive'
  return s === 'closed' ? 'secondary' : 'outline'
}

function onNameInput() {
  if (!isEdit.value && !slugEdited.value) form.slug = slugFromName(form.name)
}
function onSlugInput(e: Event) {
  slugEdited.value = true
  form.slug = slugFromName((e.target as HTMLInputElement).value)
  ;(e.target as HTMLInputElement).value = form.slug
}

async function renderPreview() {
  const { renderMarkdown } = await import('@/composables/useMarkdown')
  previewHtml.value = renderMarkdown(form.description)
}
async function showPreview() {
  preview.value = true
  await renderPreview()
}
watch(() => form.description, () => { if (preview.value) void renderPreview() })

async function onCoverPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const dataUrl = await readImageAsDataUrl(file, 10 * 1024 * 1024)
    pendingCover.value = { file, dataUrl }
    coverRemoved.value = false
    delete errors.value.cover
  } catch (err) {
    errors.value = { ...errors.value, cover: err instanceof Error ? err.message : 'Could not read that image.' }
  } finally {
    input.value = ''
  }
}
function removeCover() {
  pendingCover.value = null
  coverRemoved.value = Boolean(existingCover.value)
}

// ── load ──────────────────────────────────────────────────────────────────────
async function load(slug: string) {
  loading.value = true
  loadError.value = ''
  try {
    const data = await api.get<{ event: ManagedEvent & { isLead?: boolean } }>(`/api/events/${encodeURIComponent(slug)}`)
    const event = data.event
    if (event.isLead === false || event.admissionMode === undefined) {
      loadError.value = 'You cannot edit this event.'
      return
    }
    Object.assign(form, formFromEvent(event))
    loadedSlug.value = event.slug
    status.value = event.status ?? 'draft'
    existingCover.value = event.coverUrl ?? ''
    existingCoverMeta.value = (event.coverMeta as ImageMeta | null) ?? null
    coverRemoved.value = false
    pendingCover.value = null
    slugEdited.value = true
    savedSnapshot.value = comparable()
  } catch (err) {
    loadError.value = err instanceof ApiError && err.status === 404
      ? 'Event not found.'
      : 'Could not load the event. Check your connection and try again.'
  } finally {
    loading.value = false
  }
}

onMounted(() => { if (route.params.id) void load(String(route.params.id)) })
watch(() => route.params.id, (id) => {
  if (id && String(id) !== loadedSlug.value) void load(String(id))
})

onBeforeRouteLeave(async () => {
  if (!dirty.value || busy.value) return true
  return dialog.confirm({
    title: 'Leave without saving?',
    body: 'Your changes to this event have not been saved.',
    confirmLabel: 'Leave',
    abortLabel: 'Keep editing',
  })
})

// ── save ──────────────────────────────────────────────────────────────────────
function applyApiError(err: unknown): Record<string, string> {
  if (err instanceof ApiError) {
    if (err.code === 'invalid_event' && err.fields) {
      const mapped: Record<string, string> = {}
      for (const [key, message] of Object.entries(err.fields)) {
        const field = key === 'registrationOpensAt' ? 'opensAt' : key === 'registrationClosesAt' ? 'closesAt' : key === 'maxAttendees' ? 'capacity' : key
        mapped[field] = message
      }
      return mapped
    }
    if (err.code === 'slug_taken') return { slug: 'That link is already taken. Choose another.' }
    if (err.code === 'admission_locked') return { admissionMode: ADMISSION_LOCKED }
    if (err.code === 'event_cancelled') { status.value = 'cancelled'; return { body: 'A cancelled event cannot be edited.' } }
    if (err.code === 'invalid_transition') return { body: err.message }
    if (err.status === 403) return { body: 'You cannot manage this event.' }
    return { body: err.message }
  }
  return { body: 'Could not save. Check your connection and try again.' }
}

/** Create or update the event and its cover. Returns the slug, or null after showing the errors. */
async function persist(): Promise<string | null> {
  const problems = validateForm(form)
  if (Object.keys(problems).length > 0) {
    await showErrors(problems)
    return null
  }
  errors.value = {}
  let slug = loadedSlug.value
  try {
    if (!slug) {
      await api.post('/api/events', toPayload(form))
      slug = form.slug
      loadedSlug.value = slug
      status.value = 'draft'
      savedSnapshot.value = comparable()
    } else if (comparable() !== savedSnapshot.value) {
      const { slug: _slug, ...body } = toPayload(form)
      await api.patch(`/api/events/${encodeURIComponent(slug)}`, body)
      savedSnapshot.value = comparable()
    }
  } catch (err) {
    await showErrors(applyApiError(err))
    return null
  }

  try {
    await saveCover(slug)
  } catch (err) {
    await showErrors({ cover: err instanceof ApiError ? err.message : 'Could not save the cover image. Try again.' })
    return null
  }
  return slug
}

async function saveCover(slug: string) {
  const base = `/api/events/${encodeURIComponent(slug)}/cover`
  if (pendingCover.value) {
    const { file, dataUrl } = pendingCover.value
    const res = await api.put<{ coverKey?: string; coverUrl?: string }>(base, { image: dataUrl })
    existingCover.value = res.coverUrl ?? dataUrl
    existingCoverMeta.value = null
    pendingCover.value = null
    coverRemoved.value = false
    // Best-effort: the cover is saved, so a variants failure changes nothing.
    if (res.coverKey) {
      const meta = await uploadVariants(file, 'banner', res.coverKey).catch(() => null)
      if (meta) existingCoverMeta.value = meta
    }
  } else if (coverRemoved.value) {
    await api.del(base)
    existingCover.value = ''
    existingCoverMeta.value = null
    coverRemoved.value = false
  }
}

async function saveDraftOrChanges() {
  if (busy.value || readOnly.value) return
  busy.value = true
  try {
    const wasNew = !loadedSlug.value
    const slug = await persist()
    if (!slug) return
    if (!selfRegistration.value && wasNew) {
      toast.success('Event saved. Add your attendees next.')
      await router.push(`/manage/tix/${slug}/select`)
      return
    }
    toast.success(canPublish.value ? 'Draft saved.' : 'Changes saved.')
    if (wasNew) await router.replace(`/manage/tix/${slug}/edit`)
  } finally {
    busy.value = false
  }
}

// ── publish ───────────────────────────────────────────────────────────────────
const modeLabel = (mode: AdmissionMode) => MODES.find((m) => m.value === mode)?.label ?? mode

const summaryRows = computed(() => {
  const payload = toPayload(form)
  const when = [form.date ? formatManilaDate(form.date) : '', form.time && form.endTime ? `${form.time} to ${form.endTime}` : form.time].filter(Boolean).join(', ')
  const opens = form.opensAt ? form.opensAt.replace('T', ' ') : ''
  const closes = form.closesAt ? form.closesAt.replace('T', ' ') : ''
  let windowText = 'Open until the event is closed'
  if (!selfRegistration.value) windowText = 'Not applicable'
  else if (opens && closes) windowText = `${opens} to ${closes} (Manila time)`
  else if (opens) windowText = `Opens ${opens} (Manila time)`
  else if (closes) windowText = `Closes ${closes} (Manila time)`
  const count = payload.questions.length
  return [
    { label: 'Name', value: form.name.trim() },
    { label: 'Date and time (Manila time)', value: when },
    { label: 'Location', value: form.location.trim() },
    { label: 'Admission', value: modeLabel(form.admissionMode) },
    { label: 'Capacity', value: payload.capacity == null ? 'No limit' : String(payload.capacity) },
    { label: 'Registration window', value: windowText },
    { label: 'Questions', value: `${count} ${count === 1 ? 'question' : 'questions'}` },
    { label: 'Visibility', value: form.visibility === 'public' ? 'Public (listed on the organization profile)' : 'Unlisted (link only)' },
    { label: 'Public URL', value: `https://eypi.cc/tix/${form.slug}` },
  ]
})

async function openPublish() {
  const problems = validateForm(form)
  if (Object.keys(problems).length > 0) {
    await showErrors(problems)
    return
  }
  errors.value = {}
  publishOpen.value = true
}

async function confirmPublish() {
  if (busy.value) return
  busy.value = true
  try {
    const slug = await persist()
    if (!slug) {
      publishOpen.value = false
      return
    }
    try {
      await api.post(`/api/events/${encodeURIComponent(slug)}/publish`)
    } catch (err) {
      publishOpen.value = false
      await showErrors(applyApiError(err))
      // The draft was saved even though publishing failed.
      if (!route.params.id) await router.replace(`/manage/tix/${slug}/edit`)
      return
    }
    status.value = 'published'
    publishOpen.value = false
    toast.success('Event published.')
    await router.push(`/manage/tix/${slug}`)
  } finally {
    busy.value = false
  }
}
</script>
